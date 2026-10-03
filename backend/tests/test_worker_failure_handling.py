"""Regression tests for worker failure handling.

Covers the production incident where a mis-ordered create_system_log call crashed
process_transcription, and the error handler then read ORM attributes after
db.rollback() (MissingGreenlet), leaving the job stuck as RUNNING forever.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from app.crud.logs import create_system_log
from app.models.enums import AudioStatus, JobStatus, JobType, LogLevel, LogStage
from app.services.transcription.gnani import ProviderError
from app.workers import tasks


class _Expirable:
    """Mimics an ORM instance: attribute reads after rollback() raise, like MissingGreenlet."""

    def __init__(self, **fields: Any) -> None:
        object.__setattr__(self, "_fields", dict(fields))
        object.__setattr__(self, "_expired", False)

    def __getattr__(self, name: str) -> Any:
        if object.__getattribute__(self, "_expired"):
            raise AssertionError(f"read expired attribute '{name}' after rollback")
        fields = object.__getattribute__(self, "_fields")
        if name in fields:
            return fields[name]
        raise AttributeError(name)

    def __setattr__(self, name: str, value: Any) -> None:
        self._fields[name] = value


class _FakeSession:
    def __init__(self, *tracked: _Expirable) -> None:
        self.tracked = tracked
        self.rolled_back = False

    async def __aenter__(self) -> _FakeSession:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    def add(self, obj: object) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        self.rolled_back = True
        for obj in self.tracked:
            object.__setattr__(obj, "_expired", True)

    async def execute(self, *_: object, **__: object) -> Any:
        return SimpleNamespace(scalar_one_or_none=lambda: None)


def _make_note_and_job(job_status: str, updated_at: datetime) -> tuple[_Expirable, _Expirable]:
    note_id = uuid.uuid4()
    job = _Expirable(
        id=uuid.uuid4(),
        note_id=note_id,
        job_type=JobType.TRANSCRIPTION.value,
        status=job_status,
        attempt_count=1,
        provider_job_id=None,
        raw_provider_response=None,
        updated_at=updated_at,
    )
    note = _Expirable(
        id=note_id,
        user_id=uuid.uuid4(),
        status=AudioStatus.TRANSCRIPTION_CREATED.value,
        storage_path="user/file.mp3",
        transcription_config={},
        recording_name="meet1",
        original_filename="meet1.mp3",
        processing_jobs=[job],
    )
    return note, job


@pytest.fixture
def wire(monkeypatch: pytest.MonkeyPatch):  # type: ignore[no-untyped-def]
    """Patch the task's collaborators and record _handle_job_failure calls."""

    def _wire(note: _Expirable, job: _Expirable, *, storage_error: Exception | None = None):  # type: ignore[no-untyped-def]
        session = _FakeSession(note, job)
        failures: list[dict[str, Any]] = []

        async def fake_load(db: object, note_id: uuid.UUID) -> _Expirable:
            return note

        async def fake_failure(db, note_id, job_id, attempt, stage, error, retryable):  # type: ignore[no-untyped-def]
            failures.append(
                {"note_id": note_id, "job_id": job_id, "stage": stage, "error": error, "retryable": retryable}
            )

        def fake_signed_url(path: str) -> str:
            if storage_error:
                raise storage_error
            return "https://storage.test/signed"

        monkeypatch.setattr(tasks, "async_session_factory", lambda: session)
        monkeypatch.setattr(tasks, "_load_note_for_transcription", fake_load)
        monkeypatch.setattr(tasks, "_handle_job_failure", fake_failure)
        monkeypatch.setattr(tasks, "_signed_url_for_path", fake_signed_url)
        monkeypatch.setattr(tasks, "GnaniTranscriptionProvider", lambda api_key=None: object())
        return session, failures

    return _wire


async def test_storage_failure_is_retried_without_touching_expired_orm_state(wire) -> None:  # type: ignore[no-untyped-def]
    note, job = _make_note_and_job(JobStatus.PENDING.value, datetime.now(timezone.utc))
    expected_note_id, expected_job_id = note.id, job.id
    session, failures = wire(note, job, storage_error=FileNotFoundError("missing object"))

    await tasks.process_transcription({"job_try": 1}, expected_note_id)

    assert session.rolled_back is True
    assert len(failures) == 1, "failure must be handled exactly once (no double handling)"
    failure = failures[0]
    assert failure["note_id"] == expected_note_id
    assert failure["job_id"] == expected_job_id
    assert failure["stage"] == "transcription"
    assert failure["retryable"] is True
    assert isinstance(failure["error"], ProviderError)
    assert "FileNotFoundError" in str(failure["error"])


async def test_fresh_running_job_is_skipped_as_duplicate(wire) -> None:  # type: ignore[no-untyped-def]
    note, job = _make_note_and_job(JobStatus.RUNNING.value, datetime.now(timezone.utc))
    session, failures = wire(note, job)

    await tasks.process_transcription({"job_try": 1}, note.id)

    assert note.status == AudioStatus.TRANSCRIPTION_CREATED.value  # untouched
    assert failures == []
    assert session.rolled_back is False


async def test_stale_running_job_is_reclaimed(wire) -> None:  # type: ignore[no-untyped-def]
    stale = datetime.now(timezone.utc) - timedelta(seconds=tasks.WORKER_JOB_TIMEOUT_SECONDS + 600)
    note, job = _make_note_and_job(JobStatus.RUNNING.value, stale)
    # Fail fast at the storage step: proves the task proceeded past the duplicate guard.
    _, failures = wire(note, job, storage_error=RuntimeError("boom"))

    await tasks.process_transcription({"job_try": 1}, note.id)

    assert len(failures) == 1
    assert failures[0]["retryable"] is True


def test_stale_detection_boundaries() -> None:
    now = datetime.now(timezone.utc)
    assert tasks._is_stale_running_job(SimpleNamespace(updated_at=now)) is False
    assert tasks._is_stale_running_job(SimpleNamespace(updated_at=None)) is False
    old = now - timedelta(seconds=tasks.WORKER_JOB_TIMEOUT_SECONDS + 301)
    assert tasks._is_stale_running_job(SimpleNamespace(updated_at=old)) is True


async def test_create_system_log_rejects_positional_arguments() -> None:
    with pytest.raises(TypeError):
        await create_system_log(  # type: ignore[misc]
            object(), uuid.uuid4(), uuid.uuid4(), LogLevel.INFO, LogStage.TRANSCRIPTION, "msg"
        )


def test_worker_registers_webhook_completion_task() -> None:
    from app.workers.main import WorkerSettings

    names = {fn.__name__ for fn in WorkerSettings.functions}
    assert "process_completed_transcription" in names
    assert WorkerSettings.job_timeout == tasks.WORKER_JOB_TIMEOUT_SECONDS
