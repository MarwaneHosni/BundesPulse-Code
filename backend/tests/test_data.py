"""Tests for the read-only data endpoints (skipped without a built snapshot)."""

from __future__ import annotations

import pytest
from backend.config import settings
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    settings.snapshot_path is None,
    reason="no snapshot configured (build it with: python -m pipeline.build_data)",
)


def test_regions_list(client: TestClient) -> None:
    resp = client.get("/api/regions")
    assert resp.status_code == 200
    regions = resp.json()
    assert isinstance(regions, list) and len(regions) >= 400
    first = regions[0]
    assert {"region_id", "name", "type", "parent_id", "area"} <= set(first)


def test_regions_level_filter(client: TestClient) -> None:
    regions = client.get("/api/regions?level=bundesland").json()
    assert len(regions) == 16
    assert all(r["type"] == "bundesland" for r in regions)


def test_region_by_id(client: TestClient) -> None:
    resp = client.get("/api/regions/09")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Bayern"


def test_region_unknown_returns_404(client: TestClient) -> None:
    assert client.get("/api/regions/XX").status_code == 404


def test_indicators(client: TestClient) -> None:
    resp = client.get("/api/indicators")
    assert resp.status_code == 200
    inds = resp.json()
    slugs = {i["slug"] for i in inds}
    assert len(inds) >= 10
    assert {"pop_total", "gdp_pc", "unemp_rate"} <= slugs
    sample = next(i for i in inds if i["slug"] == "gdp_pc")
    assert sample["category"] == "Economy"
    assert sample["latest_period"] >= 2024


def test_region_profile(client: TestClient) -> None:
    resp = client.get("/api/regions/09/profile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["region"]["name"] == "Bayern"
    assert "kpis" in body and "trends" in body
    assert any(k["slug"] == "gdp_pc" for k in body["kpis"])


def test_region_insights(client: TestClient) -> None:
    resp = client.get("/api/regions/09/insights")
    assert resp.status_code == 200
    insights = resp.json()
    assert insights and all("yoy_pct" in i for i in insights)
    assert all(i["slug"] for i in insights)
    assert client.get("/api/regions/XX/insights").status_code == 404


def test_region_indicator_series(client: TestClient) -> None:
    resp = client.get("/api/regions/09/indicators/gdp_pc")
    assert resp.status_code == 200
    body = resp.json()
    assert body["region"]["name"] == "Bayern"
    assert body["indicator"]["slug"] == "gdp_pc"
    assert body["series"] and body["series"][-1]["period"] == body["series"][-1]["period"]
    # changes computed on the series
    assert all("percentage_change" in p for p in body["series"])


def test_region_indicator_unknown(client: TestClient) -> None:
    assert client.get("/api/regions/09/indicators/nope").status_code == 404


def test_compare(client: TestClient) -> None:
    resp = client.get("/api/compare?regions=09,08&indicator=gdp_pc")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["regions"]) == 2
    assert {r["name"] for r in body["regions"]} == {"Bayern", "Baden-Württemberg"}
    assert body["regions"][0]["series"]
    # too many regions -> 400
    assert client.get("/api/compare?regions=09,08,07,06,05").status_code == 400


def test_rankings(client: TestClient) -> None:
    resp = client.get("/api/rankings?indicator=unemp_rate&level=kreis&order=asc&limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] >= 300
    assert len(body["entries"]) == 5
    ranks = [e["rank"] for e in body["entries"]]
    assert ranks == sorted(ranks)  # ascending ranks
    assert body["entries"][0]["value"] <= 2.5

    # unknown period defaults to latest
    latest = client.get("/api/rankings?indicator=gdp_pc&level=bundesland").json()
    assert latest["period"] > 2000
    assert client.get("/api/rankings?indicator=gdp_pc&order=zzz").status_code == 400


def test_correlation(client: TestClient) -> None:
    resp = client.get("/api/correlation?x=pop_growth&y=gdp_pc&level=bundesland")
    assert resp.status_code == 200
    body = resp.json()
    assert body["n"] >= 5
    assert -1.0 <= body["pearson"] <= 1.0
    assert -1.0 <= body["spearman"] <= 1.0
    assert body["note"] == "Correlation is not causation."
    assert client.get("/api/correlation?x=nope&y=gdp_pc").status_code == 404


def test_indicator_periods(client: TestClient) -> None:
    resp = client.get("/api/indicators/gdp_pc/periods?level=bundesland")
    assert resp.status_code == 200
    body = resp.json()
    assert body["indicator"] == "gdp_pc"
    assert body["level"] == "bundesland"
    assert body["periods"] == sorted(body["periods"], reverse=True)
    assert 2024 in body["periods"]
    assert client.get("/api/indicators/nope/periods").status_code == 404
    assert client.get("/api/indicators/gdp_pc/periods?level=zzz").status_code == 400


def test_regions_geojson(client: TestClient) -> None:
    resp = client.get("/api/regions.geojson")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/geo+json")
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) >= 400


def test_correlation_includes_points(client: TestClient) -> None:
    body = client.get("/api/correlation?x=pop_growth&y=gdp_pc&level=bundesland").json()
    assert len(body["points"]) == body["n"]
    assert {"region_id", "name", "value_x", "value_y"} <= set(body["points"][0])


def test_sources_and_metadata(client: TestClient) -> None:
    sources = client.get("/api/sources").json()
    assert isinstance(sources, list) and len(sources) >= 6
    assert all(s["provider"] for s in sources)

    meta = client.get("/api/metadata").json()
    assert meta["snapshot"]["name"] == "deutschland"
    assert isinstance(meta["indicators"], list) and len(meta["indicators"]) >= 10
    assert len(meta["sources"]) == len(sources)
