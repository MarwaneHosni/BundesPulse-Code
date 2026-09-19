"""Tests for the rule-based narrative engine (skipped without a built snapshot)."""

from __future__ import annotations

import pytest
from backend.config import settings
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    settings.snapshot_path is None,
    reason="no snapshot configured (build it with: python -m pipeline.build_data)",
)


def test_narratives_bayern(client: TestClient) -> None:
    resp = client.get("/api/regions/09/narratives")
    assert resp.status_code == 200
    body = resp.json()
    assert body["region_id"] == "09"
    statements = body["statements"]
    assert statements, "expected rule-based statements"
    # ids are unique and texts are non-empty German strings with real numbers
    ids = [s["id"] for s in statements]
    assert len(ids) == len(set(ids))
    assert all(s["text"].strip() for s in statements)
    texts = " ".join(s["text"] for s in statements)
    # actual Bayern values (population 2024 growth vs DE) must appear
    assert "0,55" in texts
    assert "schneller" in texts or "langsamer" in texts


def test_narratives_ranked_and_limited(client: TestClient) -> None:
    resp = client.get("/api/regions/09/narratives")
    body = resp.json()
    assert len(body["statements"]) <= 6


def test_narratives_bund(client: TestClient) -> None:
    body = client.get("/api/regions/DE/narratives").json()
    texts = " ".join(s["text"] for s in body["statements"])
    assert "Deutschland" in texts
    assert "83.577.140" in texts  # real DE population 2024


def test_narratives_kreis(client: TestClient) -> None:
    body = client.get("/api/regions/09162/narratives").json()
    texts = " ".join(s["text"] for s in body["statements"])
    assert "Arbeitslosenquote" in texts
    assert "400" in texts  # rank context across all Kreise


def test_narratives_unknown_region_404(client: TestClient) -> None:
    assert client.get("/api/regions/XX/narratives").status_code == 404
