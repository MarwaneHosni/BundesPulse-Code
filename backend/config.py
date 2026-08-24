"""Application configuration.

Settings are read from environment variables with sensible defaults so the
service runs out of the box, and can be pointed at a real snapshot later via
``BUNDESPULSE_SNAPSHOT``.

The snapshot path is resolved relative to the repository root so that both a
checked-out repo and a containerised deploy can locate it predictably.
"""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    # backend/config.py -> one level up is the repo root
    return Path(__file__).resolve().parents[1]


REPO_ROOT = _repo_root()


class Settings:
    """Runtime settings for the read-only backend."""

    def __init__(self) -> None:
        # Path to the immutable DuckDB snapshot. If unset, no DB is attached yet
        # and the service runs in a "snapshot not configured" health state.
        env_snapshot = os.environ.get("BUNDESPULSE_SNAPSHOT", "").strip()
        if env_snapshot:
            self.snapshot_path: Path | None = Path(env_snapshot).expanduser().resolve()
        else:
            default = REPO_ROOT / "data" / "snapshots" / "bundespulse.duckdb"
            self.snapshot_path: Path | None = default if default.exists() else None

        self.app_name = "bundespulse-api"
        self.api_version = "0.1.0"


settings = Settings()
