# Phase 1 Report — Product Specification

**Date:** 2026-08-24
**Repository:** BundesPulse (origin: `https://github.com/MarwaneHosni/BundesPulse-Code.git`)
**Phase:** 1 — Define and formalize the complete product specification.

## 1. What was created / changed

| File | Action | Purpose |
|------|--------|---------|
| `docs/product-spec.md` | Created | The authoritative, implementation-ready product specification. |
| `README.md` | Created | Root overview; internally consistent pointer to the spec and phase status. |
| `docs/phase-1-report.md` | Created | This audit trail. |

The repository was empty at start (`.git` only, no commits, no tracked files),
so there was no existing work to preserve or reconcile.

## 2. Important product decisions

1. **Read-only, precomputed-snapshot architecture made normative (§2, §20).**
   The web app is a pure consumer of an immutable DuckDB snapshot built
   offline. No page, endpoint, or journey depends on user-uploaded or injected
   data (verified in §4).
2. **Measures taxonomy (§7) as the analytical backbone.** Distinguishes Level,
   absolute change, percentage change, percentage-point change, per-capita,
   and index; encodes hard rules (e.g. % change never on a negative/near-zero
   base; pp is the only valid change measure for rate values; no "% change of
   a rate"). Every number carries an unambiguous measure/unit label.
3. **Fixed region model (§5)**: Bund (1) → Bundesländer (16) → 401 Landkreise /
   kreisfreie Städte, using AGS-style stable ids and a per-snapshot region
   catalogue year. Aggregations are precomputed, not done at runtime.
4. **Curated v1 indicator catalogue (§6, Appendix A): ~43 indicators across
   7 domains**, each fully specified (source, unit, measure type, level,
   time depth), rather than an open-ended placeholder.
5. **Correlation ≠ causation is a hard, central rule (§11.4, §12.2)**: the
   Relationship Explorer always shows r/n/p-value + explicit disclaimer;
   causal wording is hard-coded and never generated.
6. **Insight engine contract (§11)**: every insight is traceable to concrete
   (region, indicator, period, value, formula) and links to a "why am I seeing
   this?" evidence slice.
7. **State in the URL (§10.2)**: the URL is the canonical context; Zustand is
   limited to transient UI state only — the single "genuinely necessary" use.
   TanStack Query handles all data fetching.
8. **Transparency is a first-class requirement (§12–§13)**: every value is
   attributable; snapshot version + "as of" labeling is persistent; missing /
   suppressed data is disclosed.
9. **Explicit non-goals & roadmap (§14–§15)**: no auth, uploads, editing,
   admin, runtime ingestion, social features, microservices, Kafka, Airflow,
   Kubernetes. Future features (alerts, NL querying, localization, bulk
   export) are listed as deferred, not committed to v1.

## 3. Validation performed

- **Read-only architecture is consistent**: audited every page specification
  (§9) and user journey (§4) — none requires uploading, editing, or
  user-supplied data; Data Explorer explicitly explores "the snapshot only".
- **Measures taxonomy has no contradictions**: §7 rules are singular and the
  indicator catalogue (§6.0/Appendix A) assigns a single measure type per
  indicator; no indicator permits a mathematically invalid change measure.
- **No page depends on data that the model can't supply**: the conceptual data
  model (§8) provides observations, derived series, ranks, and relationships
  for every region/indicator/period combination the pages display.
- **Correlation-causation rule enforced** in the Relationship Explorer and
  insight engine (§11.4, §12.2).
- **Seven main views have clear, non-overlapping responsibilities** (§9),
  each with purpose, controls, content, and interactions.
- **Excluded features are consistently listed** across Non-Goals (§14),
  Roadmap (§15), and Architecture (§2) — no contradictions.
- **Technical stack mapping (§21)** is consistent with the product direction
  and the read-only architecture.
- **Snapshot philosophy (§20)** is consistent with per-indicator freshness and
  "as of" labeling; no runtime refresh anywhere.

## 4. Remaining work (belongs to later phases)

- **Phase 2 — Data build**: lock the final indicator catalogue against the
  actual availability of each planned official source; build the Python /
  Polars / GeoPandas pipeline; assemble the DuckDB snapshot; compute derived
  measures, ranks, percentiles, and correlations; produce vector tiles;
  generate the source manifest.
- **Phase 3 — API**: implement the read-only FastAPI layer over the snapshot.
- **Phase 4 — Web app**: implement the React/TypeScript/Vite/Tailwind/shadcn
  frontend, TanStack Query data layer, ECharts + MapLibre visualizations,
  and all seven views per §9.
- **Later**: roadmap items in §15 (localization, alerts, bulk export, NL
  querying) — explicitly not in v1.

## 5. Next step

Proceed to **Phase 2 (data-build)** to validate and lock the v1 indicator
catalogue against real source availability, then build the snapshot pipeline.
