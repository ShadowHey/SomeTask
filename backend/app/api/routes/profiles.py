import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import get_current_user, get_current_user_id
from app.db.session import get_db
from app.models.models import Profile, UserApiKeys
from app.schemas.schemas import ProfileResponse, ProfileUpdateRequest, ApiKeysConfigResponse, ApiKeysUpdateRequest, ApiKeyProviderConfig
from app.core.security import encrypt_api_key

router = APIRouter(tags=["profile"])

@router.get("", response_model=ProfileResponse)
async def get_profile(
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the profile for the current user. Creates one with metadata/defaults if it doesn't exist."""
    user_id = uuid.UUID(user.id)
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        meta = getattr(user, "user_metadata", {}) or {}
        username = meta.get("username")
        avatar_id = meta.get("avatar_id") or "avatar-01"
        if not username and getattr(user, "email", None):
            username = user.email.split("@")[0]

        profile = Profile(
            user_id=user_id,
            username=username,
            avatar_id=avatar_id,
        )
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
        if update_data.username.strip():
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

@router.get("/keys", response_model=ApiKeysConfigResponse)
async def get_api_keys_config(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == user_id))
    keys_record = result.scalar_one_or_none()

    if not keys_record:
        return ApiKeysConfigResponse(
            gemini=ApiKeyProviderConfig(has_custom_key=False, use_default=True),
            gnani=ApiKeyProviderConfig(has_custom_key=False, use_default=True),
        )
    
    return ApiKeysConfigResponse(
        gemini=ApiKeyProviderConfig(
            has_custom_key=bool(keys_record.encrypted_gemini_key),
            use_default=keys_record.use_default_gemini,
        ),
        gnani=ApiKeyProviderConfig(
            has_custom_key=bool(keys_record.encrypted_gnani_key),
            use_default=keys_record.use_default_gnani,
        ),
    )

@router.patch("/keys", response_model=ApiKeysConfigResponse)
async def update_api_keys(
    update_data: ApiKeysUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == user_id))
    keys_record = result.scalar_one_or_none()

    if not keys_record:
        keys_record = UserApiKeys(user_id=user_id)
        db.add(keys_record)
    
    if update_data.gemini_api_key is not None:
        if update_data.gemini_api_key.strip():
            keys_record.encrypted_gemini_key = encrypt_api_key(update_data.gemini_api_key.strip())
        else:
            keys_record.encrypted_gemini_key = None
            
    if update_data.gnani_api_key is not None:
        if update_data.gnani_api_key.strip():
            keys_record.encrypted_gnani_key = encrypt_api_key(update_data.gnani_api_key.strip())
        else:
            keys_record.encrypted_gnani_key = None

    if update_data.use_default_gemini is not None:
        keys_record.use_default_gemini = update_data.use_default_gemini
        
    if update_data.use_default_gnani is not None:
        keys_record.use_default_gnani = update_data.use_default_gnani

    await db.commit()
    await db.refresh(keys_record)

    return ApiKeysConfigResponse(
        gemini=ApiKeyProviderConfig(
            has_custom_key=bool(keys_record.encrypted_gemini_key),
            use_default=keys_record.use_default_gemini,
        ),
        gnani=ApiKeyProviderConfig(
            has_custom_key=bool(keys_record.encrypted_gnani_key),
            use_default=keys_record.use_default_gnani,
        ),
    )

@router.delete("/keys")
async def remove_api_keys(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserApiKeys).where(UserApiKeys.user_id == user_id))
    keys_record = result.scalar_one_or_none()

    if keys_record:
        keys_record.encrypted_gemini_key = None
        keys_record.encrypted_gnani_key = None
        keys_record.use_default_gemini = True
        keys_record.use_default_gnani = True
        await db.commit()
        
    return {"status": "success"}
