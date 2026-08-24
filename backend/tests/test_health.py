"""Tests for the health endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "bundespulse-api"
    assert body["version"] == "0.1.0"
    assert "timestamp" in body


def test_health_reports_snapshot_state(client: TestClient) -> None:
    resp = client.get("/api/health")
    body = resp.json()
    assert "snapshot" in body
    assert "configured" in body["snapshot"]
    assert "path" in body["snapshot"]


def test_health_is_read_only_helper(client: TestClient) -> None:
    """Sanity guard: only GET-style routes exist in the system namespace."""
    resp = client.post("/api/health")
    assert resp.status_code in (405, 404)
