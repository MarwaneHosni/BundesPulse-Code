"""Pydantic response models shared across the API.

Models are intentionally minimal for the foundation phase. Domain models
(indicator, region, observation, ranking, relationship) are specified in
docs/product-spec.md §8 and will be added in a later phase.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SnapshotInfo(BaseModel):
    configured: bool
    path: str | None = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    snapshot: SnapshotInfo
    timestamp: datetime
