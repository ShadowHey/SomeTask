"""Tests for the worker's rate-limit-safe polling behavior."""

from unittest.mock import AsyncMock

import pytest

from app.workers import tasks


class FakeProvider:
    def __init__(self, statuses: list[str]) -> None:
        self.statuses = statuses
        self.calls = 0

    async def poll_status(self, job_id: str) -> dict[str, str]:
        self.calls += 1
        return {"status": self.statuses.pop(0)}


@pytest.mark.asyncio
async def test_first_poll_waits_before_contacting_gnani(monkeypatch: pytest.MonkeyPatch) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(tasks.asyncio, "sleep", sleep)

    await tasks._wait_before_first_poll(tasks.uuid.uuid4(), "job-123")

    sleep.assert_awaited_once_with(tasks.settings.gnani_poll_interval_seconds)


@pytest.mark.asyncio
async def test_polling_waits_between_non_terminal_statuses(monkeypatch: pytest.MonkeyPatch) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(tasks.asyncio, "sleep", sleep)
    provider = FakeProvider(["QUEUED", "IN_PROGRESS", "COMPLETED"])

    await tasks._wait_for_gnani_completion(provider, "job-123", None)

    assert provider.calls == 3
    assert sleep.await_count == 2


@pytest.mark.asyncio
async def test_existing_status_is_reused_without_an_immediate_second_poll(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep = AsyncMock()
    monkeypatch.setattr(tasks.asyncio, "sleep", sleep)
    provider = FakeProvider(["COMPLETED"])

    await tasks._wait_for_gnani_completion(provider, "job-123", {"status": "COMPLETED"})

    assert provider.calls == 0
    sleep.assert_not_awaited()
