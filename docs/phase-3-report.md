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

## Addendum 3 (Destatis: economy, housing, transport)

New `pipeline/fetch_destatis_more.py` stages three more real per-Bundesland
datasets into `data/processed/destatis_more/`:

- **Economy (VGR der Länder)**: BIP in jeweiligen Preisen per Land, **1991–2024**
  (+ derived BIP je Einwohner), parsed from the official VGRdL yearbook
  (`vgrdl_r1b1`) on statistikportal.de. The workbook stacks several tables on
  one sheet – the parser now takes only the first block.
- **Housing**: genehmigte und fertiggestellte Wohnungen 2022 per Land, from the
  Destatis *Bautätigkeit* report (per-Land columns split across 1.4-*/1.5-*
  sheets).
- **Transport**: Straßenverkehrsunfälle insgesamt per Land, **2024 & 2025**,
  from the Destatis *Statistischer Bericht Verkehrsunfaelle* (20807; the 2023
  report lacks the total-accidents column, so it is not included). The 2025
  layout puts the Land in a dedicated `Land` column – handled.

Verified values: Bayern BIP 1995→2024 = 306 879 → 796 174 Mio €; BIP/Einwohner
2024 Hamburg 87 688 €; housing completions DE 2022 = 295 275; road accidents DE
2024 = 2 512 697.

Snapshot now: 417 regions · 16 indicators · 2612 observations · 9 sources.

## Addendum 4 (major data domains — verification & status)

Re-ran and verified the remaining major domains end-to-end (real data in DuckDB):

- **Bundesagentur für Arbeit** — `unemp` + `unemp_rate` for 400 Kreise
  (Dez 2025) and `emp_social` per Bundesland (Jun 2022): e.g. Duisburg 17 499
  Arbeitslose, Gelsenkirchen 15.2 % (highest rate), NRW 7.23 M svB.
- **Infrastructure (Bundesnetzagentur)** — after the Kreis-name matcher
  improvements (per-Land + fuzzy matching), `chargers` now cover ~all register
  entries: Deutschland 206 628 Ladepunkte, 24.76 je 10 000 Einwohner
  (Kreis-level sum equals the national total), top Kreise Berlin 7 506,
  Hamburg 5 815, München 5 093.
- **Umweltbundesamt (NO2/PM10)** — station→Bundesland mapping and indicator
  definitions are staged; the values API cannot serve full-year data
  (server HTTP 504 on full-year aggregation) and remains intermittently slow,
  so `no2`/`pm10` carry **no fabricated values**. Re-attempted and documented;
  populating once the API behaves.

Re-verified queries by region, by year, and national aggregates; snapshot
unchanged at 417 regions · 16 indicators · 2612 observations · 9 sources.

## Addendum 5 (production snapshot)

`pipeline/build_data.py` now produces the **final, app-ready snapshot**:

- `data/snapshot/deutschland.duckdb` — base tables (regions, indicators,
  observations, sources) plus precomputed derived tables:
  `region_summaries`, `rankings` (rank_desc/rank_asc/percentile per
  indicator×period×level), `trends` (total & average annual change), `insights`
  (latest-period yoy, rank, percentile, ratio vs Germany and vs Bundesland),
  and `snapshot_meta`.
- `data/snapshot/regions.geojson` — official **BKG VG250** polygons for the 16
  Bundesländer + 400 Landkreise (WGS84, simplified), each feature carrying
  region_id/name/type/parent_id/area_km2.
- `data/snapshot/indicator_metadata.json` — indicator catalog with period range,
  level availability, and coverage counts for the frontend.

The build downloads the official BKG GeoDatabase on first run (cached under
`data/raw/geography/`), fills region areas from it, and precomputes the derived
metrics with the same `backend/analytics/measures.py` functions the API uses
(rankings/percentiles therefore match runtime queries by construction).

Backend default snapshot path updated to `data/snapshot/deutschland.duckdb`.

## 6. Next steps

- Extend `pipeline/fetch_destatis.py` to further official per-Land datasets
  (housing stock/Bautätigkeit, Gewerbeanmeldungen, BIP je Land, Pendler) as
  new-format reports become available, and expand the indicator catalogue.
- Add read-only `/api` data endpoints (regions, indicators, observations,
  rankings) over the snapshot.
- UI phases: wire the seven views to the API (Explore map with MapLibre,
  charts with ECharts).