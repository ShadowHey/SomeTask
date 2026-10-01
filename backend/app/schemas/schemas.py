"""Pydantic schemas for API request/response validation."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# ── Upload ───────────────────────────────────────────────────────────────────


class ProcessNoteRequest(BaseModel):
    """Payload sent by the frontend after it successfully uploads a file to Supabase Storage."""

    note_id: uuid.UUID


class AudioUrlResponse(BaseModel):
    """A short-lived, authorized URL for browser playback."""

    url: str
    expires_in: int


# ── Recordings ───────────────────────────────────────────────────────────────


class RecordingListItem(BaseModel):
    id: uuid.UUID
    original_filename: str
    status: str
    size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    summary_preview: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    failure_stage: Optional[str] = None
    failure_message: Optional[str] = None

    model_config = {"from_attributes": True}


class TranscriptSegmentResponse(BaseModel):
    id: uuid.UUID
    sequence_number: int
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None
    text: str

    model_config = {"from_attributes": True}


class RecordingDetail(BaseModel):
    id: uuid.UUID
    original_filename: str
    status: str
    storage_path: str
    size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    failure_stage: Optional[str] = None
    failure_message: Optional[str] = None
    summary: Optional[str] = None
    transcript_segments: list[TranscriptSegmentResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class RecordingUpdateRequest(BaseModel):
    original_filename: str = Field(min_length=1, max_length=500)


# ── Search ───────────────────────────────────────────────────────────────────


class TranscriptSearchResult(BaseModel):
    segment_id: uuid.UUID
    text: str
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None
    similarity: float


class TranscriptSearchResponse(BaseModel):
    query: str
    results: list[TranscriptSearchResult]
    total: int


# ── Status ───────────────────────────────────────────────────────────────────


class ProcessingJobResponse(BaseModel):
    id: uuid.UUID
    job_type: str
    status: str
    attempt_count: int
    model_config = {"from_attributes": True}


class RecordingStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    failure_stage: Optional[str] = None
    failure_message: Optional[str] = None
    processing_jobs: list[ProcessingJobResponse] = Field(default_factory=list)


# ── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"


class ReadyResponse(BaseModel):
    status: str
    database: str
    redis: str
