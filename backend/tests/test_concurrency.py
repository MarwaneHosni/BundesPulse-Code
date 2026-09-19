"""Concurrency regression: parallel API reads must never cross result sets.

The backend shares a single read-only DuckDB connection across FastAPI's
worker-thread pool. DuckDB connections are not thread-safe, so DB access is
serialized in ``backend.db.select_rows``. Without that guard, parallel requests
(what a real browser issues) corrupt each other's result sets -> KeyError
('levels') and spurious 404s. This test fires many concurrent requests and
requires every one to succeed.
"""

from __future__ import annotations

import threading
from collections import Counter

import pytest
from backend.api.main import app
from backend.config import settings
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    settings.snapshot_path is None,
    reason="no snapshot configured (build it with: python -m pipeline.build_data)",
)

# Mixed workload mirroring what the Explore / Region pages request in parallel.
URLS = [
    "/api/indicators",
    "/api/indicators/gdp_pc/periods?level=bundesland",
    "/api/rankings?indicator=gdp_pc&level=bundesland&order=desc&limit=500",
    "/api/regions?level=kreis",
    "/api/regions/09/profile",
    "/api/regions/09/narratives",
    "/api/compare?regions=09,08&indicator=gdp_pc",
    "/api/metadata",
]

THREADS = 5
ITERATIONS = 8


def test_parallel_reads_never_fail() -> None:
    results: Counter[int] = Counter()
    lock = threading.Lock()

    def worker() -> None:
        # Each thread gets its own client, but all share the app's single
        # cached DuckDB connection (the thing under test).
        client = TestClient(app)
        for _ in range(ITERATIONS):
            for url in URLS:
                status = client.get(url).status_code
                with lock:
                    results[status] += 1

    threads = [threading.Thread(target=worker) for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    total = sum(results.values())
    assert total == THREADS * ITERATIONS * len(URLS)
    assert set(results) == {200}, f"non-200 responses under concurrency: {dict(results)}"
