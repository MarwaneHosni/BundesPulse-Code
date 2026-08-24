# Data sources & coverage

`pipeline/fetch_destatis.py` downloads and stages real official Destatis data;
`pipeline/build_data.py` loads it into the DuckDB snapshot.

## Integrated datasets (real, official)

| Domain | Indicator(s) | Source | Coverage |
|--------|--------------|--------|----------|
| **Demography** | `pop_total` — Bevölkerung am 31.12. (persons) | Destatis, *Bevölkerungsfortschreibung* (GENESIS 12411, Basis Zensus 2022) | Deutschland + 16 Bundesländer, 2023 & 2024; Deutschland time series **1990–2024** |
| **Demography** | `pop_growth` — official growth rate (%) | Destatis 12411 (published rate) | Deutschland + 16 Bundesländer, 2023 & 2024 |
| **Demography** | `pop_share_65plus`, `pop_share_under18` (%) — derived | computed from 12411 age-group counts | Deutschland + 16 Bundesländer, 2023 & 2024 |

Region ids are the **official federal-state codes** (`01` Baden-Württemberg …
`16` Thüringen; `DE` = Deutschland).

### Raw files

Downloaded from the official Destatis download pages (no credentials):

- `data/raw/destatis/12411_bevoelkerung_2023.xlsx`
- `data/raw/destatis/12411_bevoelkerung_2024.xlsx`

Both are *"Statistischer Bericht – Bevölkerungsfortschreibung (Zensus 2022)"*,
with the embedded machine-readable tables (`csv-12411-*`) used by the fetcher.

### Staging CSVs (written to `data/processed/destatis/`)

`regions.csv`, `indicators.csv`, `observations.csv`, `sources.csv` — schema
matches `pipeline/build_data.py`. Raw downloads and staging files are gitignored.

## Coverage notes (why other domains are not yet regional)

Full GENESIS-Online access requires a registered API account, and most older
Destatis report workbooks (e.g. *Bautätigkeit 2022*) only break the data down by
*Deutschland / früheres Bundesgebiet / neue Länder*, not by Bundesland.

- **Housing / economy / transport** (Locke/einwohner-stock, Gewerbeanmeldungen,
  BIP je Land, Pendler) — the corresponding statistical reports either need the
  GENESIS API or do not yet ship per-Land tables in the new
  embedded-CSV format. They are the next integration candidates; the fetch →
  stage → build path in this repo is ready for them.

Re-run pipeline whenever fresh official reports are published:

```bash
.venv/Scripts/python pipeline/fetch_destatis.py   # download + parse -> staging
.venv/Scripts/python pipeline/build_data.py       # validate + write DuckDB snapshot
```