"""FastAPI application entry point.

Run with ``python -m backend.api.main`` (from the repository root) or via
``uvicorn backend.api.main:app``.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.data import router as data_router
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
    # Read-only, public data: allow cross-origin GETs so a separately hosted
    # frontend (e.g. Vercel) can read the API directly.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(data_router, prefix="/api")
    return app


app = create_app()


if __name__ == "__main__":
    import os
    import sys

    import uvicorn

    # Auto-reload is opt-in: uvicorn's reloader restarts the worker on every
    # file change, which on Windows briefly drops the socket and shows up as
    # transient 500/404s in the browser. Enable with: BUNDESPULSE_RELOAD=1
    reload = os.environ.get("BUNDESPULSE_RELOAD", "").strip().lower() in {"1", "true", "yes"}
    print(
        f"[bundespulse] API - python={sys.executable} - reload={reload} - "
        f"snapshot={settings.snapshot_path}",
        flush=True,
    )
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=reload)
