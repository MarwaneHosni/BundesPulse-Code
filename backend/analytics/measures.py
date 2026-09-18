"""Core analytical measures for Deutschland Digital Monitor.

Simple, pure, read-only Python functions that the read-only API and the web
frontend will use later. Each function takes plain values / sequences and
returns a plain dict or number — there is no database access here and no
analytics framework.

Edge cases are handled explicitly (missing values, zero denominators,
insufficient data) and are documented on each function.

Naming follows the product spec §7 (measures taxonomy) and §11 (analytics):

* percentage change        = (current - previous) / previous * 100
* per-10,000 normalisation = value / population * 10_000
* ranking / percentile     = position within a group of regions
* correlation (Pearson / Spearman)
* simple z-score anomaly detection

Functions never raise for bad input; they return ``None`` (or a dict with an
explicit ``None``) when a result is not meaningful.
"""

from __future__ import annotations

import statistics
from collections.abc import Sequence

import numpy as np

Number = float | int | None


def _as_float(value) -> float | None:
    """Coerce to float or return None for missing/unparsable input."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# change measures


def absolute_change(current, previous) -> float | None:
    """Absolute change: ``current - previous`` (``None`` if either is missing)."""
    cur, prev = _as_float(current), _as_float(previous)
    if cur is None or prev is None:
        return None
    return cur - prev


def percentage_change(current, previous) -> float | None:
    """Percentage change: ``(current - previous) / previous * 100``.

    Returns ``None`` when the previous value is missing or zero (a percentage
    change from/to zero is not meaningful).
    """
    cur, prev = _as_float(current), _as_float(previous)
    if cur is None or prev is None or prev == 0.0:
        return None
    return (cur - prev) / prev * 100.0


def yoy_changes(series: Sequence[tuple]) -> list[dict]:
    """Year-over-year changes for an ascending, time-ordered ``series``.

    ``series`` is a sequence of ``(period, value)`` pairs. Missing values are
    skipped; a change is reported only when both the current and the previous
    period have values and the previous value is non-zero (percentage part).

    Returns a list of::

        {
          "period": 2024, "previous_period": 2023,
          "value": 13248928.0, "previous_value": 13176426.0,
          "absolute_change": 72502.0,
          "percentage_change": 0.5502,
        }
    """
    out: list[dict] = []
    previous_period, previous_value = None, None
    for period, raw_value in series:
        value = _as_float(raw_value)
        if value is None:
            previous_period, previous_value = None, None
            continue
        row = {
            "period": period,
            "previous_period": previous_period,
            "value": value,
            "previous_value": previous_value,
            "absolute_change": None,
            "percentage_change": None,
        }
        if previous_value is not None:
            row["absolute_change"] = absolute_change(value, previous_value)
            row["percentage_change"] = percentage_change(value, previous_value)
        out.append(row)
        previous_period, previous_value = period, value
    return out


# ---------------------------------------------------------------------------
# comparisons (region vs Germany / region vs Bundesland)


def compare_to_benchmark(value, benchmark) -> dict:
    """Compare a region value to a benchmark (Germany or the parent Bundesland).

    Returns::

        {
          "value": 2.2, "benchmark": 5.7,
          "diff": -3.5,                     # value - benchmark
          "diff_percent": -61.4,            # (value - benchmark) / benchmark * 100
          "ratio": 0.386,                   # value / benchmark
          "above_benchmark": False,
        }

    ``diff_percent`` and ``ratio`` are ``None`` for missing/zero benchmarks.
    """
    val, bench = _as_float(value), _as_float(benchmark)
    if bench is not None:
        diff = val - bench if val is not None else None
        ratio = val / bench if val is not None and bench != 0.0 else None
        diff_percent = percent(diff, bench)
    else:
        diff = ratio = diff_percent = None
    return {
        "value": val,
        "benchmark": bench,
        "diff": diff,
        "diff_percent": diff_percent,
        "ratio": ratio,
        "above_benchmark": (val > bench) if (val is not None and bench is not None) else None,
    }


def percent(numerator, denominator) -> float | None:
    """Percentage of two numbers: ``numerator / denominator * 100``."""
    num, den = _as_float(numerator), _as_float(denominator)
    if num is None or den is None or den == 0.0:
        return None
    return num / den * 100.0


# ---------------------------------------------------------------------------
# ranking / percentiles


def rank(value, values: Sequence, order: str = "desc") -> int | None:
    """Position (1 = best) of ``value`` within ``values``.

    ``order="desc"``: the largest value ranks 1 (e.g. GDP, population).
    ``order="asc"``: the smallest value ranks 1 (e.g. unemployment rate).
    Ties share the best rank (competition ranking: "1 2 2 4").

    Returns ``None`` if ``values`` is empty or ``value`` is missing.
    """
    val = _as_float(value)
    if val is None or not values:
        return None
    if order.lower() == "asc":
        return 1 + sum(1 for v in values if _as_float(v) is not None and _as_float(v) < val)
    return 1 + sum(1 for v in values if _as_float(v) is not None and _as_float(v) > val)


def rank_all(values: Sequence, order: str = "desc") -> list[int | None]:
    """Ranks for every entry of ``values`` (parallel list, see :func:`rank`)."""
    return [rank(v, values, order=order) for v in values]


def percentile(value, values: Sequence) -> float | None:
    """Cumulative percentile rank of ``value`` within ``values`` (0-100).

    Defined as the share of values that are <= ``value``, times 100. A value
    equal to the maximum therefore has percentile 100, the minimum > 0.

    Returns ``None`` when ``values`` is empty or ``value`` is missing.
    """
    val = _as_float(value)
    clean = [_as_float(v) for v in values]
    clean = [v for v in clean if v is not None]
    if val is None or not clean:
        return None
    return sum(1 for v in clean if v <= val) / len(clean) * 100.0


# ---------------------------------------------------------------------------
# per-capita / per-10,000 normalisation


def per_capita(value, population, per: float | int = 10_000) -> float | None:
    """Normalise a count to a per-population scale: ``value / population * per``.

    ``per`` defaults to 10,000 (per-10,000 inhabitants). Returns ``None`` when
    the value is missing or the population is missing/zero.
    """
    val, pop = _as_float(value), _as_float(population)
    if val is None or pop is None or pop <= 0.0:
        return None
    return val / pop * float(per)


# ---------------------------------------------------------------------------
# correlation


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> float | None:
    """Pearson correlation coefficient (None when either series is constant)."""
    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    xm, ym = x - x.mean(), y - y.mean()
    denom = float(np.sqrt((xm**2).sum() * (ym**2).sum()))
    if denom == 0.0:
        return None
    return float((xm * ym).sum() / denom)


def _average_ranks(values: Sequence[float]) -> list[float]:
    """Average ranks (1-based, ties share the mean) for Spearman."""
    ordered = sorted((v, i) for i, v in enumerate(values))
    ranks = [0.0] * len(values)
    i = 0
    while i < len(ordered):
        j = i
        while j + 1 < len(ordered) and ordered[j + 1][0] == ordered[i][0]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[ordered[k][1]] = avg
        i = j + 1
    return ranks


def correlation(x: Sequence, y: Sequence, method: str = "pearson") -> dict:
    """Pearson (default) or Spearman correlation between two sequences.

    Missing values are dropped pairwise; Spearman is computed as Pearson on the
    average ranks (no external statistics library needed). Returns::

        {"method": "pearson", "n": 16, "coefficient": 0.82}

    ``coefficient`` is ``None`` for less than two valid pairs or when either
    series is constant (division by zero / correlation undefined).
    """
    is_spearman = method.lower() in ("spearman", "rank")
    res_method = "spearman" if is_spearman else "pearson"
    x_clean, y_clean = [], []
    for xv, yv in zip(x, y):
        xf, yf = _as_float(xv), _as_float(yv)
        if xf is not None and yf is not None:
            x_clean.append(xf)
            y_clean.append(yf)
    n = len(x_clean)
    result = {"method": res_method, "n": n, "coefficient": None}
    if n < 2:
        return result

    if is_spearman:
        coeff = _pearson(_average_ranks(x_clean), _average_ranks(y_clean))
    else:
        coeff = _pearson(x_clean, y_clean)
    result["coefficient"] = round(coeff, 6) if coeff is not None else None
    return result


# ---------------------------------------------------------------------------
# anomaly detection (simple z-score)


def z_score(value, series: Sequence) -> float | None:
    """Standard score: ``(value - mean) / std`` of ``series``.

    Returns ``None`` when fewer than 3 values are available or the standard
    deviation is zero (no variance to measure against).
    """
    val = _as_float(value)
    clean = [_as_float(v) for v in series]
    clean = [v for v in clean if v is not None]
    if val is None or len(clean) < 3:
        return None
    sd = statistics.stdev(clean)
    if sd == 0.0:
        return None
    return (val - statistics.mean(clean)) / sd


def detect_anomaly(value, series: Sequence, threshold: float = 2.0) -> dict:
    """Flag a value as anomalous if its z-score exceeds ``threshold`` (in |z|).

    Returns::

        {"value": -4.56, "z_score": -2.71, "is_anomaly": True,
         "mean": 2.28, "std": 2.53, "n": 33}

    For insufficient data / zero variance, ``is_anomaly`` is False and
    ``z_score`` is ``None``.
    """
    zs = z_score(value, series)
    return {
        "value": _as_float(value),
        "z_score": zs,
        "is_anomaly": zs is not None and abs(zs) > threshold,
        "mean": statistics.mean([_as_float(v) for v in series if _as_float(v) is not None])
        if zs is not None
        else None,
        "std": statistics.stdev([_as_float(v) for v in series if _as_float(v) is not None])
        if zs is not None
        else None,
        "n": sum(1 for v in series if _as_float(v) is not None),
    }
