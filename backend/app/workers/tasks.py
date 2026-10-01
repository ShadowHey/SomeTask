"""ARQ worker tasks for background processing."""

import asyncio
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.models.enums import AudioStatus, JobStatus, JobType, SummaryStatus
from app.models.models import AudioFile, ProcessingJob, RawTranscript, Summary, TranscriptSegment
from app.services.storage.r2 import storage_service
from app.services.summarization.gemini import GeminiSummaryProvider, SummaryProviderError
from app.services.transcription.gnani import GnaniTranscriptionProvider, ProviderError

logger = get_logger(__name__)

# Retry delays based on policy: 1 min, 5 min, 10 min
RETRY_DELAYS = [60, 300, 600]

# --- Enqueue helpers (used by API) ---

async def enqueue_transcription(audio_file_id: str) -> None:
    """Helper to enqueue a transcription job from the API."""
    from app.workers.main import get_redis_pool
    
    redis = await get_redis_pool()
    await redis.enqueue_job("process_transcription", audio_file_id)


async def enqueue_summary(audio_file_id: str) -> None:
    """Helper to enqueue a summary job from the API."""
    from app.workers.main import get_redis_pool
    
    redis = await get_redis_pool()
    await redis.enqueue_job("generate_summary", audio_file_id)


# --- Worker Tasks ---

async def process_transcription(ctx: dict, audio_file_id: str) -> None:
    """
    ARQ Task: Handle the full transcription pipeline.
    Creates job -> starts job -> polls -> downloads -> saves to DB.
    """
    job_id = ctx.get("job_id")
    attempt = ctx.get("job_try", 1)
    
    logger.info("process_transcription_started", audio_file_id=audio_file_id, attempt=attempt)
    
    async with async_session_factory() as db:
        # Load audio file and processing job
        stmt = (
            select(AudioFile)
            .where(AudioFile.id == audio_file_id)
            .options(selectinload(AudioFile.processing_jobs))
        )
        audio_file = (await db.execute(stmt)).scalar_one_or_none()
        
        if not audio_file:
            logger.error("audio_file_not_found", audio_file_id=audio_file_id)
            return

        if audio_file.status in (AudioStatus.DELETED.value, AudioStatus.FAILED.value) and attempt == 1:
            # If attempting to start a deleted or permanently failed job (unless it's an ARQ retry)
            # We don't process. If a user retries, the API should reset the status to QUEUED first.
            if audio_file.status != AudioStatus.QUEUED.value:
                logger.warning("skipping_transcription_wrong_status", audio_file_id=audio_file_id, status=audio_file.status)
                return

        # Find or create transcription ProcessingJob record
        processing_job = next(
            (j for j in audio_file.processing_jobs if j.job_type == JobType.TRANSCRIPTION.value), 
            None
        )
        
        if not processing_job:
            processing_job = ProcessingJob(
                audio_file_id=audio_file.id,
                job_type=JobType.TRANSCRIPTION.value,
                status=JobStatus.RUNNING.value,
                attempt_count=attempt
            )
            db.add(processing_job)
        else:
            processing_job.status = JobStatus.RUNNING.value
            processing_job.attempt_count = attempt
            
        processing_job.started_at = datetime.now(UTC)
        audio_file.status = AudioStatus.TRANSCRIBING.value
        await db.commit()

        try:
            # Check if duration requires chunking
            # In a real app we'd use FFmpeg to get duration if not provided
            # For take-home, if it's over 4 hours, we fail it for now unless we explicitly implemented Phase 9
            # (We will add the chunking logic independently later if required)
            if audio_file.duration_seconds and audio_file.duration_seconds > settings.gnani_max_duration_hours * 3600:
                # Stub for >4h chunking
                raise Exception("Files >4 hours require FFmpeg chunking (Phase 9)")

            provider = GnaniTranscriptionProvider()

            # 1. Generate short-lived presigned URL for Gnani
            presigned_url = storage_service.generate_presigned_download_url(
                audio_file.object_key, expires_in=settings.gnani_url_expiry
            )

            # 2. Create Job (Idempotency: check if we already have a provider_job_id)
            if not processing_job.provider_job_id:
                logger.debug("creating_gnani_job", audio_file_id=audio_file_id)
                provider_job_id = await provider.create_job(presigned_url, audio_file.language_code)
                processing_job.provider_job_id = provider_job_id
                await db.commit()
            
            provider_job_id = processing_job.provider_job_id

            # 3. Start Job
            # Gnani /start endpoint can return an error if already started, but we'll try it
            # and catch if it's already in progress.
            try:
                logger.debug("starting_gnani_job", audio_file_id=audio_file_id, provider_job_id=provider_job_id)
                await provider.start_job(provider_job_id)
            except ProviderError as e:
                # If it's already started, this might fail with a 4xx, which we can potentially ignore if status is running
                if "already started" not in str(e).lower() and not (e.response_data and e.response_data.get("status") in ["IN_PROGRESS", "COMPLETED"]):
                    raise

            # 4. Poll Status
            logger.debug("polling_gnani_job", audio_file_id=audio_file_id, provider_job_id=provider_job_id)
            max_polls = settings.gnani_max_poll_attempts
            poll_count = 0
            completed = False
            
            while poll_count < max_polls:
                status_data = await provider.poll_status(provider_job_id)
                job_status = status_data.get("status")
                
                if job_status == "COMPLETED":
                    completed = True
                    break
                elif job_status in ["FAILED", "START_FAILED", "CANCELLED"]:
                    raise ProviderError(f"Gnani job terminal failure: {job_status}", retryable=False, response_data=status_data)
                elif job_status == "PARTIAL_FAILURE":
                    # For a single file, partial failure usually means failure
                    completed = True
                    break
                    
                poll_count += 1
                await asyncio.sleep(settings.gnani_poll_interval_seconds)
                
                # Keep DB connection alive / update heartbeat if necessary
                # (SQLAlchemy async sessions are generally fine across sleeps, but good practice to not hold locks)
                
            if not completed:
                raise ProviderError("Polling timed out", retryable=True)

            # 5. Get Files and Download Transcript
            logger.debug("downloading_transcript", audio_file_id=audio_file_id)
            files = await provider.get_files(provider_job_id)
            
            if not files:
                raise ProviderError("No files returned in completed job", retryable=False)
                
            file_data = files[0]
            transcript_url = file_data.get("transcript_url")
            
            if not transcript_url:
                raise ProviderError("No transcript_url provided in file data", retryable=False, response_data=file_data)
                
            transcript_json = await provider.download_transcript(transcript_url)
            
            # Save raw response
            raw_transcript = RawTranscript(
                audio_file_id=audio_file.id,
                raw_response=transcript_json
            )
            db.add(raw_transcript)
            
            processing_job.raw_provider_response = transcript_json
            
            # 6. Normalize and save segments (Idempotency: clear existing if any)
            await db.execute(
                TranscriptSegment.__table__.delete().where(TranscriptSegment.audio_file_id == audio_file.id)
            )
            
            segments_data = transcript_json.get("segments", [])
            # Fallback if segments are missing but full_transcript is present
            if not segments_data and transcript_json.get("full_transcript"):
                segments_data = [{
                    "text": transcript_json["full_transcript"],
                    "start_time": 0.0,
                    "end_time": transcript_json.get("duration_seconds", 0.0)
                }]
                
            segments = []
            for i, seg in enumerate(segments_data):
                text = seg.get("text", "").strip()
                if not text:
                    continue
                    
                start_ms = int(seg.get("start_time", 0) * 1000) if seg.get("start_time") is not None else None
                end_ms = int(seg.get("end_time", 0) * 1000) if seg.get("end_time") is not None else None
                
                segments.append(
                    TranscriptSegment(
                        audio_file_id=audio_file.id,
                        sequence=i,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        text=text
                    )
                )
            
            if segments:
                db.add_all(segments)
            
            # Set duration if we got it from the provider
            if transcript_json.get("duration_seconds"):
                audio_file.duration_seconds = transcript_json.get("duration_seconds")
                
            # 7. Update status to SUMMARIZING and enqueue summary job
            processing_job.status = JobStatus.COMPLETED.value
            processing_job.completed_at = datetime.now(UTC)
            
            audio_file.status = AudioStatus.SUMMARIZING.value
            await db.commit()
            
            logger.info("transcription_completed", audio_file_id=audio_file_id)
            
            # Enqueue summary
            from app.workers.main import get_redis_pool
            redis = await get_redis_pool()
            await redis.enqueue_job("generate_summary", audio_file_id)

        except ProviderError as e:
            await db.rollback()
            await _handle_job_failure(db, audio_file.id, processing_job.id, attempt, "transcription", e, e.retryable)
            
        except Exception as e:
            await db.rollback()
            await _handle_job_failure(db, audio_file.id, processing_job.id, attempt, "transcription", e, retryable=True)


async def generate_summary(ctx: dict, audio_file_id: str) -> None:
    """
    ARQ Task: Generate a summary using Gemini Flash.
    """
    attempt = ctx.get("job_try", 1)
    
    logger.info("generate_summary_started", audio_file_id=audio_file_id, attempt=attempt)
    
    async with async_session_factory() as db:
        stmt = (
            select(AudioFile)
            .where(AudioFile.id == audio_file_id)
            .options(
                selectinload(AudioFile.transcript_segments),
                selectinload(AudioFile.summary),
                selectinload(AudioFile.processing_jobs)
            )
        )
        audio_file = (await db.execute(stmt)).scalar_one_or_none()
        
        if not audio_file:
            logger.error("audio_file_not_found", audio_file_id=audio_file_id)
            return

        # Find or create summary ProcessingJob
        processing_job = next(
            (j for j in audio_file.processing_jobs if j.job_type == JobType.SUMMARY.value), 
            None
        )
        
        if not processing_job:
            processing_job = ProcessingJob(
                audio_file_id=audio_file.id,
                job_type=JobType.SUMMARY.value,
                status=JobStatus.RUNNING.value,
                attempt_count=attempt
            )
            db.add(processing_job)
        else:
            processing_job.status = JobStatus.RUNNING.value
            processing_job.attempt_count = attempt
            
        processing_job.started_at = datetime.now(UTC)
        audio_file.status = AudioStatus.SUMMARIZING.value
        
        # Idempotency: Create or update Summary record
        summary = audio_file.summary
        if not summary:
            summary = Summary(
                audio_file_id=audio_file.id,
                status=SummaryStatus.PENDING.value,
                provider="gemini",
                model=settings.gemini_model,
                attempt_count=attempt
            )
            db.add(summary)
        else:
            summary.status = SummaryStatus.PENDING.value
            summary.attempt_count = attempt
            
        await db.commit()

        try:
            # Build full transcript text
            segments = sorted(audio_file.transcript_segments, key=lambda x: x.sequence)
            full_text = " ".join(s.text for s in segments)
            
            provider = GeminiSummaryProvider()
            summary_content = await provider.summarize(full_text)
            
            summary.content = summary_content
            summary.status = SummaryStatus.COMPLETED.value
            summary.updated_at = datetime.now(UTC)
            
            processing_job.status = JobStatus.COMPLETED.value
            processing_job.completed_at = datetime.now(UTC)
            
            audio_file.status = AudioStatus.COMPLETED.value
            audio_file.completed_at = datetime.now(UTC)
            
            await db.commit()
            
            logger.info("summary_completed", audio_file_id=audio_file_id)
            
        except SummaryProviderError as e:
            await db.rollback()
            await _handle_job_failure(db, audio_file.id, processing_job.id, attempt, "summary", e, e.retryable)
            
        except Exception as e:
            await db.rollback()
            await _handle_job_failure(db, audio_file.id, processing_job.id, attempt, "summary", e, retryable=True)


async def _handle_job_failure(
    db: AsyncSession, 
    audio_file_id: uuid.UUID, 
    job_id: uuid.UUID, 
    attempt: int, 
    stage: str, 
    error: Exception, 
    retryable: bool
) -> None:
    """Handle job failures, apply retry policy, and update database."""
    from arq import Retry
    
    # Reload entities
    stmt = (
        select(AudioFile)
        .where(AudioFile.id == audio_file_id)
        .options(selectinload(AudioFile.processing_jobs))
    )
    audio_file = (await db.execute(stmt)).scalar_one()
    processing_job = next(j for j in audio_file.processing_jobs if j.id == job_id)
    
    error_msg = str(error)
    logger.error("job_failed", audio_file_id=str(audio_file.id), stage=stage, attempt=attempt, error=error_msg, retryable=retryable)
    
    processing_job.last_error = error_msg
    if hasattr(error, "error_code"):
        processing_job.error_code = error.error_code
        
    # Check if we should retry
    should_retry = retryable and attempt <= len(RETRY_DELAYS)
    
    if should_retry:
        delay_seconds = RETRY_DELAYS[attempt - 1]
        
        processing_job.status = JobStatus.PENDING.value
        if stage == "summary":
            # If summary fails, transcript is still there, stay in SUMMARIZING state
            audio_file.status = AudioStatus.SUMMARIZING.value
        else:
            audio_file.status = AudioStatus.QUEUED.value
            
        await db.commit()
        
        logger.info("job_retrying", audio_file_id=str(audio_file.id), stage=stage, attempt=attempt, delay_seconds=delay_seconds)
        # ARQ Retry exception automatically schedules the retry
        raise Retry(defer=delay_seconds)
    else:
        # Terminal failure
        processing_job.status = JobStatus.FAILED.value
        processing_job.completed_at = datetime.now(UTC)
        processing_job.retryable = False
        
        if stage == "summary":
            # Don't fail the whole audio file if just the summary failed
            audio_file.status = AudioStatus.COMPLETED.value
            audio_file.failure_stage = "summary"
            audio_file.failure_message = "Summary generation failed."
            
            # Update summary status
            summary_stmt = select(Summary).where(Summary.audio_file_id == audio_file.id)
            summary = (await db.execute(summary_stmt)).scalar_one_or_none()
            if summary:
                summary.status = SummaryStatus.FAILED.value
        else:
            audio_file.status = AudioStatus.FAILED.value
            audio_file.failure_stage = stage
            audio_file.failure_message = error_msg
            
        await db.commit()
        logger.error("job_terminal_failure", audio_file_id=str(audio_file.id), stage=stage)
