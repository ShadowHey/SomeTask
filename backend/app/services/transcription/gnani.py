"""Gnani Batch STT provider adapter."""

from __future__ import annotations

from typing import Protocol

import asyncio
import httpx

from app.core.config import settings


class ProviderError(Exception):
    """A classified provider error for the worker's retry policy."""

    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        error_code: str | None = None,
        response_data: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.error_code = error_code
        self.response_data = response_data


class TranscriptionProvider(Protocol):
    """Application boundary for an asynchronous transcription provider."""

    async def create_job(self, audio_url: str, config: dict, callback_url: str | None = None) -> str: ...

    async def start_job(self, job_id: str) -> None: ...

    async def poll_status(self, job_id: str) -> dict[str, object]: ...

    async def get_files(self, job_id: str) -> list[dict[str, object]]: ...

    async def download_transcript(self, transcript_url: str) -> dict[str, object]: ...


class GnaniTranscriptionProvider:
    """HTTP implementation of Gnani's Create → Start → Poll → Files flow."""

    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: httpx.Timeout | None = None,
    ) -> None:
        self.base_url = settings.gnani_base_url.rstrip("/")
        self.api_key = settings.gnani_api_key
        self.model = settings.gnani_model
        self.transport = transport
        self.timeout = timeout or httpx.Timeout(30.0, connect=10.0)

    @property
    def _headers(self) -> dict[str, str]:
        return {"X-API-Key-ID": self.api_key, "Content-Type": "application/json"}

    def _client(self, *, timeout: httpx.Timeout | None = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=self.transport, timeout=timeout or self.timeout)

    async def create_job(self, audio_url: str, config: dict, callback_url: str | None = None) -> str:
        """Create a batch job with an R2/S3-compatible presigned source URL."""
        batch_config = {"model": self.model, **config}
        payload = {
            "config": batch_config,
            "source": {
                "type": "cloud_storage",
                "auth": {"mode": "public"},
                "paths": [audio_url],
            },
        }
        if callback_url:
            payload["callback_url"] = callback_url

        data = await self._request_json(
            "POST",
            "/stt/v3/batch/jobs",
            json=payload,
        )
        job_id = data.get("job_id")
        if not isinstance(job_id, str) or not job_id:
            raise ProviderError(
                "Gnani create-job response contained no job ID", retryable=True, response_data=data
            )
        return job_id

    async def start_job(self, job_id: str) -> None:
        """Start a previously created job; creation alone does not process audio."""
        await self._request_json("POST", f"/stt/v3/batch/jobs/{job_id}/start")

    async def poll_status(self, job_id: str) -> dict[str, object]:
        """Read the status for a Gnani job."""
        return await self._request_json("GET", f"/stt/v3/batch/jobs/{job_id}")

    async def get_files(self, job_id: str) -> list[dict[str, object]]:
        """Return Gnani's completed-file records, including temporary transcript URLs."""
        data = await self._request_json("GET", f"/stt/v3/batch/jobs/{job_id}/files")
        files = data.get("data")
        if not isinstance(files, list):
            raise ProviderError(
                "Gnani files response was malformed", retryable=True, response_data=data
            )
        return [file for file in files if isinstance(file, dict)]

    async def download_transcript(self, transcript_url: str) -> dict[str, object]:
        """Download the expiring transcript JSON immediately after completion."""
        return await self._request_json(
            "GET", transcript_url, include_auth=False, timeout=httpx.Timeout(60.0, connect=10.0)
        )

    async def _request_json(
        self,
        method: str,
        path_or_url: str,
        *,
        json: dict[str, object] | None = None,
        include_auth: bool = True,
        timeout: httpx.Timeout | None = None,
    ) -> dict[str, object]:
        url = path_or_url if path_or_url.startswith("http") else f"{self.base_url}{path_or_url}"
        headers = self._headers if include_auth else None
        response = None
        for attempt in range(5):
            try:
                async with self._client(timeout=timeout) as client:
                    response = await client.request(method, url, headers=headers, json=json)
            except httpx.TimeoutException as error:
                raise ProviderError(
                    "Gnani request timed out", retryable=True, error_code="timeout"
                ) from error
            except httpx.RequestError as error:
                raise ProviderError(
                    "Gnani request failed", retryable=True, error_code="network"
                ) from error

            if response.status_code == 429 and attempt < 4:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            break

        if response is None:
            raise ProviderError("Gnani request produced no response", retryable=True)

        data = _json_response(response)
        if response.status_code in {401, 403}:
            raise ProviderError(
                "Gnani authentication failed", error_code="auth_failed", response_data=data
            )
        if response.status_code == 429:
            raise ProviderError(
                "Gnani rate limit reached",
                retryable=True,
                error_code="rate_limit",
                response_data=data,
            )
        if response.status_code in {500, 502, 503, 504}:
            raise ProviderError(
                f"Gnani temporary server error ({response.status_code})",
                retryable=True,
                error_code=f"http_{response.status_code}",
                response_data=data,
            )
        if response.status_code >= 400:
            error_code = str(data.get("error_code", "bad_request"))
            raise ProviderError(
                f"Gnani rejected the request ({response.status_code})",
                error_code=error_code,
                response_data=data,
            )
        return data


def _json_response(response: httpx.Response) -> dict[str, object]:
    try:
        data = response.json()
    except ValueError as error:
        raise ProviderError(
            "Gnani returned invalid JSON", retryable=True, error_code="invalid_json"
        ) from error
    if not isinstance(data, dict):
        raise ProviderError(
            "Gnani returned an unexpected JSON shape", retryable=True, error_code="invalid_json"
        )
    return data
