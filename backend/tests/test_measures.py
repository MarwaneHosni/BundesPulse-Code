"""Tests for the core analytical measures."""

from __future__ import annotations

import pytest
from backend.analytics.measures import (
    absolute_change,
    compare_to_benchmark,
    correlation,
    detect_anomaly,
    per_capita,
    percent,
    percentage_change,
    percentile,
    rank,
    rank_all,
    yoy_changes,
    z_score,
)

# --------------------------------------------------------------------------- change


def test_absolute_change() -> None:
    assert absolute_change(100, 80) == 20
    assert absolute_change(80, 100) == -20
    assert absolute_change(None, 80) is None
    assert absolute_change(100, None) is None


def test_percentage_change() -> None:
    assert percentage_change(110, 100) == pytest.approx(10.0)
    assert percentage_change(90, 100) == pytest.approx(-10.0)
    assert percentage_change(100, 0) is None  # zero denominator
    assert percentage_change(0, 0) is None
    assert percentage_change(None, 100) is None
    assert percentage_change(100, None) is None


def test_yoy_changes_skips_missing_and_zero() -> None:
    series = [(2022, 100.0), (2023, 110.0), (2024, None), (2025, 121.0)]
    rows = yoy_changes(series)
    assert [r["period"] for r in rows] == [2022, 2023, 2025]  # missing period skipped
    assert rows[0]["previous_period"] is None
    assert rows[1]["percentage_change"] == pytest.approx(10.0)
    assert rows[1]["absolute_change"] == pytest.approx(10.0)
    # 2024 missing -> chain broken, 2025 has no previous value
    assert rows[2]["period"] == 2025
    assert rows[2]["previous_period"] is None
    assert rows[2]["percentage_change"] is None


# --------------------------------------------------------------------------- compare / percent


def test_compare_to_benchmark() -> None:
    res = compare_to_benchmark(2.2, 5.7)
    assert res["diff"] == pytest.approx(-3.5)
    assert res["diff_percent"] == pytest.approx(-61.4035, abs=1e-3)
    assert res["ratio"] == pytest.approx(0.38596, abs=1e-3)
    assert res["above_benchmark"] is False

    # zero benchmark -> percentage not meaningful
    res0 = compare_to_benchmark(10, 0)
    assert res0["ratio"] is None
    assert res0["diff_percent"] is None

    res_none = compare_to_benchmark(None, 5.7)
    assert res_none["diff"] is None
    assert res_none["above_benchmark"] is None


def test_percent() -> None:
    assert percent(1, 4) == pytest.approx(25.0)
    assert percent(1, 0) is None
    assert percent(None, 4) is None


# --------------------------------------------------------------------------- rank / percentile


def test_rank_desc_and_asc() -> None:
    values = [10, 20, 20, 30]
    assert rank(30, values, order="desc") == 1
    assert rank(20, values, order="desc") == 2  # ties share best rank
    assert rank(10, values, order="desc") == 4

    # ascending: smallest is best
    unemp = [15.2, 2.2, 4.1]
    assert rank(2.2, unemp, order="asc") == 1
    assert rank(15.2, unemp, order="asc") == 3

    assert rank(5.0, [], order="desc") is None
    assert rank(None, [1, 2]) is None


def test_rank_all() -> None:
    assert rank_all([30, 10, 20], order="desc") == [1, 3, 2]


def test_percentile() -> None:
    values = [1, 2, 3, 4, 5]
    assert percentile(3, values) == pytest.approx(60.0)
    assert percentile(5, values) == pytest.approx(100.0)
    assert percentile(1, values) == pytest.approx(20.0)
    assert percentile(3, []) is None
    assert percentile(None, values) is None


# --------------------------------------------------------------------------- per-capita


def test_per_capita() -> None:
    assert per_capita(206628, 83456045, per=10_000) == pytest.approx(24.7597, abs=1e-3)
    assert per_capita(100, 0, per=10_000) is None
    assert per_capita(100, None, per=10_000) is None
    assert per_capita(None, 1000, per=10_000) is None
    # per 1,000
    assert per_capita(30, 6000, per=1_000) == pytest.approx(5.0)


# --------------------------------------------------------------------------- correlation


def test_correlation_pearson_perfect_positive() -> None:
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    res = correlation(x, y, method="pearson")
    assert res["n"] == 5
    assert res["coefficient"] == pytest.approx(1.0)


def test_correlation_pearson_negative() -> None:
    x = [1, 2, 3, 4]
    y = [10, 8, 6, 4]
    assert correlation(x, y)["coefficient"] == pytest.approx(-1.0)


def test_correlation_spearman_handles_monotonic_but_non_linear() -> None:
    x = [1, 2, 3, 4, 5]
    y = [1, 4, 9, 16, 25]  # perfectly monotonic -> Spearman = 1
    res = correlation(x, y, method="spearman")
    assert res["coefficient"] == pytest.approx(1.0)


def test_correlation_insufficient_and_constant() -> None:
    assert correlation([1.0], [2.0])["coefficient"] is None  # n < 2
    const = correlation([3.0, 3.0, 3.0], [1.0, 2.0, 3.0])["coefficient"]
    assert const is None  # zero variance


def test_correlation_drops_missing_pairwise() -> None:
    x = [1, None, 3, 4, None]
    y = [2, 3, 6, 8, 9]
    res = correlation(x, y)
    assert res["n"] == 3
    assert res["coefficient"] == pytest.approx(1.0)


# --------------------------------------------------------------------------- anomaly


def test_z_score_and_anomaly() -> None:
    series = [2.0, 2.1, 1.9, 2.2, 2.0, 2.1, 1.8, 2.3, 2.0, 1.9, 2.1, 2.0]
    outlier = 5.0
    zs = z_score(outlier, series)
    assert zs is not None and zs > 2.0
    res = detect_anomaly(outlier, series)
    assert res["is_anomaly"] is True
    assert res["z_score"] == pytest.approx(zs)

    assert z_score(1.0, [1, 2]) is None  # insufficient data
    assert z_score(1.0, [5, 5, 5]) is None  # zero variance
    res2 = detect_anomaly(1.0, [1, 2])
    assert res2["is_anomaly"] is False
    assert res2["z_score"] is None
