"""Upload API routes — multipart upload to R2."""

import math
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.enums import AudioStatus
from app.models.models import AudioFile, User
from app.schemas.schemas import (
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadInitiateRequest,
    UploadInitiateResponse,
    UploadPartUrl,
)
from app.services.storage.r2 import generate_object_key, storage_service

logger = get_logger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _validate_file(filename: str, file_size: int, mime_type: str) -> None:
    """Validate upload metadata before creating the upload session."""
    # Check extension
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Supported: {', '.join(settings.allowed_extensions)}",
        )

    # Check MIME type
    if mime_type not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type: {mime_type}",
        )

    # Check file size
    if file_size > settings.max_file_size_bytes:
        max_gb = settings.max_file_size_bytes / (1024**3)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum: {max_gb:.0f} GB",
        )


@router.post("/initiate", response_model=UploadInitiateResponse)
async def initiate_upload(
    body: UploadInitiateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadInitiateResponse:
    """Initialize a multipart upload to R2.

    1. Validates file metadata
    2. Creates audio_file record
    3. Creates R2 multipart upload
    4. Returns presigned part URLs
    """
    _validate_file(body.filename, body.file_size, body.mime_type)

    # Create the audio file record
    audio_file = AudioFile(
        user_id=current_user.id,
        original_filename=body.filename,
        display_name=os.path.splitext(body.filename)[0],  # Strip extension for display
        object_key="placeholder",  # Will be set below
        mime_type=body.mime_type,
        size_bytes=body.file_size,
        status=AudioStatus.UPLOADING.value,
        language_code=body.language_code,
    )
    db.add(audio_file)
    await db.flush()  # Get the generated ID

    # Generate safe object key
    object_key = generate_object_key(current_user.id, audio_file.id)
    audio_file.object_key = object_key

    # Create R2 multipart upload
    try:
        upload_id = storage_service.create_multipart_upload(object_key, body.mime_type)
    except Exception as e:
        logger.error(
            "upload_initiate_failed",
            user_id=str(current_user.id),
            audio_file_id=str(audio_file.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to initialize upload. Please try again.",
        )

    audio_file.upload_id = upload_id

    # Calculate number of parts
    part_size = settings.upload_part_size
    num_parts = math.ceil(body.file_size / part_size)

    # Generate presigned URLs for each part
    part_urls = []
    for i in range(1, num_parts + 1):
        url = storage_service.generate_presigned_part_url(object_key, upload_id, i)
        part_urls.append(UploadPartUrl(part_number=i, url=url))

    logger.info(
        "upload_initiated",
        user_id=str(current_user.id),
        audio_file_id=str(audio_file.id),
        filename=body.filename,
        file_size=body.file_size,
        num_parts=num_parts,
    )

    return UploadInitiateResponse(
        audio_file_id=audio_file.id,
        upload_id=upload_id,
        object_key=object_key,
        part_urls=part_urls,
        part_size=part_size,
    )


@router.post("/{audio_file_id}/complete", response_model=UploadCompleteResponse)
async def complete_upload(
    audio_file_id: str,
    body: UploadCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadCompleteResponse:
    """Complete a multipart upload and enqueue processing."""
    from sqlalchemy import select

    from app.models.enums import JobStatus, JobType
    from app.models.models import ProcessingJob

    # Look up the audio file — enforce ownership
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_file_id,
            AudioFile.user_id == current_user.id,
        )
    )
    audio_file = result.scalar_one_or_none()
    if not audio_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    if audio_file.status != AudioStatus.UPLOADING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Upload is not in UPLOADING state (current: {audio_file.status})",
        )

    # Complete the R2 multipart upload
    parts = [
        {"PartNumber": p.part_number, "ETag": p.etag}
        for p in sorted(body.parts, key=lambda x: x.part_number)
    ]

    try:
        storage_service.complete_multipart_upload(
            audio_file.object_key, audio_file.upload_id, parts
        )
    except Exception as e:
        logger.error(
            "upload_complete_r2_failed",
            audio_file_id=str(audio_file.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to complete upload. Please try again.",
        )

    # Verify the object exists in R2
    head = storage_service.head_object(audio_file.object_key)
    if head is None:
        logger.error("upload_complete_object_missing", audio_file_id=str(audio_file.id))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upload verification failed.",
        )

    # Update the audio file record
    from datetime import UTC, datetime

    audio_file.status = AudioStatus.UPLOADED.value
    audio_file.uploaded_at = datetime.now(UTC)
    audio_file.size_bytes = head.get("ContentLength", audio_file.size_bytes)

    # Transition to QUEUED and create processing job
    audio_file.status = AudioStatus.QUEUED.value

    processing_job = ProcessingJob(
        audio_file_id=audio_file.id,
        job_type=JobType.TRANSCRIPTION.value,
        status=JobStatus.PENDING.value,
    )
    db.add(processing_job)
    await db.flush()

    # Enqueue ARQ job
    try:
        from app.workers.tasks import enqueue_transcription

        await enqueue_transcription(str(audio_file.id))
    except Exception as e:
        # Job is in DB — worker can pick it up from polling fallback
        logger.warning(
            "arq_enqueue_failed",
            audio_file_id=str(audio_file.id),
            error=str(e),
        )

    logger.info(
        "upload_completed",
        user_id=str(current_user.id),
        audio_file_id=str(audio_file.id),
        size_bytes=audio_file.size_bytes,
    )

    return UploadCompleteResponse(
        audio_file_id=audio_file.id,
        status=audio_file.status,
    )


@router.post("/{audio_file_id}/abort", status_code=status.HTTP_204_NO_CONTENT)
async def abort_upload(
    audio_file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Abort a multipart upload."""
    from sqlalchemy import select

    result = await db.execute(
        select(AudioFile).where(
            AudioFile.id == audio_file_id,
            AudioFile.user_id == current_user.id,
        )
    )
    audio_file = result.scalar_one_or_none()
    if not audio_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    if audio_file.upload_id:
        try:
            storage_service.abort_multipart_upload(audio_file.object_key, audio_file.upload_id)
        except Exception as e:
            logger.warning(
                "abort_r2_failed",
                audio_file_id=str(audio_file.id),
                error=str(e),
            )

    audio_file.status = AudioStatus.FAILED.value
    audio_file.failure_stage = "upload"
    audio_file.failure_message = "Upload aborted by user"
