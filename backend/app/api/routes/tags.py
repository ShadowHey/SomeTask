import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user_id
from app.db.session import get_db
from app.models.models import Tag
from app.schemas.schemas import TagResponse

router = APIRouter(tags=["tags"])

@router.get("", response_model=list[TagResponse])
async def list_tags(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all tags for the authenticated user."""
    result = await db.execute(
        select(Tag)
        .where(Tag.user_id == user_id)
        .order_by(Tag.name.asc())
    )
    return result.scalars().all()
