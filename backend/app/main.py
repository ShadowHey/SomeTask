"""FastAPI application initialization and routing."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, profiles, recordings, tags, usage, webhooks
from app.core.config import settings
from app.core.logging import get_logger, setup_logging

# Setup structured logging
setup_logging(debug=settings.debug)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan events."""
    logger.info("application_startup", name=settings.app_name)
    yield
    logger.info("application_shutdown", name=settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(profiles.router, prefix="/api/profile")
app.include_router(recordings.router, prefix="/api/recordings")
app.include_router(tags.router, prefix="/api/tags")
app.include_router(usage.router, prefix="/api/usage")
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
