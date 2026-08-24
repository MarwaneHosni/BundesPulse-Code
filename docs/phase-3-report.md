# Phase 3 Report — Basic Data Architecture

**Date:** 2026-08-24
**Phase:** 3 — data-build foundation: snapshot schema and a simple preparation
workflow. (Earlier phases: product spec, repository/application foundation.)

## 1. What was created

| Item | Description |
|------|-------------|
| `pipeline/build_data.py` | Linear preparation workflow: load raw CSVs → clean → map ids → normalize → validate → save to DuckDB. No ETL framework. |
| `data/raw/sample/*.csv` (committed) | Small sample source data (regions, indicators, observations, sources) so the workflow runs out of the box. |
| `data/snapshots/bundespulse.duckdb` (artifact, gitignored) | The prepared snapshot the backend opens read-only. |
| Docs | README "Prepared data" section; architecture.md snapshot schema; this report. |

## 2. Snapshot schema (four tables)

- **regions**: `region_id PK`, `name`, `type` (bund / bundesland / landkreis /
  kreisfreie_stadt), `parent_id`, `area` (km², > 0).
- **indicators**: `indicator_id PK`, `slug UNIQUE`, `name`, `category`, `unit`,
  `description`, `raw_or_derived IN ('raw','derived')`.
- **observations**: `(region_id, indicator_id, period) PK`, `value`,
  `source_id`.
- **sources**: `source_id PK`, `provider`, `dataset`, `url`,
  `retrieval_date DATE` — `source_id` (not in the original sketch) was added so
  observations can reference a source.

## 3. Workflow stages (in `build_data.py`)

`source → clean → map ids → normalize → validate → save`

- **clean**: strip whitespace, drop empty rows.
- **map ids**: region aliases (`DE-BW → DE1`, `DEBS → DE12`, …) and indicator
  slugs (`pop_total → 1`) resolved to canonical ids.
- **normalize**: correct types; de-duplicate observations; align column order
  with the table schema.
- **validate**: fail the build loudly on unknown region/indicator references,
  non-finite or out-of-range values (gated before dedup), duplicate keys,
  broken region parents, negative areas, duplicate slugs.
- **save**: re-create the snapshot file and insert with explicit column lists.

Verified behaviour: the sample contains whitespace ids, an alias, and one
duplicate row; the pipeline cleans them and reports `dropped 1 duplicate
observation row(s)`. Negative checks confirm broken region ids and NaN values
raise `DataError`.

## 4. Validation performed

- `python pipeline/build_data.py` runs clean on sample data:
  regions 6 · indicators 7 · observations 48 · sources 5; sanity query returns
  the correct population values (Baden-Württemberg 11 208 527, Bayern 13 358 543
  in 2023).
- Backend `/api/health` now reports `snapshot.configured: true` with the
  snapshot path, and DuckDB opens it `read_only=True`.
- Negative tests confirm the validation gates fire (broken region id, NaN).
- `ruff check pipeline/build_data.py` → clean.

## 5. Decisions

1. **Scratch the `data/raw/sample` dataset in the repo** so the build is
   runnable end-to-end with zero downloads; the produced `.duckdb` stays a
   gitignored artifact.
2. Added **`source_id`** to `sources` (required for observations to reference
   their provenance).
3. **Explicit INSERT column lists** — prevents silent column-order shifts
   (a real bug found during validation where `indicator_id` was appended last).
4. **Validation gates before de-duplication** so invalid rows cannot hide
   behind a duplicate key.
5. UTF-8 stdout for the script so German umlauts print on any console.

## 6. Next steps

- Replace sample CSVs with real official source extraction (Destatis/GENESIS,
  Bundesagentur für Arbeit, …) and expand to the full ~43-indicator catalogue.
- Add read-only `/api` data endpoints (regions, indicators, observations,
  rankings) over the snapshot.
- UI phases: wire the seven views to the API (Explore map with MapLibre,
  charts with ECharts).