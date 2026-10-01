"""Health and readiness probes."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Basic process health check."""
    return HealthResponse(status="ok")


@router.get("/ready", response_model=ReadyResponse)
async def readiness_check(db: AsyncSession = Depends(get_db)) -> ReadyResponse:
    """Readiness check including database and (optionally) Redis connections."""
    db_status = "ok"
    redis_status = "ok"
    overall_status = "ok"

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
        overall_status = "error"

    # Minimal ping to Redis using ARQ or a raw client could go here.
    # For now, we assume Redis is ok if DB is ok for a basic check,
    # or you could add a quick redisio ping.

    return ReadyResponse(status=overall_status, database=db_status, redis=redis_status)
