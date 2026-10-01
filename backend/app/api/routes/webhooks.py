"""Webhook routes for external providers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.enums import AudioStatus
from app.models.models import AudioNote, ProcessingJob
from app.workers.main import get_redis_pool

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/gnani/stt")
async def gnani_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Handle asynchronous terminal statuses from Gnani STT."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("gnani_webhook_invalid_json")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")
    job_id = payload.get("job_id")
    job_status = payload.get("status")

    if not event or not job_id:
        logger.warning("gnani_webhook_missing_fields", payload=payload)
        raise HTTPException(status_code=400, detail="Missing required fields")

    logger.info("gnani_webhook_received", event=event, gnani_job_id=job_id, status=job_status)

    # Find the corresponding job in our DB
    result = await db.execute(
        select(ProcessingJob).where(ProcessingJob.provider_job_id == job_id)
    )
    processing_job = result.scalar_one_or_none()
    
    if not processing_job:
        logger.warning("gnani_webhook_job_not_found", gnani_job_id=job_id)
        return {"status": "ignored", "reason": "job_not_found"}

    note_result = await db.execute(select(AudioNote).where(AudioNote.id == processing_job.note_id))
    note = note_result.scalar_one_or_none()
    
    if not note:
        logger.warning("gnani_webhook_note_not_found", gnani_job_id=job_id)
        return {"status": "ignored", "reason": "note_not_found"}

    # Handle terminal events
    if event in {"job.completed", "job.partial_failure"}:
        if note.status == AudioStatus.TRANSCRIPTION_COMPLETED.value:
            logger.info("gnani_webhook_already_completed", gnani_job_id=job_id)
            return {"status": "ok"}
            
        try:
            redis = await get_redis_pool()
            await redis.enqueue_job("process_completed_transcription", note.id, job_id)
            logger.info("process_completed_transcription_queued", note_id=str(note.id), gnani_job_id=job_id)
        except Exception as e:
            logger.error("gnani_webhook_enqueue_failed", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to enqueue job")
            
    elif event in {"job.failed", "job.cancelled"}:
        note.status = AudioStatus.TRANSCRIPTION_FAILED.value
        note.failure_stage = "transcription"
        note.failure_message = f"Gnani returned {job_status}"
        processing_job.status = "failed"
        await db.commit()
        logger.warning("gnani_webhook_job_failed", gnani_job_id=job_id, status=job_status)
    else:
        logger.info("gnani_webhook_ignored_event", event=event, gnani_job_id=job_id)

    return {"status": "ok"}
