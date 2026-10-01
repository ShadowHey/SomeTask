"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration. All secrets come from environment variables."""

    # Application
    app_name: str = "Audio Notes Platform"
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/audio_notes"

    # Redis (for ARQ)
    redis_url: str = "redis://localhost:6379"

    # Supabase Configuration
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket_name: str = "audio-files"

    # Presigned URL lifetimes (seconds)
    upload_url_expiry: int = 900  # 15 minutes
    download_url_expiry: int = 3600  # 1 hour
    gnani_url_expiry: int = 7200  # 2 hours (Gnani needs time to download)

    # Gnani STT
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"
    gnani_model: str = "gnani-prisma-v2.5"
    # Gnani documents a 10-second minimum. Thirty seconds leaves a safe buffer
    # after /start and avoids rate limiting under normal single-file usage.
    gnani_poll_interval_seconds: int = 30
    gnani_max_poll_attempts: int = 360  # 3 hours at 30-second intervals
    # Batch language resolution is per file. hi-IN,en-IN is appropriate for the
    # supplied Hinglish sample, but does not promise segment-level code switching.
    gnani_default_language_code: str = "hi-IN,en-IN"
    
    # Webhook
    gnani_webhook_url: str = ""

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    # Audio constraints
    max_file_size_bytes: int = 5 * 1024 * 1024 * 1024  # 5 GB
    max_duration_minutes: int = 300
    min_duration_minutes: int = 2
    gnani_max_duration_hours: int = 4
    # Chunk duration for files exceeding Gnani's limit (conservative: 3.5 hours)
    chunk_duration_hours: float = 3.5

    # Supported audio formats (from Gnani docs)
    allowed_extensions: list[str] = [".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"]
    allowed_mime_types: list[str] = [
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "audio/flac",
        "audio/aac",
        "audio/mp4",
        "audio/x-m4a",
    ]

    # Multipart upload
    upload_part_size: int = 10 * 1024 * 1024  # 10 MB parts

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


# Singleton
settings = Settings()
