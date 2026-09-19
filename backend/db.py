"""Read-only DuckDB access.

This module is the single point of contact with the prepared snapshot. It
opens DuckDB strictly in ``read_only`` mode so that the backend can never
mutate the dataset, matching the product's immutable/precomputed-data model.

A single connection is created lazily and cached. FastAPI runs synchronous
endpoints in a worker-thread pool, and DuckDB connections are **not**
thread-safe, so every query is executed atomically under a lock (see
``select_rows``). All queries are SELECT-only.
"""

from __future__ import annotations

import threading

import duckdb

from backend.config import settings


class SnapshotUnavailableError(RuntimeError):
    """Raised when no snapshot is configured or the file is missing."""


# The shared connection is used by many worker threads concurrently; this lock
# makes each execute/description/fetchall sequence atomic. Without it, parallel
# requests cross result sets (wrong columns/rows -> KeyError, spurious 404s).
_LOCK = threading.Lock()

_connection: duckdb.DuckDBPyConnection | None = None


def _open_connection() -> duckdb.DuckDBPyConnection:
    if settings.snapshot_path is None or not settings.snapshot_path.exists():
        raise SnapshotUnavailableError(
            "No DuckDB snapshot configured. Build it with: python -m pipeline.build_data "
            "or point BUNDESPULSE_SNAPSHOT at a prepared snapshot."
        )
    # read_only=True guarantees the backend cannot write to the snapshot.
    return duckdb.connect(str(settings.snapshot_path), read_only=True)


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return a shared read-only DuckDB connection, opening it lazily if needed."""
    global _connection
    if _connection is None:
        with _LOCK:
            if _connection is None:
                _connection = _open_connection()
    return _connection


def select_rows(
    conn: duckdb.DuckDBPyConnection, sql: str, params: list | None = None
) -> list[dict]:
    """Run a read-only query and return rows as dicts.

    Executed under a lock because the connection is shared across FastAPI's
    worker threads and DuckDB connections are not thread-safe: the
    ``execute``/``description``/``fetchall`` trio must not be interleaved.
    """
    with _LOCK:
        cur = conn.execute(sql, params or [])
        columns = [c[0] for c in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]
