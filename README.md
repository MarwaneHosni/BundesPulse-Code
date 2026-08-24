# Deutschland Digital Monitor

A **read-only German regional data intelligence platform** for exploring,
comparing, ranking, and understanding official public statistics for the
Federation, the sixteen Bundesländer, and the 401 Landkreise / kreisfreie
Städte.

> **Architecture**: the deployed web application is a pure **read-only**
> consumer of a **pre-computed, immutable data snapshot**. All ingestion and
> computation happen offline in the data-build stage. There is no user upload,
> no edit, no runtime ingestion, and no accounts.

## Status

**Phase 1 — Product Specification: COMPLETE.** The authoritative specification
lives in [`docs/product-spec.md`](docs/product-spec.md). See
[`docs/phase-1-report.md`](docs/phase-1-report.md) for decisions, validation,
and next steps.

## Project layout

```
BundesPulse/
├── docs/
│   ├── product-spec.md   # Authoritative product specification (Phase 1)
│   └── phase-1-report.md # Phase 1 report: changes, decisions, validation
└── README.md
```

Future phases will add the data-build pipeline (Python / DuckDB / Polars /
GeoPandas) and the web application (React / TypeScript / Vite / Tailwind /
shadcn/ui / TanStack Query / ECharts / MapLibre GL, with a FastAPI read API).

## Core domains

- Demography · Employment · Economy · Housing · Mobility · Environment · Infrastructure

## Main views

Explore · Region Profile · Compare · Rankings · Data Explorer · Relationship
Explorer · Methodology/Sources

Read the full [product specification](docs/product-spec.md) for page
responsibilities, navigation, geography, the measures taxonomy, analytical and
insight rules, transparency requirements, UX/visual principles, non-goals, and
the MVP roadmap.
