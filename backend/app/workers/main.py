"""ARQ worker configuration and entrypoint."""

from arq.connections import RedisSettings, create_pool
from arq.worker import Worker

from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.workers.tasks import generate_summary, process_transcription

logger = get_logger(__name__)

# Parse redis URL
redis_settings = RedisSettings.from_dsn(settings.redis_url)


async def startup(ctx: dict) -> None:
    """Worker startup hook."""
    setup_logging(debug=settings.debug)
    logger.info("arq_worker_starting", redis_url=settings.redis_url)


async def shutdown(ctx: dict) -> None:
    """Worker shutdown hook."""
    logger.info("arq_worker_shutting_down")


class WorkerSettings:
    """Configuration for ARQ worker process."""

    functions = [process_transcription, generate_summary]
    redis_settings = redis_settings
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 3600  # 1 hour max per job
    
    # Retry policy is handled in the tasks themselves using arq.Retry
    # because different stages have different delays (1m, 5m, 10m).
    # ARQ will retry if the task raises an exception, but doing it manually
    # with Retry(defer=...) allows fine-grained control over the delays.


# Helper to get a redis pool for enqueuing jobs from the web process
_redis_pool = None

async def get_redis_pool():  # type: ignore[no-untyped-def]
    """Get or create an ARQ Redis pool."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await create_pool(redis_settings)
    return _redis_pool
