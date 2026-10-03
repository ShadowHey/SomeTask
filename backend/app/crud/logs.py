import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import SystemLog
from app.models.enums import LogLevel, LogStage

async def create_system_log(
    db: AsyncSession,
    user_id: uuid.UUID,
    level: LogLevel,
    stage: LogStage,
    message: str,
    note_id: Optional[uuid.UUID] = None,
    details: Optional[dict] = None
) -> SystemLog:
    """Create a new system log entry."""
    
    log_entry = SystemLog(
        user_id=user_id,
        note_id=note_id,
        level=level.value,
        stage=stage.value,
        message=message,
        details=details
    )
    
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry
