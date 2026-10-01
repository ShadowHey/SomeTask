"""Application-level enums for status tracking."""

import enum


class AudioStatus(str, enum.Enum):
    """Status of an audio file through its lifecycle.

    Valid transitions:
        CREATED -> UPLOADING -> UPLOADED -> QUEUED -> TRANSCRIBING -> SUMMARIZING -> COMPLETED
        Any state -> FAILED
        Any state -> DELETED
    """

    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


# Explicit valid transitions — anything not listed here is illegal.
VALID_TRANSITIONS: dict[AudioStatus, set[AudioStatus]] = {
    AudioStatus.CREATED: {AudioStatus.UPLOADING, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.UPLOADING: {AudioStatus.UPLOADED, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.UPLOADED: {AudioStatus.QUEUED, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.QUEUED: {AudioStatus.TRANSCRIBING, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.TRANSCRIBING: {AudioStatus.SUMMARIZING, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.SUMMARIZING: {AudioStatus.COMPLETED, AudioStatus.FAILED, AudioStatus.DELETED},
    AudioStatus.COMPLETED: {AudioStatus.DELETED},
    AudioStatus.FAILED: {AudioStatus.QUEUED, AudioStatus.DELETED},  # Allow retry from failed
    AudioStatus.DELETED: set(),  # Terminal
}


def is_valid_transition(current: AudioStatus, target: AudioStatus) -> bool:
    """Check if a status transition is allowed."""
    return target in VALID_TRANSITIONS.get(current, set())


class JobType(str, enum.Enum):
    """Types of processing jobs."""

    TRANSCRIPTION = "transcription"
    SUMMARY = "summary"
    CHUNK_TRANSCRIPTION = "chunk_transcription"


class JobStatus(str, enum.Enum):
    """Status of a processing job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SummaryStatus(str, enum.Enum):
    """Status of a summary."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
