"""FastAPI application entry point.

Run with ``python -m backend.api.main`` (from the repository root) or via
``uvicorn backend.api.main:app``.
"""

from __future__ import annotations

from fastapi import FastAPI

from backend.api.health import router as health_router
from backend.config import settings

APP_DESCRIPTION = (
    "Read-only data intelligence API for Deutschland Digital Monitor. "
    "Serves a pre-computed, immutable regional statistics snapshot. "
    "No ingestion, no mutation, no authentication."
)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Deutschland Digital Monitor API",
        description=APP_DESCRIPTION,
        version=settings.api_version,
    )
    app.include_router(health_router, prefix="/api")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)
