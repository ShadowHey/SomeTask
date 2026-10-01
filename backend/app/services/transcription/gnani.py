"""Gnani Speech-to-Text provider adapter."""

from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class ProviderError(Exception):
    """Exception raised for external provider errors."""

    def __init__(
        self, message: str, retryable: bool = False, error_code: str | None = None, response_data: dict | None = None
    ):
        super().__init__(message)
        self.retryable = retryable
        self.error_code = error_code
        self.response_data = response_data


class TranscriptionProvider(Protocol):
    async def create_job(self, audio_url: str, language_code: str) -> str:
        """Create a transcription job and return the job ID."""
        ...

    async def start_job(self, job_id: str) -> None:
        """Start the created job."""
        ...

    async def poll_status(self, job_id: str) -> dict[str, Any]:
        """Poll the job status. Returns status dict."""
        ...
        
    async def get_files(self, job_id: str) -> list[dict[str, Any]]:
        """Get file list for a completed job."""
        ...

    async def download_transcript(self, transcript_url: str) -> dict[str, Any]:
        """Download the transcript from the provider's URL."""
        ...


class GnaniTranscriptionProvider:
    """Adapter for Gnani STT Batch API."""

    def __init__(self) -> None:
        self.base_url = settings.gnani_base_url
        self.api_key = settings.gnani_api_key
        self.model = settings.gnani_model
        
    @property
    def _headers(self) -> dict[str, str]:
        return {
            "X-API-Key-ID": self.api_key,
            "Content-Type": "application/json",
        }

    async def create_job(self, audio_url: str, language_code: str) -> str:
        """Create a Gnani Batch STT job using a presigned R2 URL."""
        url = f"{self.base_url}/stt/v3/batch/jobs"
        payload = {
            "config": {
                "model": self.model,
                "language_code": language_code or "en-IN",
                "mode": "transcribe",
                "with_diarization": False,
                "is_multi_channel": False,
                "with_denoise": False,
            },
            "source": {
                "type": "cloud_storage",
                "auth": {"mode": "public"},
                "paths": [audio_url],
            },
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self._headers, json=payload, timeout=30.0)
            except httpx.RequestError as e:
                raise ProviderError(f"Network error: {e}", retryable=True)

            if response.status_code in (401, 403):
                raise ProviderError("Authentication failed with Gnani", retryable=False, error_code="auth_failed")
            if response.status_code == 429:
                raise ProviderError("Rate limited by Gnani", retryable=True, error_code="rate_limit")
            if response.status_code >= 500:
                raise ProviderError(f"Gnani server error: {response.status_code}", retryable=True)
            if response.status_code >= 400:
                data = response.json() if response.content else {}
                # Documented long audio error
                if data.get("error_code") == "AUDIO_TOO_LONG":
                    raise ProviderError("Audio exceeds Gnani maximum length", retryable=False, error_code="AUDIO_TOO_LONG", response_data=data)
                raise ProviderError(f"Bad request to Gnani: {response.text}", retryable=False, response_data=data)

            data = response.json()
            return data["job_id"]

    async def start_job(self, job_id: str) -> None:
        """Start the created job."""
        url = f"{self.base_url}/stt/v3/batch/jobs/{job_id}/start"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=self._headers, timeout=30.0)
            except httpx.RequestError as e:
                raise ProviderError(f"Network error: {e}", retryable=True)

            if response.status_code >= 500:
                raise ProviderError(f"Gnani server error: {response.status_code}", retryable=True)
            if response.status_code >= 400:
                data = response.json() if response.content else {}
                raise ProviderError(f"Failed to start job: {response.text}", retryable=False, response_data=data)

    async def poll_status(self, job_id: str) -> dict[str, Any]:
        """Poll the job status."""
        url = f"{self.base_url}/stt/v3/batch/jobs/{job_id}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self._headers, timeout=30.0)
            except httpx.RequestError as e:
                raise ProviderError(f"Network error: {e}", retryable=True)
                
            if response.status_code >= 500:
                raise ProviderError(f"Gnani server error: {response.status_code}", retryable=True)
            if response.status_code >= 400:
                raise ProviderError(f"Failed to poll job: {response.text}", retryable=False)
                
            return response.json()

    async def get_files(self, job_id: str) -> list[dict[str, Any]]:
        """Get file list for a completed job."""
        url = f"{self.base_url}/stt/v3/batch/jobs/{job_id}/files"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self._headers, timeout=30.0)
            except httpx.RequestError as e:
                raise ProviderError(f"Network error: {e}", retryable=True)
                
            if response.status_code >= 500:
                raise ProviderError(f"Gnani server error: {response.status_code}", retryable=True)
            if response.status_code >= 400:
                raise ProviderError(f"Failed to get files: {response.text}", retryable=False)
                
            return response.json().get("files", [])

    async def download_transcript(self, transcript_url: str) -> dict[str, Any]:
        """Download the transcript from the provider's URL."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(transcript_url, timeout=60.0)
            except httpx.RequestError as e:
                raise ProviderError(f"Network error downloading transcript: {e}", retryable=True)
                
            if response.status_code >= 500:
                raise ProviderError(f"Server error downloading transcript: {response.status_code}", retryable=True)
            if response.status_code >= 400:
                raise ProviderError(f"Failed to download transcript: {response.text}", retryable=False)
                
            return response.json()
