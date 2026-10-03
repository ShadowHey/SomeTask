"""Authorized system logs endpoints."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user_id
from app.db.session import get_db
from app.models.models import SystemLog
from app.models.enums import LogLevel, LogStage
from app.schemas.schemas import SystemLogListResponse, SystemLogResponse, SystemLogCreate
from app.crud.logs import create_system_log

router = APIRouter()

@router.get("", response_model=SystemLogListResponse)
async def list_logs(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    level: Optional[str] = Query(None, description="Filter by log level (e.g., error)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SystemLogListResponse:
    """Retrieve system logs for the authenticated user, newest first."""
    
    query = select(SystemLog).where(SystemLog.user_id == user_id)
    
    if level:
        query = query.where(SystemLog.level == level.lower())
        
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()
    
    # Get items
    query = query.order_by(desc(SystemLog.created_at)).limit(limit).offset(offset)
    logs = (await db.execute(query)).scalars().all()
    
    return SystemLogListResponse(
        items=[
            SystemLogResponse.model_validate(log)
            for log in logs
        ],
        total=total
    )

@router.post("", response_model=SystemLogResponse)
async def add_log(
    request: SystemLogCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SystemLogResponse:
    """Create a system log entry manually from the client."""
    log_level = LogLevel(request.level.lower()) if request.level else LogLevel.INFO
    log_stage = LogStage(request.stage.lower()) if request.stage else LogStage.SYSTEM

    log = await create_system_log(
        db=db,
        user_id=user_id,
        note_id=request.note_id,
        level=log_level,
        stage=log_stage,
        message=request.message,
        details=request.details,
    )
    return SystemLogResponse.model_validate(log)
