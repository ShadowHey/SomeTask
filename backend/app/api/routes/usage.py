"""Usage analytics router."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user_id
from app.db.session import get_db
from app.models.models import AudioNote, ProcessingJob
from pydantic import BaseModel, ConfigDict
import uuid

router = APIRouter(tags=["usage"])

class DailyUsage(BaseModel):
    date: str
    request_count: int
    duration_seconds: float

class UsageSummary(BaseModel):
    total_requests: int
    total_duration_seconds: float
    completed_requests: int
    failed_requests: int

class UsageHistoryItem(BaseModel):
    id: uuid.UUID
    created_at: datetime
    recording_name: Optional[str]
    original_filename: str
    model: Optional[str]
    job_id: Optional[str]
    duration_seconds: Optional[float]
    status: str

class UsageResponse(BaseModel):
    summary: UsageSummary
    daily_usage: list[DailyUsage]
    history: list[UsageHistoryItem]

@router.get("", response_model=UsageResponse)
async def get_usage(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get usage analytics for the authenticated user."""
    # Base query for AudioNotes
    notes_query = select(AudioNote).where(AudioNote.user_id == user_id)
    if start_date:
        notes_query = notes_query.where(AudioNote.created_at >= start_date)
    if end_date:
        notes_query = notes_query.where(AudioNote.created_at <= end_date)
    
    notes_result = await db.execute(notes_query.options(selectinload(AudioNote.processing_jobs)))
    notes = notes_result.scalars().all()

    # Base query for ProcessingJobs directly
    jobs_query = select(ProcessingJob).join(AudioNote).where(
        AudioNote.user_id == user_id,
        ProcessingJob.job_type == "transcription"
    )
    if start_date:
        jobs_query = jobs_query.where(ProcessingJob.created_at >= start_date)
    if end_date:
        jobs_query = jobs_query.where(ProcessingJob.created_at <= end_date)
        
    jobs_result = await db.execute(jobs_query)
    jobs = jobs_result.scalars().all()

    # Calculate summary
    total_requests = len(jobs)
    completed_requests = sum(1 for j in jobs if j.status == "completed")
    failed_requests = sum(1 for j in jobs if j.status in ("failed", "start_failed", "partial_failure"))
    total_duration = sum((n.duration_seconds or 0.0) for n in notes)

    summary = UsageSummary(
        total_requests=total_requests,
        total_duration_seconds=total_duration,
        completed_requests=completed_requests,
        failed_requests=failed_requests
    )

    # Calculate daily usage based on AudioNotes (or jobs, let's use jobs since it's "transcription usage")
    daily_map: dict[str, dict] = {}
    for note in notes:
        d_str = note.created_at.strftime("%Y-%m-%d")
        if d_str not in daily_map:
            daily_map[d_str] = {"request_count": 0, "duration_seconds": 0.0}
        
        # Add duration
        daily_map[d_str]["duration_seconds"] += (note.duration_seconds or 0.0)
        
        # Add requests for this note
        transcription_jobs = [j for j in note.processing_jobs if j.job_type == "transcription"]
        daily_map[d_str]["request_count"] += len(transcription_jobs)
        
    daily_usage = [
        DailyUsage(date=k, request_count=v["request_count"], duration_seconds=v["duration_seconds"])
        for k, v in sorted(daily_map.items())
    ]

    # Calculate history
    history = []
    for note in sorted(notes, key=lambda x: x.created_at, reverse=True):
        transcription_jobs = [j for j in note.processing_jobs if j.job_type == "transcription"]
        if not transcription_jobs:
            continue
            
        # Use the most recent transcription job
        job = sorted(transcription_jobs, key=lambda x: x.created_at, reverse=True)[0]
        
        model = None
        if note.transcription_config:
            model = note.transcription_config.get("model")
        elif job.raw_provider_response:
            model = job.raw_provider_response.get("model")
            
        history.append(
            UsageHistoryItem(
                id=note.id,
                created_at=job.created_at,
                recording_name=note.recording_name,
                original_filename=note.original_filename,
                model=model,
                job_id=job.provider_job_id,
                duration_seconds=note.duration_seconds,
                status=job.status
            )
        )

    # Sort history by created_at descending
    history.sort(key=lambda x: x.created_at, reverse=True)

    return UsageResponse(
        summary=summary,
        daily_usage=daily_usage,
        history=history
    )
