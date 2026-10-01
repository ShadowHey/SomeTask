"""Application-level enums for status tracking."""

import enum


class AudioStatus(str, enum.Enum):
    """Status of an audio file through its lifecycle."""

    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, enum.Enum):
    """Types of processing jobs."""

    TRANSCRIPTION = "transcription"
    SUMMARY = "summary"


class JobStatus(str, enum.Enum):
    """Status of a processing job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
