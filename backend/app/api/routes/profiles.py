import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import get_db, get_current_user_id
from app.models.models import Profile
from app.schemas.schemas import ProfileResponse, ProfileUpdateRequest

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("", response_model=ProfileResponse)
async def get_profile(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the profile for the current user. Creates one if it doesn't exist."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)
        try:
            await db.commit()
            await db.refresh(profile)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(select(Profile).where(Profile.user_id == user_id))
            profile = result.scalar_one_or_none()

    return profile

@router.patch("", response_model=ProfileResponse)
async def update_profile(
    update_data: ProfileUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the profile for the current user."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    if update_data.username is not None:
        # Check if username is taken by another user
        if update_data.username.strip():
            existing = await db.execute(select(Profile).where(Profile.username == update_data.username.strip(), Profile.user_id != user_id))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username is already taken")
            profile.username = update_data.username.strip()
        else:
            profile.username = None

    if update_data.avatar_id is not None:
        profile.avatar_id = update_data.avatar_id

    try:
        await db.commit()
        await db.refresh(profile)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error. Username might be taken.")

    return profile
