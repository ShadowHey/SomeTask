"""Service for handling Ask AI requests."""

from google import genai
from google.genai.errors import APIError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AskAIServiceError(Exception):
    pass


class AskAIService:
    def __init__(self) -> None:
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model

    async def ask_question(self, transcript_text: str, question: str) -> str:
        """Answer a question based on the transcript using Gemini."""
        if not transcript_text.strip():
            return "No transcription available to answer questions."

        if not self.api_key:
            raise AskAIServiceError("Gemini API key is not configured")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                client = genai.Client(api_key=self.api_key)
                
                prompt = (
                    "You are an AI assistant analyzing a specific audio transcript. "
                    "Answer the user's questions strictly based on the following transcript. "
                    "If the answer is not in the transcript, say so politely.\n\n"
                    f"Transcript:\n{transcript_text}\n\n"
                    f"User Question: {question}"
                )

                response = await client.aio.models.generate_content(
                    model=self.model,
                    contents=prompt,
                )

                if response.text:
                    return response.text
                else:
                    raise AskAIServiceError("Gemini returned an empty response")

            except APIError as e:
                if "503" in str(e) and attempt < max_retries - 1:
                    logger.warning(f"Gemini API 503 error, retrying attempt {attempt + 1}/{max_retries}...")
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                logger.error(f"Gemini API error during Ask AI: {e}")
                raise AskAIServiceError(f"Gemini API error: {e}") from e
            except Exception as e:
                logger.error(f"Unexpected error during Ask AI: {e}")
                raise AskAIServiceError(f"Unexpected error: {e}") from e
