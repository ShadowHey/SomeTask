"""Usage analytics router."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user_id
from app.db.session import get_db
from app.models.models import UsageRecord, AudioNote
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
    total_cost: float

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
    """Get usage analytics for the authenticated user from the immutable ledger."""
    
    # Query UsageRecords instead of AudioNotes directly
    query = select(UsageRecord).where(UsageRecord.user_id == user_id, UsageRecord.job_type == "transcription")
    if start_date:
        query = query.where(UsageRecord.created_at >= start_date)
    if end_date:
        query = query.where(UsageRecord.created_at <= end_date)
        
    result = await db.execute(query)
    records = result.scalars().all()

    # Calculate summary
    total_requests = len(records)
    completed_requests = sum(1 for r in records if r.status == "completed")
    failed_requests = sum(1 for r in records if r.status != "completed")
    total_duration = sum((r.duration_seconds or 0.0) for r in records)
    total_cost = sum((r.cost or 0.0) for r in records)

    summary = UsageSummary(
        total_requests=total_requests,
        total_duration_seconds=total_duration,
        completed_requests=completed_requests,
        failed_requests=failed_requests,
        total_cost=total_cost
    )

    # Calculate daily usage
    daily_map: dict[str, dict] = {}
    for r in records:
        d_str = r.created_at.strftime("%Y-%m-%d")
        if d_str not in daily_map:
            daily_map[d_str] = {"request_count": 0, "duration_seconds": 0.0}
        
        daily_map[d_str]["duration_seconds"] += (r.duration_seconds or 0.0)
        daily_map[d_str]["request_count"] += 1
        
    daily_usage = [
        DailyUsage(date=k, request_count=v["request_count"], duration_seconds=v["duration_seconds"])
        for k, v in sorted(daily_map.items())
    ]

    # Look up recording names for history (optional since original_filename is persisted)
    note_ids = [r.note_id for r in records if r.note_id]
    note_names = {}
    if note_ids:
        notes_query = select(AudioNote.id, AudioNote.recording_name).where(AudioNote.id.in_(note_ids))
        notes_result = await db.execute(notes_query)
        note_names = {n.id: n.recording_name for n in notes_result.all()}

    # Calculate history
    history = []
    for r in sorted(records, key=lambda x: x.created_at, reverse=True):
        history.append(
            UsageHistoryItem(
                id=r.id,
                created_at=r.created_at,
                recording_name=note_names.get(r.note_id) if r.note_id else None,
                original_filename=r.original_filename or "Unknown",
                model=r.model,
                job_id=None, # Usage records don't track the raw internal provider job IDs right now
                duration_seconds=r.duration_seconds,
                status=r.status
            )
        )

    return UsageResponse(
        summary=summary,
        daily_usage=daily_usage,
        history=history
    )
