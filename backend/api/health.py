"""Health endpoint for the backend.

Exposes the runtime status of the service and whether a snapshot is attached.
This is intentionally read-only and side-effect free.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.api.schemas import HealthResponse, SnapshotInfo
from backend.config import settings
from backend.db import SnapshotUnavailableError, get_connection

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    snapshot = SnapshotInfo(
        configured=settings.snapshot_path is not None,
        path=str(settings.snapshot_path) if settings.snapshot_path else None,
    )

    status = "ok"
    if settings.snapshot_path is not None:
        try:
            get_connection()
        except SnapshotUnavailableError:
            status = "degraded"

    return HealthResponse(
        status=status,
        service=settings.app_name,
        version=settings.api_version,
        snapshot=snapshot,
        timestamp=datetime.now(timezone.utc),
    )
