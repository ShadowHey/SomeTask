"""Gemini summarization provider adapter."""

from typing import Protocol

from google import genai
from google.genai.errors import APIError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SummaryProviderError(Exception):
    """Exception raised for summary provider errors."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class SummaryProvider(Protocol):
    async def summarize(self, transcript_text: str) -> str:
        """Generate a summary from transcript text."""
        ...


class GeminiSummaryProvider:
    """Adapter for Google Gemini summarization."""

    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        
        # We don't initialize the client until needed to avoid
        # startup errors if the key isn't provided (e.g. during tests/build)

    async def summarize(self, transcript_text: str) -> str:
        """Generate a summary using Gemini Flash."""
        if not transcript_text.strip():
            return "No transcription available."

        if not self.api_key:
            logger.warning("gemini_api_key_missing", action="mock_summary")
            return "Summarization is disabled because the Gemini API key is missing. This is a mocked summary for the Audio Notes Platform."

        try:
            # Using the new Google GenAI SDK
            client = genai.Client(api_key=self.api_key)
            
            prompt = (
                "You are a helpful assistant. Please provide a concise, well-structured summary "
                "of the following transcript. Capture the main points, key decisions, and any action items.\n\n"
                f"Transcript:\n{transcript_text}"
            )

            # Note: the new genai SDK has async methods on the client.aio object
            response = await client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            
            if response.text:
                return response.text
            else:
                raise SummaryProviderError("Gemini returned an empty response", retryable=True)
                
        except APIError as e:
            # Determine if retryable based on status code (429, 500, 503 are usually retryable)
            retryable = False
            error_message = str(e).lower()
            if "429" in error_message or "500" in error_message or "503" in error_message:
                retryable = True
                
            raise SummaryProviderError(f"Gemini API error: {e}", retryable=retryable)
        except Exception as e:
            # Catch network errors and other unexpected exceptions
            raise SummaryProviderError(f"Unexpected error during summarization: {e}", retryable=True)
