"""Read-only DuckDB access.

This module is the single point of contact with the prepared snapshot. It
opens DuckDB strictly in ``read_only`` mode so that the backend can never
mutate the dataset, matching the product's immutable/precomputed-data model.

A single connection is created lazily and cached; all queries are SELECT-only.
"""

from __future__ import annotations

import duckdb

from backend.config import settings


class SnapshotUnavailableError(RuntimeError):
    """Raised when no snapshot is configured or the file is missing."""


def _open_connection() -> duckdb.DuckDBPyConnection:
    if settings.snapshot_path is None or not settings.snapshot_path.exists():
        raise SnapshotUnavailableError(
            "No DuckDB snapshot configured. This is expected before the data-build "
            "phase produces data/snapshots/bundespulse.duckdb. Point "
            "BUNDESPULSE_SNAPSHOT at a prepared snapshot to enable data queries."
        )
    # read_only=True guarantees the backend cannot write to the snapshot.
    return duckdb.connect(str(settings.snapshot_path), read_only=True)


_connection: duckdb.DuckDBPyConnection | None = None


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a shared read-only DuckDB connection, opening it lazily if needed."""
    global _connection
    if _connection is None:
        _connection = _open_connection()
    return _connection
