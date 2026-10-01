"""Application-level enums for status tracking."""

import enum


class AudioStatus(str, enum.Enum):
    """Status of an audio file through its lifecycle."""

    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    TRANSCRIPTION_CREATED = "transcription_created"
    TRANSCRIPTION_STARTING = "transcription_starting"
    TRANSCRIPTION_PROCESSING = "transcription_processing"
    TRANSCRIPTION_COMPLETED = "transcription_completed"
    TRANSCRIPTION_PARTIAL_FAILURE = "transcription_partial_failure"
    TRANSCRIPTION_FAILED = "transcription_failed"
    CANCELLED = "cancelled"

class SummaryStatus(str, enum.Enum):
    """Status of the AI summary."""
    NOT_REQUESTED = "not_requested"
    QUEUED = "queued"
    PROCESSING = "processing"
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
