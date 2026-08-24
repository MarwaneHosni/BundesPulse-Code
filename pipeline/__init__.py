"""BundesPulse offline data-build pipeline (foundation).

This package is the *offline* data preparation system that turns government
data into the immutable DuckDB snapshot. It is never part of the runtime web
stack — the production application only ever reads the prepared snapshot.

Pipeline stages (see docs/architecture.md and docs/product-spec.md §2):

    sources   → raw extraction/ad-hoc fetchers for official providers
    transforms→ cleaning, normalization, geospatial joins, analytics
    validation→ schema, range, and cross-checks producing a manifest

The pipeline is implemented in a later phase (Phase 3). These packages exist
now to establish the module layout and import boundaries.
"""

__version__ = "0.1.0"
