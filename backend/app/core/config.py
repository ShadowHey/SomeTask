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

    # JWT
    jwt_secret: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24  # 24 hours

    # Cloudflare R2
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "audio-notes"
    r2_public_url: str = ""  # Not used — bucket is private

    # Presigned URL lifetimes (seconds)
    upload_url_expiry: int = 900  # 15 minutes
    download_url_expiry: int = 3600  # 1 hour
    gnani_url_expiry: int = 7200  # 2 hours (Gnani needs time to download)

    # Gnani STT
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"
    gnani_model: str = "gnani-prisma-v2.5"
    gnani_poll_interval_seconds: int = 15
    gnani_max_poll_attempts: int = 720  # 3 hours at 15s intervals

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

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
