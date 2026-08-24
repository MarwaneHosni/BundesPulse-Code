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

## Addendum (real Destatis data)

**First real data integration — population (GENESIS 12411).**

- New `pipeline/fetch_destatis.py`: downloads the official Destatis
  *Statistischer Bericht – Bevölkerungsfortschreibung (Zensus 2022)* for report
  years 2023 and 2024, parses the embedded CSV tables, and stages
  `regions/indicators/observations/sources` under `data/processed/destatis/`.
- Canonic regions are now the **real Länder set** (Deutschland + 16
  Bundesländer, ids `DE` / `01`–`16`).
- Indicators: `pop_total` (persons), `pop_growth` (official % rate),
  `pop_share_65plus`, `pop_share_under18` (derived from age groups).
- Observations: per Land for 2023 & 2024; Deutschland time series 1990–2024.
- `build_data.py` now prefers the staged Destatis data (committed `data/raw/
  sample/` remains the fallback), supports pre-mapped numeric `indicator_id`,
  and treats `area` as optional (real Länder areas are not in this source).
- Verified queries: by region (Bayern 13 176 426 → 13 248 928), by year (all
  16 Länder 2024), historical trend (DE 1990–2020 sample), derived share
  (DE 2024 65+ = 22.74%), and recorded sources.
- **Coverage note:** regional housing / economy / transport reports require the
  GENESIS API account or new-format per-Land reports (older workbooks break out
  only Deutschland / früheres Bundesgebiet / neue Länder); documented in
  `docs/data-sources.md` as the next integration candidates.

## Addendum 2 (major data domains)

Added three further real, official datasets through the same fetch → stage →
build path (`build_data.py` now merges four staging dirs; source ids are
offset per directory; region ids follow the official AGS; Länder ids corrected
to the official 01–16 ordering):

- **Bundesagentur für Arbeit** (`fetch_arbeitsagentur.py`): Arbeitslose +
  Arbeitslosenquote for 400 Kreise (Dec 2025, from the BA "Einzelheft"
  workbook embedded tables) and svB Beschäftigte am Arbeitsort for the 16
  Bundesländer (Jun 2022, xlsb Gemeindedaten).
- **Bundesnetzagentur** (`fetch_netzagentur.py`): Ladesaeulenregister CSV →
  charging points per Kreis (377 of 379 register Kreis names matched via
  normalised/fuzzy name matching) and **charging points per 10,000 inhabitants
  per Bundesland**, normalised with the Destatis 2024 population.
- **Umweltbundesamt** (`fetch_umweltbundesamt.py`): station register →
  Bundesland mapping integrated (1219 active stations); NO2/PM10 annual values
  depend on the UBA measures API which was unreachable from this environment
  (documented; the fetcher retries with a small budget and never fabricates
  values).

Snapshot now: 417 regions · 11 indicators · 1428 observations · 6 sources.
Verified: Kreis unemployment (e.g. Gelsenkirchen 15.2%), per-Land employment
(NRW 7.23M), chargers (Bayern 39 456; 29.94 per 10k), sources recorded.

## 6. Next steps

- Extend `pipeline/fetch_destatis.py` to further official per-Land datasets
  (housing stock/Bautätigkeit, Gewerbeanmeldungen, BIP je Land, Pendler) as
  new-format reports become available, and expand the indicator catalogue.
- Add read-only `/api` data endpoints (regions, indicators, observations,
  rankings) over the snapshot.
- UI phases: wire the seven views to the API (Explore map with MapLibre,
  charts with ECharts).