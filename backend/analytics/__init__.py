"""Analytics package (foundation placeholder).

This package will host the pre-computed analytical computations consumed by
the read-only API — per the product spec §7 and §11:

* the measures taxonomy (level, absolute change, % change, percentage-point
  change, per-capita, index);
* ranks and percentiles (tie-consistent, per indicator × period × level);
* descriptive statistics and linear trends;
* correlation coefficients (Pearson) for the Relationship Explorer.

Per the product architecture, all heavy analytics run *offline* in the
data-build stage and are materialised into the snapshot. A future phase will
either reuse these modules inside the pipeline or reference their outputs; the
web backend itself must never recompute statistics at request time.
"""
