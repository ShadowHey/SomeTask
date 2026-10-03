"""Ask AI endpoints."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.dependencies import get_current_user_id
from app.db.session import get_db
from app.models.models import AudioNote, TranscriptSegment
from app.schemas.ask_ai import AskAIRequest, AskAIResponse
from app.services.ask_ai_service import AskAIService, AskAIServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/{note_id}/ask", response_model=AskAIResponse)
async def ask_question(
    note_id: uuid.UUID,
    request: AskAIRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AskAIResponse:
    """Ask a question about a specific recording."""
    # Verify ownership
    result = await db.execute(select(AudioNote).where(AudioNote.id == note_id, AudioNote.user_id == user_id))
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found",
        )

    if note.status not in ["completed", "transcription_completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recording transcription is not complete.",
        )

    # Fetch transcript segments
    result = await db.execute(
        select(TranscriptSegment)
        .where(TranscriptSegment.note_id == note_id)
        .order_by(TranscriptSegment.sequence_number)
    )
    segments = result.scalars().all()
    
    if not segments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transcript available for this recording.",
        )

    transcript_text = " ".join([s.text for s in segments])

    # Call Gemini
    service = AskAIService()
    try:
        answer = await service.ask_question(transcript_text, request.question)
        return AskAIResponse(answer=answer)
    except AskAIServiceError as e:
        logger.error("Ask AI failed", note_id=str(note_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate AI response. Please try again later.",
        )
