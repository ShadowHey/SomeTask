"""Authorized recording-management and processing endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user_id
from app.core.config import settings
from app.core.logging import get_logger
from app.core.supabase import supabase_client
from app.db.session import get_db
from app.models.enums import AudioStatus
from app.models.models import AudioNote, Tag
from app.schemas.schemas import (
    AudioUrlResponse,
    ProcessNoteRequest,
    RecordingDetail,
    RecordingListItem,
    RecordingStatusResponse,
    RecordingUpdateRequest,
    TranscriptSearchResponse,
    TranscriptSearchResult,
)
from app.workers.main import get_redis_pool

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model=RecordingDetail, status_code=status.HTTP_201_CREATED)
async def start_processing(
    request: ProcessNoteRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioNote:
    """Queue an authenticated user's successfully uploaded recording exactly once."""
    result = await db.execute(
        select(AudioNote)
        .options(selectinload(AudioNote.tags))
        .where(AudioNote.id == request.note_id, AudioNote.user_id == user_id)
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    if note.status not in {AudioStatus.CREATED.value, AudioStatus.UPLOADED.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Recording is already processing"
        )

    note.status = AudioStatus.TRANSCRIPTION_CREATED.value
    note.transcription_config = request.config.model_dump()
    
    if request.recording_name:
        note.recording_name = request.recording_name

    if request.tags:
        normalized_names = set()
        for tag_name in request.tags:
            cleaned = tag_name.strip().lstrip("#").lower()
            if cleaned:
                normalized_names.add(cleaned)
        
        if normalized_names:
            existing_tags_result = await db.execute(
                select(Tag).where(Tag.user_id == user_id, Tag.name.in_(normalized_names))
            )
            existing_tags = list(existing_tags_result.scalars().all())
            existing_names = {t.name for t in existing_tags}
            
            new_tags = []
            for name in normalized_names:
                if name not in existing_names:
                    new_tag = Tag(user_id=user_id, name=name)
                    db.add(new_tag)
                    new_tags.append(new_tag)
            
            note.tags = existing_tags + new_tags

    await db.commit()
    try:
        redis = await get_redis_pool()
        await redis.enqueue_job("process_audio_note", note.id)
    except Exception as error:
        # Keep the record retryable by the user instead of displaying a permanent queued state.
        note.status = AudioStatus.UPLOADED.value
        await db.commit()
        logger.error(
            "recording_enqueue_failed", note_id=str(note.id), error_type=type(error).__name__
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Processing could not be queued. Please try again.",
        ) from error
    logger.info("recording_queued", recording_id=str(note.id), user_id=str(user_id))
    return await _get_owned_note(db, note.id, user_id, include_segments=True)


@router.get("", response_model=list[RecordingListItem])
async def list_recordings(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[RecordingListItem]:
    """Return only recordings belonging to the authenticated user."""
    notes = (
        (
            await db.execute(
                select(AudioNote)
                .where(AudioNote.user_id == user_id)
                .options(selectinload(AudioNote.tags))
                .order_by(AudioNote.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        RecordingListItem(
            id=note.id,
            original_filename=note.original_filename,
            recording_name=note.recording_name,
            status=note.status,
            summary_status=note.summary_status,
            size_bytes=note.size_bytes,
            duration_seconds=note.duration_seconds,
            resolved_language=note.resolved_language,
            summary_preview=(note.summary[:150] + "…")
            if note.summary and len(note.summary) > 150
            else note.summary,
            created_at=note.created_at,
            updated_at=note.updated_at,
            failure_stage=note.failure_stage,
            failure_message=note.failure_message,
            tags=[{"id": str(t.id), "name": t.name} for t in note.tags],
        )
        for note in notes
    ]


async def _get_owned_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    include_segments: bool = False,
    include_jobs: bool = False,
) -> AudioNote:
    options = [selectinload(AudioNote.tags)]
    if include_segments:
        options.append(selectinload(AudioNote.transcript_segments))
    if include_jobs:
        options.append(selectinload(AudioNote.processing_jobs))
    note = (
        await db.execute(
            select(AudioNote)
            .where(AudioNote.id == note_id, AudioNote.user_id == user_id)
            .options(*options)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    return note


@router.get("/{note_id}", response_model=RecordingDetail)
async def get_recording(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioNote:
    return await _get_owned_note(db, note_id, user_id, include_segments=True)

@router.post("/{note_id}/summary", response_model=RecordingDetail)
async def generate_summary(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioNote:
    note = await _get_owned_note(db, note_id, user_id)
    if note.status != AudioStatus.TRANSCRIPTION_COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Transcription must be completed first"
        )
    if note.summary_status in {"queued", "processing", "completed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Summary is already requested or completed"
        )
    note.summary_status = "queued"
    await db.commit()
    try:
        redis = await get_redis_pool()
        await redis.enqueue_job("generate_summary", note.id)
    except Exception as error:
        note.summary_status = "failed"
        await db.commit()
        logger.error(
            "summary_enqueue_failed", note_id=str(note.id), error_type=type(error).__name__
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Summary generation could not be queued. Please try again.",
        ) from error
    logger.info("summary_queued", recording_id=str(note.id), user_id=str(user_id))
    return await _get_owned_note(db, note.id, user_id, include_segments=True)


@router.get("/{note_id}/status", response_model=RecordingStatusResponse)
async def get_recording_status(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioNote:
    return await _get_owned_note(db, note_id, user_id, include_jobs=True)


@router.get("/{note_id}/audio-url", response_model=AudioUrlResponse)
async def get_audio_url(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioUrlResponse:
    """Issue a server-authorized, short-lived URL for the owned audio object."""
    note = await _get_owned_note(db, note_id, user_id)
    if note.status in {AudioStatus.CREATED.value, AudioStatus.UPLOADING.value}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Audio is not uploaded yet"
        )
    try:
        response = supabase_client.storage.from_(settings.supabase_bucket_name).create_signed_url(
            note.storage_path,
            expires_in=settings.download_url_expiry,
        )
        signed_url = response.get("signedURL") or response.get("signedUrl")
    except Exception as error:
        logger.error(
            "audio_url_generation_failed",
            recording_id=str(note.id),
            error_type=type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Audio is temporarily unavailable"
        ) from error
    if not signed_url:
        logger.error("audio_url_missing", recording_id=str(note.id))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Audio is temporarily unavailable"
        )
    return AudioUrlResponse(url=signed_url, expires_in=settings.download_url_expiry)


@router.patch("/{note_id}", response_model=RecordingDetail)
async def update_recording(
    note_id: uuid.UUID,
    update_data: RecordingUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AudioNote:
    note = await _get_owned_note(db, note_id, user_id, include_segments=True)
    note.original_filename = update_data.original_filename.strip()
    await db.commit()
    await db.refresh(note)
    logger.info("recording_renamed", recording_id=str(note.id), user_id=str(user_id))
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await _get_owned_note(db, note_id, user_id)
    try:
        supabase_client.storage.from_(settings.supabase_bucket_name).remove([note.storage_path])
    except Exception as error:
        logger.warning(
            "storage_delete_failed", recording_id=str(note.id), error_type=type(error).__name__
        )
    await db.delete(note)
    await db.commit()
    logger.info("recording_deleted", recording_id=str(note.id), user_id=str(user_id))


@router.get("/{note_id}/search", response_model=TranscriptSearchResponse)
async def search_transcript(
    note_id: uuid.UUID,
    q: str = Query(min_length=2, max_length=200),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TranscriptSearchResponse:
    """Search an owned transcript with pg_trgm, falling back to exact substring search."""
    await _get_owned_note(db, note_id, user_id)
    try:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT id, text, start_ms, end_ms, similarity(text, :query) AS similarity
                    FROM transcript_segments
                    WHERE note_id = :note_id AND (text % :query OR text ILIKE :contains)
                    ORDER BY similarity DESC, sequence_number
                    LIMIT 20
                    """
                ),
                {"note_id": note_id, "query": q, "contains": f"%{q}%"},
            )
        ).all()
    except Exception as error:
        logger.warning(
            "pg_trgm_search_failed", recording_id=str(note_id), error_type=type(error).__name__
        )
        rows = (
            await db.execute(
                text(
                    """
                    SELECT id, text, start_ms, end_ms, 1.0 AS similarity
                    FROM transcript_segments
                    WHERE note_id = :note_id AND text ILIKE :contains
                    ORDER BY sequence_number
                    LIMIT 20
                    """
                ),
                {"note_id": note_id, "contains": f"%{q}%"},
            )
        ).all()
    results = [
        TranscriptSearchResult(
            segment_id=row.id,
            text=row.text,
            start_ms=row.start_ms,
            end_ms=row.end_ms,
            similarity=float(row.similarity),
        )
        for row in rows
    ]
    return TranscriptSearchResponse(query=q, results=results, total=len(results))
