# Data sources & coverage

Each source fetcher (`pipeline/fetch_*.py`) downloads official data and writes
staging CSVs under `data/processed/<source>/`; `pipeline/build_data.py` merges
all staging dirs into the DuckDB snapshot. All ids follow the **official German
AGS** (`DE`, federal-state codes `01`–`16`, five-digit Kreis codes).

## Integrated datasets (real, official)

| Domain | Indicator(s) | Source | Coverage |
|--------|--------------|--------|----------|
| **Demography** | `pop_total` – Bevölkerung am 31.12. (persons) | Destatis, *Bevölkerungsfortschreibung* (12411, Zensus-2022 basis) | Länder + DE, **2022–2024**; **DE time series 1990–2024** |
| **Demography** | `pop_growth` – official growth rate (%) | Destatis 12411 | Länder + DE, 2022–2024 |
| **Demography** | `pop_share_65plus`, `pop_share_under18` (%) – derived | from 12411 age-group counts | Länder + DE, 2022–2024 |
| **Demography** | `pop_share_foreign`, `pop_mean_age`, `pop_sex_ratio`, `pop_youth_dependency`, `pop_old_dependency` | Destatis 12411 (published columns) | Länder + DE, 2022–2024 |
| **Employment** | `unemp` – Arbeitslose (persons) | Bundesagentur für Arbeit, *Arbeitslose nach Kreisen* (Dezember 2025) | **400 Kreise**, Dez-2025 |
| **Employment** | `unemp_rate` – Arbeitslosenquote (%) | Bundesagentur für Arbeit (published rate) | 400 Kreise, Dez-2025 |
| **Employment** | `unemp_youth`, `unemp_youth_rate`, `unemp_older`, `unemp_older_rate`, `unemp_long_term` (15–<25 / 55–<65 / Langzeit) | Bundesagentur für Arbeit, *Heftpol* demographic tables (Dezember 2025) | 400 Kreise, Dez-2025 |
| **Employment** | `emp_social` – svB Beschäftigte am Arbeitsort | Bundesagentur für Arbeit, *Gemeindedaten der Beschäftigten* (Juni 2022) | 16 Länder, Jun-2022 |
| **Economy** | `gdp_mio` – BIP in jeweiligen Preisen (Mio €) | Arbeitskreis VGR der Länder (VGRdL), yearbook `r1b1` via statistikportal.de | Länder + DE, **1991–2025** |
| **Economy** | `gdp_pc` – BIP je Einwohner (€, derived) | VGRdL BIP ÷ population (same workbook) | Länder + DE, 1991–2025 |
| **Economy** | `gdp_growth` – BIP-Wachstum ggü. Vorjahr (%, derived) | from VGRdL BIP series | Länder + DE, 1992–2025 |
| **Housing** | `housing_permits`, `housing_completions` (Wohnungen) | Destatis, *Bautätigkeit* report (2022) | Länder + DE, 2022 |
| **Mobility** | `traffic_accidents`, `traffic_person_accidents`, `traffic_fatalities` | Destatis, *Statistischer Bericht Verkehrsunfälle* (20807) | Länder + DE, **2024 & 2025** |
| **Environment** | `no2`, `pm10` – Jahresmittel (µg/m³), station-based | Umweltbundesamt, Luftmessnetz | station→Land mapping integrated; **concentration values pending** (see below) |
| **Infrastructure** | `chargers` – öffentl. Ladepunkte | Bundesnetzagentur, *Ladesaeulenregister* | **≈394 Kreise** + 16 Länder + DE, as-of 2026-07-28 |
| **Infrastructure** | `chargers_per_10k` – Ladepunkte je 10 000 Einw. (derived) | BNetzA register × Destatis population 2024 | Länder + DE, 2026 |
| **Infrastructure** | `chargers_fast`, `chargers_fast_share` – Schnellladepunkte (≥ 50 kW / Schnellladeeinrichtung) + Anteil (derived) | BNetzA register | Kreise + Länder + DE, 2026 |

\* `emp_social` for Deutschland is obtainable via the same BA file; only Länder
rows are staged today.

## Raw files (downloaded, no credentials)

- Destatis 12411 statistical reports: `data/raw/destatis/*.xlsx`
- BA Einzelhefte (ZIPs): `data/raw/sources/ba_arbeitslose_quoten.zip`,
  `data/raw/sources/ba_svb.zip`
- BNetzA register: `data/raw/sources/ladesaeulenregister.csv`
- UBA data: fetched from `www.umweltbundesamt.de/api/air_data/v2` (station list)

## Region mapping

- **Kreise** come from the BA December-2025 Kreis table (official five-digit AGS;
  parent = first two digits = Land).
- **Charging points** are aggregated per *Kreis / kreisfreie Stadt* string in the
  BNetzA register and matched to the Kreis AGS (exact + fuzzy name matching;
  ≈394 of ~400 register Kreis names matched).

## UBA air quality — what the regional value represents

Air-pollutant values are **station-based**. The simple geographic mapping used:

> For a region, the value is the **unweighted mean of the annual-mean
> NO2/PM10 concentrations at the UBA/state monitoring stations located in that
> region** (period: 2024); *station → region (Bundesland)* comes from the
> official UBA station metadata (federal-state code and coordinates).

The UBA `measures` API (per-station annual means) cannot serve full-year data
from this build environment — full-year requests return HTTP 504 (server-aggregation
timeout), and even the station list is intermittently slow. The fetcher stages
the indicator definitions and the station→Land mapping, and retries the values
with a small budget; if none are retrieved it fails gracefully
– **no values are fabricated**. Re-run `pipeline/fetch_umweltbundesamt.py` once
the API is reachable to populate `no2`/`pm10`. All other integrated domains
(Demography, Employment incl. unemployment/rate, Economy, Housing, Mobility,
Infrastructure charging) contain **real values**.

## Regionalatlas / Regionaldatenbank Deutschland (additional source)

The **Regionalatlas Deutschland** (Statistische Ämter des Bundes und der Länder,
presented on statistikportal.de) provides 180+ indicators across ~20 subject
areas. `pipeline/fetch_regionalatlas.py` imports a curated subset — it does **not**
scrape the visual website: it downloads the public catalogue
(`app/json/services.json` + `thesaurus.csv`) and queries the official ArcGIS REST
backend (`…/stba/regionalatlas/MapServer` `dynamicLayer/query`) table-by-table.

- **What was imported:** 30 curated tables → **80 indicators** in Environment,
  Demography, Labour, Economy, Income, Housing, Education, Agriculture, Industry,
  Mobility, Tourism, Health and Public finance.
- **Geography:** Bundesländer and Kreise (official AGS, 2- and 5-digit) plus
  Deutschland. **Municipalities (8-digit) and Regierungsbezirke are excluded.**
- **Time coverage:** per table, typically **~2000–2024** (varies; e.g.
  Bevölkerungsdichte 2000–2024, Pkw-Dichte 2000–2026, Arbeitslosenquote 2001–2025).
- **Modelling:** added to the existing generic `indicators` / `observations`
  schema — no source-specific tables. Slugs are derived from the German titles,
  with category/unit/description taken from the official catalogue; indicator ids
  start at 1000 so they never collide with the core Destatis/BA/BNetzA ids.
- **Duplicates are intentional:** where an indicator overlaps an existing one, both
  are kept and distinguished by source (e.g. Regionalatlas `arbeitslosenquote`
  vs. BA `unemp_rate`). The Region profile keeps a curated KPI selection.
- **Limitations:** values are as published per region/year (boundary reforms can
  break series); sentinel/missing codes (e.g. `6666666666`) are dropped; not every
  table exists at every level or year.

## Re-run the pipeline

```bash
.venv/Scripts/python -m pipeline.fetch_destatis
.venv/Scripts/python -m pipeline.fetch_destatis_more     # Economy / Housing / Traffic
.venv/Scripts/python -m pipeline.fetch_arbeitsagentur
.venv/Scripts/python -m pipeline.fetch_netzagentur
.venv/Scripts/python -m pipeline.fetch_umweltbundesamt   # station mapping; values best-effort
.venv/Scripts/python -m pipeline.fetch_regionalatlas     # 80 Regionalatlas indicators
.venv/Scripts/python -m pipeline.build_data              # merge + validate + snapshot
```

Downloads are cached in `data/raw/`; re-running after a publish updates the
source record and rebuilds the snapshot. The build caches the map geometry
(`regions.geojson`); set `BUNDESPULSE_REBUILD_GEOMETRY=1` to rebuild it from the
BKG Geopackage.