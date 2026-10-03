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
from app.models.models import AudioNote, ProcessingJob, TranscriptSegment, UsageRecord
from app.services.summarization.gemini import GeminiSummaryProvider, SummaryProviderError
from app.services.transcription.gnani import GnaniTranscriptionProvider, ProviderError
from app.crud.logs import create_system_log
from app.models.enums import LogLevel, LogStage

logger = get_logger(__name__)

RETRY_DELAYS = [60, 300, 600]
_TERMINAL_GNANI_STATUSES = {"FAILED", "START_FAILED", "CANCELLED"}


async def process_audio_note(ctx: dict, note_id: uuid.UUID) -> None:
    """Route a newly uploaded note into the idempotent transcription task."""
    from app.workers.main import get_redis_pool

    redis = await get_redis_pool()
    await redis.enqueue_job("process_transcription", note_id)


def _signed_url_for_path(storage_path: str) -> str:
    """Create a short-lived, worker-only URL that Gnani can fetch once."""
    response = supabase_client.storage.from_(settings.supabase_bucket_name).create_signed_url(
        storage_path,
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
            from app.models.models import UserApiKeys
            from app.core.security import decrypt_api_key
            keys_result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == note.user_id))
            keys_record = keys_result.scalar_one_or_none()
            
            gnani_key = None
            if keys_record and not keys_record.use_default_gnani:
                gnani_key = decrypt_api_key(keys_record.encrypted_gnani_key)
                
            provider = GnaniTranscriptionProvider(api_key=gnani_key)
            if not processing_job.provider_job_id:
                try:
                    presigned_url = await asyncio.to_thread(_signed_url_for_path, note.storage_path)
                    config = note.transcription_config or {}
                    
                    from app.workers.chunking import get_audio_chunks
                    chunks = await get_audio_chunks(presigned_url, note.storage_path)
                except Exception as e:
                    # Log storage retrieval failures as STORAGE stage
                    await db.rollback()
                    await _handle_job_failure(
                        db, note.id, processing_job.id, attempt, LogStage.STORAGE.value, e, True
                    )
                    return
                
                job_ids = []
                offsets = []
                for chunk in chunks:
                    j_id = await provider.create_job(
                        chunk["url"], config, settings.gnani_webhook_url
                    )
                    await provider.start_job(j_id)
                    job_ids.append(j_id)
                    offsets.append(chunk["offset_ms"])
                    
                processing_job.provider_job_id = ",".join(job_ids)
                processing_job.raw_provider_response = {"offsets": offsets}
                await db.commit()
                
                note.status = AudioStatus.TRANSCRIPTION_PROCESSING.value
                await db.commit()
                logger.info(
                    "transcription_started", note_id=str(note.id), provider_job_id=processing_job.provider_job_id
                )
                await create_system_log(
                    db=db,
                    user_id=note.user_id,
                    note_id=note.id,
                    level=LogLevel.INFO,
                    stage=LogStage.TRANSCRIPTION,
                    message=f"Transcription started for '{note.recording_name or note.original_filename}' via Gnani AI."
                )
            
            if not settings.gnani_webhook_url:
                logger.info(
                    "transcription_polling_mode",
                    note_id=str(note.id),
                    provider_job_id=processing_job.provider_job_id,
                )
                poll_count = 0
                while True:
                    if poll_count >= settings.gnani_max_poll_attempts:
                        raise ProviderError("Transcription polling timed out.", retryable=False)
                    poll_count += 1
                    
                    await asyncio.sleep(10)
                    job_ids = processing_job.provider_job_id.split(",")
                    all_completed = True
                    for j_id in job_ids:
                        status_info = await provider.poll_status(j_id)
                        job_status = str(status_info.get("status", "")).upper()
                        logger.info(
                            "transcription_polling_status",
                            note_id=str(note.id),
                            job_status=job_status,
                            j_id=j_id
                        )
                        if job_status in _TERMINAL_GNANI_STATUSES:
                            raise ProviderError(
                                f"Gnani job {j_id} terminated with status: {job_status}",
                                retryable=False,
                                response_data=status_info,
                            )
                        if job_status != "COMPLETED":
                            all_completed = False
                            break
                            
                    if all_completed:
                        await asyncio.sleep(2)
                        offsets = processing_job.raw_provider_response.get("offsets", [0] * len(job_ids)) if processing_job.raw_provider_response else [0] * len(job_ids)
                        all_transcripts = []
                        for j_id, offset in zip(job_ids, offsets):
                            transcript_json = await _download_transcript(provider, j_id)
                            transcript_json["_offset_ms"] = offset
                            all_transcripts.append(transcript_json)
                            
                        await _store_transcripts(db, note, processing_job, all_transcripts)
                        logger.info(
                            "transcription_completed_via_polling",
                            note_id=str(note.id),
                            provider_job_id=processing_job.provider_job_id,
                        )
                        await create_system_log(
                            db=db,
                            user_id=note.user_id,
                            note_id=note.id,
                            level=LogLevel.INFO,
                            stage=LogStage.TRANSCRIPTION,
                            message=f"Transcription completed successfully for '{note.recording_name or note.original_filename}'."
                        )
                        break
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
            from app.models.models import UserApiKeys
            from app.core.security import decrypt_api_key
            keys_result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == note.user_id))
            keys_record = keys_result.scalar_one_or_none()
            
            gnani_key = None
            if keys_record and not keys_record.use_default_gnani:
                gnani_key = decrypt_api_key(keys_record.encrypted_gnani_key)
                
            provider = GnaniTranscriptionProvider(api_key=gnani_key)
            job_ids = processing_job.provider_job_id.split(",")
            
            # Since this is a webhook for a single job, check if ALL jobs are completed
            all_completed = True
            for j_id in job_ids:
                status_info = await provider.poll_status(j_id)
                if str(status_info.get("status", "")).upper() != "COMPLETED":
                    all_completed = False
                    break
                    
            if not all_completed:
                logger.info("webhook_received_but_not_all_chunks_complete", note_id=str(note.id))
                return
                
            offsets = processing_job.raw_provider_response.get("offsets", [0] * len(job_ids)) if processing_job.raw_provider_response else [0] * len(job_ids)
            all_transcripts = []
            for j_id, offset in zip(job_ids, offsets):
                transcript_json = await _download_transcript(provider, j_id)
                transcript_json["_offset_ms"] = offset
                all_transcripts.append(transcript_json)
                
            await _store_transcripts(db, note, processing_job, all_transcripts)
            logger.info(
                "transcription_completed", note_id=str(note.id), provider_job_id=processing_job.provider_job_id
            )
            await create_system_log(
                db=db,
                user_id=note.user_id,
                note_id=note.id,
                level=LogLevel.INFO,
                stage=LogStage.TRANSCRIPTION,
                message=f"Transcription completed successfully for '{note.recording_name or note.original_filename}'."
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


async def _store_transcripts(
    db: AsyncSession,
    note: AudioNote,
    processing_job: ProcessingJob,
    transcripts_json: list[dict[str, object]],
) -> None:
    """Replace normalized segments atomically and preserve Gnani's raw response."""
    processing_job.raw_provider_response = {"transcripts": transcripts_json}
    await db.execute(delete(TranscriptSegment).where(TranscriptSegment.note_id == note.id))

    segments: list[TranscriptSegment] = []
    global_sequence = 0
    total_duration_s = 0.0
    first_lang = None

    for t_json in transcripts_json:
        offset_ms = t_json.get("_offset_ms", 0)
        
        raw_segments = t_json.get("segments", [])
        if not raw_segments and t_json.get("full_transcript"):
            raw_segments = [
                {
                    "text": t_json["full_transcript"],
                    "start_time": 0,
                    "end_time": t_json.get("duration_seconds", 0),
                }
            ]
        
        if not first_lang and t_json.get("language_code"):
            first_lang = str(t_json.get("language_code", ""))
            
        dur = t_json.get("duration_seconds")
        if isinstance(dur, (int, float)):
            total_duration_s += float(dur)

        for raw_segment in raw_segments:
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

            start_ms = _seconds_to_milliseconds(raw_segment.get("start_time"))
            end_ms = _seconds_to_milliseconds(raw_segment.get("end_time"))
            
            if start_ms is not None:
                start_ms += offset_ms
            if end_ms is not None:
                end_ms += offset_ms

            segments.append(
                TranscriptSegment(
                    note_id=note.id,
                    sequence_number=global_sequence,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=text,
                    speaker_id=speaker_id,
                    confidence=confidence,
                    language_detected=language_detected,
                )
            )
            global_sequence += 1
            
    db.add_all(segments)

    if first_lang:
        note.resolved_language = first_lang
    if total_duration_s > 0:
        note.duration_seconds = total_duration_s
        
    processing_job.status = JobStatus.COMPLETED.value
    note.status = AudioStatus.TRANSCRIPTION_COMPLETED.value
    
    # Emit UsageRecord for transcription
    cost = round((total_duration_s / 60.0) * 0.45, 2) if total_duration_s > 0 else 0.0
    usage = UsageRecord(
        user_id=note.user_id,
        note_id=note.id,
        job_type="transcription",
        original_filename=note.original_filename,
        provider="gnani",
        duration_seconds=total_duration_s,
        status="completed",
        cost=cost
    )
    db.add(usage)
    
    # Auto-generate summary
    note.summary_status = "queued"
    
    await db.commit()
    
    # Enqueue summary generation job
    from app.workers.main import get_redis_pool
    from app.crud.logs import create_system_log
    from app.models.enums import LogStage, LogLevel
    
    redis = await get_redis_pool()
    await redis.enqueue_job("generate_summary", note.id)
    
    await create_system_log(
        db=db,
        user_id=note.user_id,
        note_id=note.id,
        level=LogLevel.INFO,
        stage=LogStage.SUMMARY,
        message=f"AI Summary queued automatically for '{note.recording_name or note.original_filename}'.",
    )


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
        
        await create_system_log(
            db=db,
            user_id=note.user_id,
            note_id=note.id,
            level=LogLevel.INFO,
            stage=LogStage.SUMMARY,
            message=f"AI Summary generation started for '{note.recording_name or note.original_filename}'."
        )

        try:
            transcript = " ".join(
                segment.text
                for segment in sorted(
                    note.transcript_segments, key=lambda item: item.sequence_number
                )
            )
            
            from app.models.models import UserApiKeys
            from app.core.security import decrypt_api_key
            keys_result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == note.user_id))
            keys_record = keys_result.scalar_one_or_none()
            
            gemini_key = None
            if keys_record and not keys_record.use_default_gemini:
                gemini_key = decrypt_api_key(keys_record.encrypted_gemini_key)
                
            note.summary = await GeminiSummaryProvider(api_key=gemini_key).summarize(transcript)
            processing_job.status = JobStatus.COMPLETED.value
            note.summary_status = "completed"
            from datetime import datetime
            from datetime import timezone
            note.summary_completed_at = datetime.now(timezone.utc)
            
            # Emit UsageRecord for summary
            usage = UsageRecord(
                user_id=note.user_id,
                note_id=note.id,
                job_type="summary",
                original_filename=note.original_filename,
                provider="gemini",
                duration_seconds=note.duration_seconds,
                status="completed",
                cost=0.0 # Summaries are currently considered 0 cost, or logic can be added later
            )
            db.add(usage)
            
            await db.commit()
            logger.info("summary_completed", note_id=str(note.id))
            await create_system_log(
                db=db,
                user_id=note.user_id,
                note_id=note.id,
                level=LogLevel.INFO,
                stage=LogStage.SUMMARY,
                message=f"AI Summary completed successfully for '{note.recording_name or note.original_filename}'."
            )
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
        
        stage_enum = LogStage.SUMMARY if stage == "summary" else LogStage.TRANSCRIPTION
        await create_system_log(
            db=db,
            user_id=note.user_id,
            note_id=note.id,
            level=LogLevel.WARNING,
            stage=stage_enum,
            message=f"{stage.capitalize()} encountered an error for '{note.recording_name or note.original_filename}'. Retrying in {delay_seconds} seconds.",
            details={"error": error_message, "type": type(error).__name__, "retryable": True}
        )
        
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
    
    stage_enum = LogStage.SUMMARY if stage == "summary" else LogStage.TRANSCRIPTION
    await create_system_log(
        db=db,
        user_id=note.user_id,
        note_id=note.id,
        level=LogLevel.ERROR,
        stage=stage_enum,
        message=f"{stage.capitalize()} failed permanently for '{note.recording_name or note.original_filename}': {error_message[:200]}",
        details={"error": error_message, "type": type(error).__name__, "retryable": False}
    )
    
    # Emit UsageRecord for failure
    usage = UsageRecord(
        user_id=note.user_id,
        note_id=note.id,
        job_type=stage,
        original_filename=note.original_filename,
        provider="gnani" if stage == "transcription" else "gemini",
        duration_seconds=note.duration_seconds, # May be None if failed early
        status="failed",
        cost=0.0 # Failed jobs do not cost credits
    )
    db.add(usage)
    await db.commit()
