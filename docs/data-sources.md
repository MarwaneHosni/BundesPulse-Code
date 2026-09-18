# Data sources & coverage

Each source fetcher (`pipeline/fetch_*.py`) downloads official data and writes
staging CSVs under `data/processed/<source>/`; `pipeline/build_data.py` merges
all staging dirs into the DuckDB snapshot. All ids follow the **official German
AGS** (`DE`, federal-state codes `01`–`16`, five-digit Kreis codes).

## Integrated datasets (real, official)

| Domain | Indicator(s) | Source | Coverage |
|--------|--------------|--------|----------|
| **Demography** | `pop_total` – Bevölkerung am 31.12. (persons) | Destatis, *Bevölkerungsfortschreibung* (12411, Zensus-2022 basis) | Länder + DE, 2023 & 2024; **DE time series 1990–2024** |
| **Demography** | `pop_growth` – official growth rate (%) | Destatis 12411 | Länder + DE, 2023 & 2024 |
| **Demography** | `pop_share_65plus`, `pop_share_under18` (%) – derived | from 12411 age-group counts | Länder + DE, 2023 & 2024 |
| **Employment** | `unemp` – Arbeitslose (persons) | Bundesagentur für Arbeit, *Arbeitslose nach Kreisen* (Dezember 2025) | **400 Kreise**, Dez-2025 |
| **Employment** | `unemp_rate` – Arbeitslosenquote (%) | Bundesagentur für Arbeit (published rate) | 400 Kreise, Dez-2025 |
| **Employment** | `emp_social` – svB Beschäftigte am Arbeitsort | Bundesagentur für Arbeit, *Gemeindedaten der Beschäftigten* (Juni 2022) | 16 Länder + DE*, Jun-2022 |
| **Economy** | `gdp_mio` – BIP in jeweiligen Preisen (Mio €) | Arbeitskreis VGR der Länder (VGRdL), yearbook `r1b1` via statistikportal.de | Länder + DE, **1991–2024** |
| **Economy** | `gdp_pc` – BIP je Einwohner (€, derived) | VGRdL BIP ÷ population (same workbook) | Länder + DE, 1991–2024 |
| **Housing** | `housing_permits`, `housing_completions` (Wohnungen) | Destatis, *Bautätigkeit* report (2022) | Länder + DE, 2022 |
| **Mobility** | `traffic_accidents` – Straßenverkehrsunfälle insgesamt | Destatis, *Statistischer Bericht Verkehrsunfälle* (20807) | Länder + DE, **2024 & 2025** |
| **Environment** | `no2`, `pm10` – Jahresmittel (µg/m³), station-based | Umweltbundesamt, Luftmessnetz | station→Land mapping integrated; **concentration values pending** (see below) |
| **Infrastructure** | `chargers` – öffentl. Ladepunkte | Bundesnetzagentur, *Ladesaeulenregister* | **377 Kreise** + 16 Länder + DE, as-of 2026-07-28 |
| **Infrastructure** | `chargers_per_10k` – Ladepunkte je 10 000 Einw. (derived) | BNetzA register × Destatis population 2024 | Länder + DE, 2026 |

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
  377 of 379 register Kreis names matched).

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

## Re-run the pipeline

```bash
.venv/Scripts/python -m pipeline.fetch_destatis
.venv/Scripts/python -m pipeline.fetch_destatis_more     # Economy / Housing / Traffic
.venv/Scripts/python -m pipeline.fetch_arbeitsagentur
.venv/Scripts/python -m pipeline.fetch_netzagentur
.venv/Scripts/python -m pipeline.fetch_umweltbundesamt   # station mapping; values best-effort
.venv/Scripts/python -m pipeline.build_data               # merge + validate + snapshot
```

Downloads are cached in `data/raw/`; re-running after a publish updates the
source record and rebuilds the snapshot.