"""Idempotent ARQ tasks for the transcription and summarization pipeline."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Mapping

from arq import Retry
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import get_logger
from app.core.supabase import supabase_client
from app.db.session import async_session_factory
from app.models.enums import AudioStatus, JobStatus, JobType
from app.models.models import AudioNote, ProcessingJob, TranscriptSegment
from app.services.summarization.gemini import GeminiSummaryProvider, SummaryProviderError
from app.services.transcription.gnani import GnaniTranscriptionProvider, ProviderError

logger = get_logger(__name__)

RETRY_DELAYS = [60, 300, 600]
_TERMINAL_GNANI_STATUSES = {"FAILED", "START_FAILED", "CANCELLED"}


async def process_audio_note(ctx: dict, note_id: uuid.UUID) -> None:
    """Route a newly uploaded note into the idempotent transcription task."""
    from app.workers.main import get_redis_pool

    redis = await get_redis_pool()
    await redis.enqueue_job("process_transcription", note_id)


def _signed_url_for_note(note: AudioNote) -> str:
    """Create a short-lived, worker-only URL that Gnani can fetch once."""
    response = supabase_client.storage.from_(settings.supabase_bucket_name).create_signed_url(
        note.storage_path,
        expires_in=settings.gnani_url_expiry,
    )
    signed_url = response.get("signedURL") or response.get("signedUrl")
    if not signed_url:
        raise ProviderError("Unable to create a storage URL for transcription", retryable=True)
    return signed_url


async def process_transcription(ctx: dict, note_id: uuid.UUID) -> None:
    """Create, start, poll, and persist a Gnani Batch transcription."""
    attempt = int(ctx.get("job_try", 1))
    logger.info("process_transcription_started", note_id=str(note_id), attempt=attempt)

    async with async_session_factory() as db:
        note = await _load_note_for_transcription(db, note_id)
        if note is None:
            return

        processing_job = _find_processing_job(note, JobType.TRANSCRIPTION)
        if processing_job and processing_job.status == JobStatus.RUNNING.value:
            logger.info("transcription_duplicate_skipped", note_id=str(note.id), attempt=attempt)
            return
        if note.status in {
            AudioStatus.TRANSCRIPTION_COMPLETED.value,
            AudioStatus.TRANSCRIPTION_PROCESSING.value,
        }:
            logger.info("transcription_already_processing_or_finished", note_id=str(note.id), status=note.status)
            return

        if processing_job is None:
            processing_job = ProcessingJob(
                note_id=note.id,
                job_type=JobType.TRANSCRIPTION.value,
                status=JobStatus.RUNNING.value,
                attempt_count=attempt,
            )
            db.add(processing_job)
        else:
            processing_job.status = JobStatus.RUNNING.value
            processing_job.attempt_count = attempt
        note.status = AudioStatus.TRANSCRIPTION_STARTING.value
        await db.commit()

        try:
            provider = GnaniTranscriptionProvider()
            if not processing_job.provider_job_id:
                presigned_url = _signed_url_for_note(note)
                config = note.transcription_config or {}
                processing_job.provider_job_id = await provider.create_job(
                    presigned_url, config, settings.gnani_webhook_url
                )
                await db.commit()
                
                await provider.start_job(processing_job.provider_job_id)
                note.status = AudioStatus.TRANSCRIPTION_PROCESSING.value
                await db.commit()
                logger.info(
                    "transcription_started", note_id=str(note.id), provider_job_id=processing_job.provider_job_id
                )
            
            if not settings.gnani_webhook_url:
                logger.info(
                    "transcription_polling_mode",
                    note_id=str(note.id),
                    provider_job_id=processing_job.provider_job_id,
                )
                while True:
                    await asyncio.sleep(10)
                    status_info = await provider.poll_status(processing_job.provider_job_id)
                    job_status = str(status_info.get("status", "")).upper()
                    logger.info(
                        "transcription_polling_status",
                        note_id=str(note.id),
                        job_status=job_status,
                    )
                    if job_status == "COMPLETED":
                        await asyncio.sleep(2)
                        transcript_json = await _download_transcript(
                            provider, processing_job.provider_job_id
                        )
                        await _store_transcript(db, note, processing_job, transcript_json)
                        logger.info(
                            "transcription_completed_via_polling",
                            note_id=str(note.id),
                            provider_job_id=processing_job.provider_job_id,
                        )
                        break
                    if job_status in _TERMINAL_GNANI_STATUSES:
                        raise ProviderError(
                            f"Gnani job terminated with status: {job_status}",
                            retryable=False,
                            response_data=status_info,
                        )
        except ProviderError as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "transcription", error, error.retryable
            )
        except Exception as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "transcription", error, retryable=True
            )


async def _load_note_for_transcription(db: AsyncSession, note_id: uuid.UUID) -> AudioNote | None:
    """Lock the note while deciding whether a duplicate worker may start it."""
    result = await db.execute(
        select(AudioNote)
        .where(AudioNote.id == note_id)
        .options(selectinload(AudioNote.processing_jobs))
        .with_for_update()
    )
    note = result.scalar_one_or_none()
    if note is None:
        logger.warning("audio_note_not_found", note_id=str(note_id))
        return None
    return note


def _find_processing_job(note: AudioNote, job_type: JobType) -> ProcessingJob | None:
    return next((job for job in note.processing_jobs if job.job_type == job_type.value), None)


async def process_completed_transcription(ctx: dict, note_id: uuid.UUID, provider_job_id: str) -> None:
    """Invoked by the webhook to finalize a completed transcription."""
    attempt = int(ctx.get("job_try", 1))
    logger.info("process_completed_transcription_started", note_id=str(note_id), attempt=attempt)

    async with async_session_factory() as db:
        note = await _load_note_for_transcription(db, note_id)
        if note is None:
            return

        if note.status == AudioStatus.TRANSCRIPTION_COMPLETED.value:
            return

        processing_job = _find_processing_job(note, JobType.TRANSCRIPTION)
        if not processing_job:
            return
            
        try:
            provider = GnaniTranscriptionProvider()
            transcript_json = await _download_transcript(provider, provider_job_id)
            await _store_transcript(db, note, processing_job, transcript_json)
            logger.info(
                "transcription_completed", note_id=str(note.id), provider_job_id=provider_job_id
            )
        except ProviderError as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "transcription", error, error.retryable
            )
        except Exception as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "transcription", error, retryable=True
            )


async def _download_transcript(
    provider: GnaniTranscriptionProvider, provider_job_id: str
) -> dict[str, object]:
    files = await provider.get_files(provider_job_id)
    if not files:
        raise ProviderError("Gnani returned no result files", retryable=True, error_code="no_files")
    transcript_url = files[0].get("transcript_url")
    if not isinstance(transcript_url, str) or not transcript_url:
        raise ProviderError(
            "Gnani returned no transcript URL", retryable=True, error_code="no_transcript_url"
        )
    return await provider.download_transcript(transcript_url)


async def _store_transcript(
    db: AsyncSession,
    note: AudioNote,
    processing_job: ProcessingJob,
    transcript_json: dict[str, object],
) -> None:
    """Replace normalized segments atomically and preserve Gnani's raw response."""
    processing_job.raw_provider_response = transcript_json
    await db.execute(delete(TranscriptSegment).where(TranscriptSegment.note_id == note.id))

    raw_segments = transcript_json.get("segments", [])
    if not raw_segments and transcript_json.get("full_transcript"):
        raw_segments = [
            {
                "text": transcript_json["full_transcript"],
                "start_time": 0,
                "end_time": transcript_json.get("duration_seconds", 0),
            }
        ]
    if not isinstance(raw_segments, list):
        raise ProviderError("Gnani returned malformed transcript segments", retryable=True)

    note.resolved_language = str(transcript_json.get("language_code", ""))

    segments: list[TranscriptSegment] = []
    for sequence_number, raw_segment in enumerate(raw_segments):
        if not isinstance(raw_segment, Mapping):
            continue
        text = str(raw_segment.get("text", "")).strip()
        if not text:
            continue
            
        confidence = raw_segment.get("confidence")
        if confidence is not None:
            confidence = float(confidence)
            
        speaker_id = raw_segment.get("speaker_id")
        if speaker_id is not None:
            speaker_id = int(speaker_id)
            
        language_detected = raw_segment.get("language_detected")
        if language_detected is not None:
            language_detected = str(language_detected)

        segments.append(
            TranscriptSegment(
                note_id=note.id,
                sequence_number=sequence_number,
                start_ms=_seconds_to_milliseconds(raw_segment.get("start_time")),
                end_ms=_seconds_to_milliseconds(raw_segment.get("end_time")),
                text=text,
                speaker_id=speaker_id,
                confidence=confidence,
                language_detected=language_detected,
            )
        )
    db.add_all(segments)

    duration_seconds = transcript_json.get("duration_seconds")
    if isinstance(duration_seconds, (int, float)):
        note.duration_seconds = float(duration_seconds)
    processing_job.status = JobStatus.COMPLETED.value
    note.status = AudioStatus.TRANSCRIPTION_COMPLETED.value
    await db.commit()


def _seconds_to_milliseconds(value: object) -> int | None:
    if isinstance(value, (int, float)):
        return int(value * 1000)
    return None


async def generate_summary(ctx: dict, note_id: uuid.UUID) -> None:
    """Generate and persist a Gemini summary without discarding a transcript on failure."""
    attempt = int(ctx.get("job_try", 1))
    logger.info("generate_summary_started", note_id=str(note_id), attempt=attempt)
    async with async_session_factory() as db:
        result = await db.execute(
            select(AudioNote)
            .where(AudioNote.id == note_id)
            .options(
                selectinload(AudioNote.transcript_segments), selectinload(AudioNote.processing_jobs)
            )
        )
        note = result.scalar_one_or_none()
        if note is None:
            logger.warning("audio_note_not_found", note_id=str(note_id))
            return
        if note.summary_status == "completed":
            logger.info("summary_already_finished", note_id=str(note.id))
            return

        processing_job = _find_processing_job(note, JobType.SUMMARY)
        if processing_job is None:
            processing_job = ProcessingJob(
                note_id=note.id,
                job_type=JobType.SUMMARY.value,
                status=JobStatus.RUNNING.value,
                attempt_count=attempt,
            )
            db.add(processing_job)
        elif processing_job.status == JobStatus.RUNNING.value:
            logger.info("summary_duplicate_skipped", note_id=str(note.id), attempt=attempt)
            return
        else:
            processing_job.status = JobStatus.RUNNING.value
            processing_job.attempt_count = attempt
            
        note.summary_status = "processing"
        await db.commit()

        try:
            transcript = " ".join(
                segment.text
                for segment in sorted(
                    note.transcript_segments, key=lambda item: item.sequence_number
                )
            )
            note.summary = await GeminiSummaryProvider().summarize(transcript)
            processing_job.status = JobStatus.COMPLETED.value
            note.summary_status = "completed"
            from datetime import datetime
            from datetime import timezone
            note.summary_completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("summary_completed", note_id=str(note.id))
        except SummaryProviderError as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "summary", error, error.retryable
            )
        except Exception as error:
            await db.rollback()
            await _handle_job_failure(
                db, note.id, processing_job.id, attempt, "summary", error, retryable=True
            )


async def _handle_job_failure(
    db: AsyncSession,
    note_id: uuid.UUID,
    job_id: uuid.UUID,
    attempt: int,
    stage: str,
    error: Exception,
    retryable: bool,
) -> None:
    """Persist retry state and use the required 1m → 5m → 10m retry schedule."""
    processing_job = (
        await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id))
    ).scalar_one()
    note = (await db.execute(select(AudioNote).where(AudioNote.id == note_id))).scalar_one()
    error_message = str(error)
    processing_job.last_error = error_message[:2000]
    should_retry = retryable and attempt <= len(RETRY_DELAYS)
    logger.warning(
        "job_failed",
        note_id=str(note.id),
        stage=stage,
        attempt=attempt,
        retryable=should_retry,
        error_type=type(error).__name__,
    )

    if should_retry:
        processing_job.status = JobStatus.PENDING.value
        if stage == "summary":
            note.summary_status = "queued"
        else:
            note.status = AudioStatus.TRANSCRIPTION_CREATED.value
        await db.commit()
        delay_seconds = RETRY_DELAYS[attempt - 1]
        logger.info("job_retrying", note_id=str(note.id), stage=stage, delay_seconds=delay_seconds)
        raise Retry(defer=delay_seconds)

    processing_job.status = JobStatus.FAILED.value
    if stage == "summary":
        note.summary_status = "failed"
        note.failure_stage = "summary"
        note.failure_message = "Summary generation failed. You can still view the transcript."
    else:
        note.status = AudioStatus.TRANSCRIPTION_FAILED.value
        note.failure_stage = "transcription"
        note.failure_message = "Transcription could not be completed. Please try again."
    await db.commit()
    logger.error(
        "job_terminal_failure", note_id=str(note.id), stage=stage, error_type=type(error).__name__
    )
