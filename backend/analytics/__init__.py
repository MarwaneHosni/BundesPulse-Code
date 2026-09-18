"""Analytics package.

Read-only analytical functions consumed later by the API and the frontend.
Per the product spec §7 and §11:

* ``measures.py`` - the core measures: percentage change, year-over-year
  change, region-vs-benchmark comparisons, ranking, percentiles, per-capita
  (per-10,000) normalisation, Pearson/Spearman correlation, and simple
  z-score anomaly detection. All functions are pure and handle missing
  values, zero denominators, and insufficient data explicitly.

Heavy, pre-computed analytics (ranks/percentiles materialised per indicator)
still belong to the data-build pipeline; these functions are the reusable,
testable building blocks for both the pipeline and the read-only API.
"""
