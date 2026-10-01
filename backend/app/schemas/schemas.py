"""Pydantic schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Upload ───────────────────────────────────────────────────────────────────

class UploadInitiateRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    file_size: int = Field(gt=0)
    mime_type: str
    language_code: str | None = Field(default="en-IN", max_length=50)


class UploadPartUrl(BaseModel):
    part_number: int
    url: str


class UploadInitiateResponse(BaseModel):
    audio_file_id: uuid.UUID
    upload_id: str
    object_key: str
    part_urls: list[UploadPartUrl]
    part_size: int


class UploadPartInfo(BaseModel):
    part_number: int
    etag: str


class UploadCompleteRequest(BaseModel):
    parts: list[UploadPartInfo]


class UploadCompleteResponse(BaseModel):
    audio_file_id: uuid.UUID
    status: str


# ── Recordings ───────────────────────────────────────────────────────────────

class RecordingListItem(BaseModel):
    id: uuid.UUID
    original_filename: str
    display_name: str
    size_bytes: int | None
    duration_seconds: float | None
    status: str
    language_code: str | None
    summary_preview: str | None = None
    created_at: datetime
    uploaded_at: datetime | None
    completed_at: datetime | None
    failure_stage: str | None
    failure_message: str | None

    model_config = {"from_attributes": True}


class RecordingDetail(BaseModel):
    id: uuid.UUID
    original_filename: str
    display_name: str
    size_bytes: int | None
    duration_seconds: float | None
    status: str
    language_code: str | None
    mime_type: str
    created_at: datetime
    uploaded_at: datetime | None
    completed_at: datetime | None
    failure_stage: str | None
    failure_code: str | None
    failure_message: str | None
    transcript_segments: list["TranscriptSegmentResponse"] = []
    summary: "SummaryResponse | None" = None

    model_config = {"from_attributes": True}


class RecordingUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=500)


class TranscriptSegmentResponse(BaseModel):
    id: uuid.UUID
    sequence: int
    start_ms: int | None
    end_ms: int | None
    text: str

    model_config = {"from_attributes": True}


class SummaryResponse(BaseModel):
    content: str | None
    provider: str
    model: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Search ───────────────────────────────────────────────────────────────────

class TranscriptSearchResult(BaseModel):
    segment_id: uuid.UUID
    text: str
    start_ms: int | None
    end_ms: int | None
    similarity: float


class TranscriptSearchResponse(BaseModel):
    query: str
    results: list[TranscriptSearchResult]
    total: int


# ── Status ───────────────────────────────────────────────────────────────────

class RecordingStatusResponse(BaseModel):
    audio_file_id: uuid.UUID
    status: str
    failure_stage: str | None
    failure_message: str | None
    processing_jobs: list["ProcessingJobResponse"] = []


class ProcessingJobResponse(BaseModel):
    id: uuid.UUID
    job_type: str
    status: str
    attempt_count: int
    last_error: str | None
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ── Audio URL ────────────────────────────────────────────────────────────────

class AudioUrlResponse(BaseModel):
    url: str
    expires_in: int


# ── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"


class ReadyResponse(BaseModel):
    status: str
    database: str
    redis: str
