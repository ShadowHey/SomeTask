"""Recording management API routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.enums import AudioStatus
from app.models.models import AudioFile, ProcessingJob, Summary, TranscriptSegment, User
from app.schemas.schemas import (
    AudioUrlResponse,
    RecordingDetail,
    RecordingListItem,
    RecordingStatusResponse,
    RecordingUpdateRequest,
    TranscriptSearchResponse,
    TranscriptSearchResult,
)
from app.services.storage.r2 import storage_service

logger = get_logger(__name__)

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.get("", response_model=list[RecordingListItem])
async def list_recordings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[RecordingListItem]:
    """Get history of recordings for the authenticated user."""
    # Enforce ownership in the query
    stmt = (
        select(AudioFile)
        .where(AudioFile.user_id == current_user.id)
        .where(AudioFile.status != AudioStatus.DELETED.value)
        .options(selectinload(AudioFile.summary))
        .order_by(desc(AudioFile.created_at))
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    recordings = result.scalars().all()

    # Map to response schema, extracting summary preview if available
    items = []
    for rec in recordings:
        summary_preview = None
        if rec.summary and rec.summary.content:
            # Simple truncation for preview
            summary_preview = rec.summary.content[:200]
            if len(rec.summary.content) > 200:
                summary_preview += "..."

        item = RecordingListItem.model_validate(
            rec, update={"summary_preview": summary_preview}
        )
        items.append(item)

    return items


@router.get("/{audio_file_id}", response_model=RecordingDetail)
async def get_recording(
    audio_file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecordingDetail:
    """Get full details of a specific recording."""
    stmt = (
        select(AudioFile)
        .where(
            AudioFile.id == audio_file_id,
            AudioFile.user_id == current_user.id,
            AudioFile.status != AudioStatus.DELETED.value,
        )
        .options(
            selectinload(AudioFile.transcript_segments),
            selectinload(AudioFile.summary),
        )
    )

    result = await db.execute(stmt)
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    return RecordingDetail.model_validate(recording)


@router.patch("/{audio_file_id}", response_model=RecordingDetail)
async def update_recording(
    audio_file_id: str,
    body: RecordingUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecordingDetail:
    """Update recording metadata (e.g., rename)."""
    stmt = (
        select(AudioFile)
        .where(
            AudioFile.id == audio_file_id,
            AudioFile.user_id == current_user.id,
            AudioFile.status != AudioStatus.DELETED.value,
        )
        .options(
            selectinload(AudioFile.transcript_segments),
            selectinload(AudioFile.summary),
        )
    )

    result = await db.execute(stmt)
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    recording.display_name = body.display_name
    await db.commit()
    await db.refresh(recording)

    logger.info("recording_renamed", user_id=str(current_user.id), recording_id=str(recording.id))

    return RecordingDetail.model_validate(recording)


@router.delete("/{audio_file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(
    audio_file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft delete a recording."""
    stmt = select(AudioFile).where(
        AudioFile.id == audio_file_id,
        AudioFile.user_id == current_user.id,
    )

    result = await db.execute(stmt)
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    recording.status = AudioStatus.DELETED.value
    await db.commit()

    logger.info("recording_deleted", user_id=str(current_user.id), recording_id=str(recording.id))

    # Note: A background cleanup job could eventually hard-delete the DB records
    # and the R2 object to save space, but soft delete is safer for the take-home.


@router.get("/{audio_file_id}/status", response_model=RecordingStatusResponse)
async def get_recording_status(
    audio_file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecordingStatusResponse:
    """Get the current processing status and active jobs."""
    stmt = (
        select(AudioFile)
        .where(
            AudioFile.id == audio_file_id,
            AudioFile.user_id == current_user.id,
            AudioFile.status != AudioStatus.DELETED.value,
        )
        .options(selectinload(AudioFile.processing_jobs))
    )

    result = await db.execute(stmt)
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    return RecordingStatusResponse(
        audio_file_id=recording.id,
        status=recording.status,
        failure_stage=recording.failure_stage,
        failure_message=recording.failure_message,
        processing_jobs=recording.processing_jobs,
    )


@router.get("/{audio_file_id}/audio-url", response_model=AudioUrlResponse)
async def get_audio_url(
    audio_file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AudioUrlResponse:
    """Get a short-lived presigned URL to play/download the audio."""
    stmt = select(AudioFile).where(
        AudioFile.id == audio_file_id,
        AudioFile.user_id == current_user.id,
        AudioFile.status != AudioStatus.DELETED.value,
    )

    result = await db.execute(stmt)
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    if recording.status in (AudioStatus.CREATED.value, AudioStatus.UPLOADING.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Audio not fully uploaded")

    try:
        url = storage_service.generate_presigned_download_url(recording.object_key)
        return AudioUrlResponse(url=url, expires_in=3600)  # 1 hour default
    except Exception as e:
        logger.error("audio_url_generation_failed", recording_id=audio_file_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate audio URL",
        )


@router.get("/{audio_file_id}/transcript/search", response_model=TranscriptSearchResponse)
async def search_transcript(
    audio_file_id: str,
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptSearchResponse:
    """Fuzzy search the transcript using pg_trgm."""
    # First verify ownership
    stmt_auth = select(AudioFile.id).where(
        AudioFile.id == audio_file_id,
        AudioFile.user_id == current_user.id,
        AudioFile.status != AudioStatus.DELETED.value,
    )
    result_auth = await db.execute(stmt_auth)
    if not result_auth.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")

    # Use pg_trgm similarity to find and rank matches.
    # similarity() function requires pg_trgm extension.
    # ILIKE is used as a fallback or for exact substring matches, but for fuzzy we use similarity.
    # The `<->` operator is for distance, `similarity` is for score (0.0 to 1.0).
    similarity_expr = func.similarity(TranscriptSegment.text, q).label("similarity")

    stmt = (
        select(TranscriptSegment, similarity_expr)
        .where(
            TranscriptSegment.audio_file_id == audio_file_id,
            TranscriptSegment.text.op("%%")(q),  # %% is the pg_trgm similarity operator in SQLAlchemy
        )
        .order_by(desc("similarity"))
        .limit(limit)
    )

    try:
        result = await db.execute(stmt)
        rows = result.all()

        results = []
        for segment, similarity in rows:
            results.append(
                TranscriptSearchResult(
                    segment_id=segment.id,
                    text=segment.text,
                    start_ms=segment.start_ms,
                    end_ms=segment.end_ms,
                    similarity=float(similarity),
                )
            )

        return TranscriptSearchResponse(query=q, results=results, total=len(results))

    except Exception as e:
        # If pg_trgm is not installed or fails, fallback to simple ILIKE
        logger.warning(
            "pg_trgm_search_failed",
            error=str(e),
            action="falling_back_to_ilike",
            recording_id=audio_file_id,
        )

        stmt_fallback = (
            select(TranscriptSegment)
            .where(
                TranscriptSegment.audio_file_id == audio_file_id,
                TranscriptSegment.text.ilike(f"%{q}%"),
            )
            .order_by(TranscriptSegment.sequence)
            .limit(limit)
        )
        result_fallback = await db.execute(stmt_fallback)
        segments = result_fallback.scalars().all()

        results = [
            TranscriptSearchResult(
                segment_id=segment.id,
                text=segment.text,
                start_ms=segment.start_ms,
                end_ms=segment.end_ms,
                similarity=1.0,  # Exact match
            )
            for segment in segments
        ]
        return TranscriptSearchResponse(query=q, results=results, total=len(results))
