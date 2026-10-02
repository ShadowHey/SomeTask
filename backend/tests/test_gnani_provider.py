"""Contract tests for Gnani's documented Batch HTTP workflow."""

import httpx
import pytest

from app.services.transcription.gnani import GnaniTranscriptionProvider, ProviderError


@pytest.mark.asyncio
async def test_batch_provider_uses_create_start_poll_files_download_flow() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        route = request.url.path
        if route.endswith("/jobs"):
            return httpx.Response(201, json={"job_id": "job-123", "status": "CREATED"})
        if route.endswith("/start"):
            return httpx.Response(202, json={"status": "STARTING"})
        if route.endswith("/files"):
            return httpx.Response(
                200, json={"data": [{"transcript_url": "https://transcripts.test/a"}]}
            )
        if route.endswith("/job-123"):
            return httpx.Response(200, json={"status": "COMPLETED"})
        if request.url.host == "transcripts.test":
            return httpx.Response(200, json={"full_transcript": "hello", "segments": []})
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")
    provider = GnaniTranscriptionProvider(transport=httpx.MockTransport(handler))
    job_id = await provider.create_job("https://storage.test/audio.mp3", {"language_code": "hi-IN,en-IN"})
    await provider.start_job(job_id)
    assert (await provider.poll_status(job_id))["status"] == "COMPLETED"
    assert (await provider.get_files(job_id))[0]["transcript_url"] == "https://transcripts.test/a"
    assert (await provider.download_transcript("https://transcripts.test/a"))[
        "full_transcript"
    ] == "hello"

    create_payload = __import__("json").loads(requests[0].content)
    assert [request.method for request in requests] == ["POST", "POST", "GET", "GET", "GET"]
    assert create_payload["source"]["type"] == "cloud_storage"
    assert create_payload["config"]["language_code"] == "hi-IN,en-IN"
    assert requests[-1].headers.get("X-API-Key-ID") is None


@pytest.mark.asyncio
async def test_rate_limit_is_classified_as_retryable() -> None:
    provider = GnaniTranscriptionProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(429, json={"code": "rate_limit"})
        )
    )

    with pytest.raises(ProviderError) as error:
        await provider.poll_status("job-123")

    assert error.value.retryable is True
    assert error.value.error_code == "rate_limit"


@pytest.mark.asyncio
async def test_auth_failure_is_not_retried() -> None:
    provider = GnaniTranscriptionProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(403, json={"error": "forbidden"})
        )
    )

    with pytest.raises(ProviderError) as error:
        await provider.start_job("job-123")

    assert error.value.retryable is False
    assert error.value.error_code == "auth_failed"
