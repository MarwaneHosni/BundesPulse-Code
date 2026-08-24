# Deutschland Digital Monitor — Product Specification

**Phase:** 1 — Complete product specification (authoritative)
**Status:** Approved baseline for implementation
**Architecture:** Read-only web application over a pre-computed, immutable data snapshot
**Version:** 1.0.0

---

## 1. Product Overview

### 1.1 Product purpose

Deutschland Digital Monitor is a **read-only German regional data intelligence
platform** that lets people explore, compare, rank, and understand official
public statistics for German regions — the Federation (*Bund*), the sixteen
Federal States (*Bundesländer*), and the districts (*Landkreise*) and
district-free cities (*kreisfreie Städte*).

Its purpose is to answer three recurring questions:

1. **What is the current state of a region?** (level/level over time)
2. **How does a region compare to others?** (rankings, benchmarks)
3. **Why/how has a region changed, and what associates with that change?**
   (trends, relationships, explanatory insights)

The platform is deliberately **explanatory**, not merely presentational: it does
not just show a number, it shows *where the number comes from*, *how it was
calculated*, *how it ranks*, *how it changed*, and — carefully framed — *what it
tends to move together with*. Every analytical statement is **traceable to an
actual calculated value**.

### 1.2 Core value proposition

> **One prepared, transparent, territory-wide snapshot of official German
> regional statistics — with trustworthy, traceable analysis — instead of
> dozens of disconnected portals and raw CSV downloads.**

Concretely, the product delivers:

- **Consolidation**: multiple official sources (Destatis/GENESIS,
  Bundesagentur für Arbeit, BKG, Umweltbundesamt, Bundesnetzagentur, selected
  GovData datasets) normalized into one consistent, queryable snapshot.
- **Uniformity**: all regions and indicators are handled through one
  consistent hierarchy, measure model, and level of observation, so numbers
  are comparable across regions and time.
- **Transparency**: every value carries a source, a methodology note, and a
  unit — nothing is opaque.
- **Analysis without spreadsheet work**: trends, rankings, percentile
  positions, distributions, and relationships are precomputed and served, so
  users explore rather than munge data.
- **Speed**: because all computation happens offline, interactive analysis is
  instantaneous.

### 1.3 Guiding philosophy

- **Read-only by design.** The web application never writes, feeds, or
  mutates data. All ingestion, cleaning, aggregation, geospatial joining, and
  statistical computation happen offline in the **data-build stage** (Phase 2+,
  Python tooling). The deployed app reads a sealed snapshot.
- **Authoritative and honest.** The product never hides uncertainty, never
  presents correlation as causation, and always attributes a source.
- **Explanatory, not decorative.** Every view has a job; every insight can be
  traced back to a number; no chart exists without a caption and a purpose.
- **Comparable by default.** German public statistics are organized by
  territory; the product treats comparison, ranking, and benchmarking as
  first-class features, not add-ons.

---

## 2. Architecture Principles

The runtime application is a **thin, read-only frontend** coupled to a **read-only
API** that serves a prebuilt DuckDB snapshot. There is no runtime data pipeline.

### 2.1 What the user (and the app) explicitly cannot do

The product **does not** and **will not** support, at any layer:

- uploading datasets
- editing data
- creating datasets
- deleting data
- connecting to external APIs from the app
- configuring ingestion
- scheduling jobs
- managing data or data sources
- user accounts / authentication / authorization
- personalization based on a user identity
- social features (comments, sharing walls, follows)
- admin dashboards
- any runtime write path

Any UI that would imply "bring your own data" or "manage the dataset" is **out**
of scope and must not appear in v1.

### 2.2 Layer separation

| Layer | Responsibility | Technology | Writes? |
|-------|----------------|-----------|---------|
| **Data-build (offline)** | Ingest official sources, clean/normalize, compute derived measures, run geospatial joins, compute statistics, assemble snapshot. Owner of data truth. | Python, Polars, NumPy, SciPy, scikit-learn, GeoPandas, Shapely | Yes (to snapshot) |
| **Snapshot** | Immutable, versioned, queried dataset (DuckDB database file + static vector tiles). Produced by data-build. | DuckDB, GeoJSON/PMTiles | At build time only |
| **API** | Read-only query layer over snapshot: indicators, regions, time series, rankings, correlations. | FastAPI | No |
| **Web app** | Render views, handle interactions, visualize; caches reads client-side. | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, ECharts, MapLibre GL | No |

### 2.3 Read-only API contract

The API exposes only **GET-style, side-effect-free** endpoints. There is no
POST body that mutates state other than stateless query parameters. The API is
a **pure function of (snapshot version, query)**.

### 2.4 Immutable snapshot

- Each release is a versioned, **immutable** snapshot with a timestamp and a
  manifest of source artifacts and versions used to build it.
- The application reads only the snapshot it was deployed with; it never (re)
  computes statistics at runtime and never reconciles against live sources.
- See §20 for the full snapshot philosophy.

---

## 3. Target Users & Personas

Three primary personas. No accounts, so personas are personas only — the same
UI must serve all three.

### 3.1 Persona A — Regional Policy Analyst / Administration

> e.g. a planning officer in a Landkreis or a ministry analyst.

- **Goals**: monitor regional condition against benchmarks, support policy
  briefs, find evidence for a region's trajectory, compare own region to
  peers.
- **Needs**: trustworthy official data, source attribution, robust rankings,
  clear change metrics, the ability to export/read a defensible narrative.
- **Depth**: analytical; comfortable with rates, per-capita measures,
  percentage-point changes.
- **Primary views**: Region Profile, Compare, Rankings, Methodology.

### 3.2 Persona B — Journalist / Researcher

> e.g. a data journalist or social-science researcher covering a story.

- **Goals**: discover a story ("which regions are losing population
  fastest?"), pull a defensible figure with provenance, produce a comparison
  or a map for an article.
- **Needs**: accuracy, attribution, reproducibility of a number, quick
  cross-checks across regions, correlation that is *clearly* framed as
  association.
- **Depth**: intermediate; reads methodology but values plain-language labels.
- **Primary views**: Explore, Rankings, Relationship Explorer, Data Explorer,
  Methodology.

### 3.3 Persona C — Informed Citizen / Civic User

> e.g. a resident curious about their own region.

- **Goals**: understand their region's situation ("how is my area doing?"),
  compare to neighbours, get a plain-language takeaway they can trust.
- **Needs**: low jargon, clear labels, prominent source + methodology, an
  easy on-ramp (map first), forgiving interactions.
- **Depth**: novice-to-intermediate; benefits from insight copy and defaults.
- **Primary views**: Explore, Region Profile, Rankings.

### 3.4 Secondary (viewer, non-primary) personas

- **Data administrators / maintainers** who build snapshots — served by the
  data-build tooling and the Methodology/Sources page, **not** by interactive
  features of the web app.
- **Educators** who use regional data in teaching — served by Explore and
  clear methodology.

---

## 4. User Problems & Jobs-to-be-Done

### 4.1 Problems the product solves

1. **Fragmentation**: official German regional statistics live across many
   portals (GENESIS, BA statistik, UBA, BNetzA, GovData), each with different
   formats, units, and geography codes. Problem: high cost to assemble one
   coherent picture.
2. **Comparability friction**: cross-region comparison requires manual
   normalization (per-capita, rates) and knowledge of which measure is valid
   for which unit. Problem: errors and inconsistent analysis.
3. **Change is ambiguous**: "rose by X" is meaningless without distinguishing
   absolute change, percentage change, and percentage-point change. Problem:
   misreported trends.
4. **No provenance**: downloaded numbers often lose their source, basis, and
   methodology. Problem: figures can't be defended or reproduced.
5. **Statistics feel static**: hard to see trajectory, rank, distribution,
   and relationships without doing statistics by hand. Problem: analysis is
   gated behind spreadsheet/statistics skill.
6. **Geospatial entry is poor**: official portals rarely let users click a
   map and drill into a region's story. Problem: low adoption by civic users.

### 4.2 Jobs-to-be-Done

- "When I need to **understand** a region's current condition, I want a
  one-page overview of its key numbers, their trend, its rank, and an
  explanation — so I can grasp the situation quickly."
- "When I need to **compare** regions, I want to choose 2–4 regions and see
  their indicators side by side, synchronized — so I can see who leads and by
  how much."
- "When I need to **rank**, I want to sort regions by an indicator for a
  given period and level, and see both a table and a map — so I can find the
  best/worst and the geographic pattern."
- "When I need to **verify/explore a number**, I want to pick an indicator,
  a geography, and a period, apply a transformation, and see it as a table,
  chart, or map — so I can reproduce and interrogate the figure."
- "When I need to **test an association**, I want to plot two indicators
  against each other and see the correlation with explicit caveats — so I can
  generate hypotheses without falsely claiming cause."
- "When I need to **trust the data**, I want every number to say where it
  came from, how it was computed, and when the snapshot was built — so I can
  defend the figure."
- "When I need to **get oriented**, I want to start from a map of Germany and
  click into regions — so I can explore without knowing codes or portal names."

---

## 5. Supported Geographic Hierarchy

### 5.1 Hierarchy and counts

The canonical hierarchy has three roll-up levels (plus the whole country):

| Level | Code prefix | Count (v1) | Notes |
|-------|-------------|-----------|-------|
| Federation (Bund) | `D` | 1 | `D` (Deutschland) — the national roll-up |
| Federal State (Bundesland) | `DE` (NUTS1) | 16 | e.g. `DE1` Baden-Württemberg … `DED` Sachsen |
| District / district-free city | `DE…` (NUTS3 / AGS) | 294 Landkreise + 107 kreisfreie Städte = **401** | Distinguishes `Landkreis` vs `kreisfreie Stadt` type |

- **401** is the canonical German count of districts/district-free cities at
  the LAU level (subject to the snapshot's as-of date; see §5.3).
- Each region entity carries: a stable identifier (AGS-like code), name,
  parent state, level, geographic type (Landkreis / kreisfreie Stadt /
  Bundesland / Bund), and centroid geometry for map rendering.

### 5.2 Roll-up semantics

- **A region "contains" all its descendants.** Selecting a Bundesland shows
  statistics for that state and its constituent districts are available for
  drill-down.
- Aggregating district values into state values is a **data-build-time**
  operation (the snapshot stores each region's own value; the app does not
  re-aggregate at runtime). This avoids duplication/weighting errors and keeps
  the runtime O(1) per query.
- Only **Bundesland and Landkreis/kreisfreie-Stadt** levels are exposed as
  interactive selection levels in v1; the Federation level is shown as a
  national reference benchmark (not a selectable drill target with its own
  districts roll-up beyond Länder).

### 5.3 Region-set boundary

- The region set is **fixed by the snapshot**. New regions (borough merging,
  Gebietsreform) are introduced only by a new data-build, never at runtime.
- Every snapshot records its **region catalogue version** (the boundary year)
  so readers know which territorial arrangement a figure refers to.

---

## 6. Supported Domains & Initial Indicator Categories

Seven domains. For v1 the product ships a **curated starter catalog** of
~40 indicators (concrete, not open-ended) — enough to prove all seven
analytical features without overwhelming scope. Each indicator is fully
specified: domain, name, source provider, observation level, unit, measure
type, and canonical time depth.

### 6.0 Indicator definition schema (used for every indicator)

| Field | Meaning |
|-------|---------|
| `id` | Stable semantic key, e.g. `pop_total` |
| `domain` | One of the 7 domains |
| `name` (de/en) | Human label |
| `source` | Provider + dataset id (see §13) |
| `level_available` | which hierarchy levels the indicator exists at |
| `unit` | the raw unit (persons, %, €, count, km², index…) |
| `measure_type` | one of the §7 taxonomy types |
| `time_depth` | e.g. "annual 2015 – latest" |
| `direction_good` | "higher is better", "lower is better", or "contextual" — used only to label rankings, never to editorialize |
| `note` | any methodology caveat |

### 6.1 Demography

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `pop_total` | Bevölkerung insgesamt | Destatis | normalized | persons |
| `pop_density` | Bevölkerungsdichte | Destatis | per-capita | persons/km² |
| `pop_change` | Bevölkerungsentwicklung (gegen Vorjahr / über 5 J.) | Destatis | rate | % |
| `pop_share_under18` | Anteil unter 18-Jähriger | Destatis | rate | % of population |
| `pop_share_over65` | Anteil 65+ | Destatis | rate | % of population |
| `pop_share_foreign` | Ausländeranteil | Destatis | rate | % of population |
| `mig_net` | Wanderungssaldo (Zuzüge − Fortzüge) | Destatis | absolute | persons |
| `mig_rate` | Wanderungssaldo je 1 000 Einwohner | Destatis | rate | per 1 000 |

### 6.2 Employment

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `emp_social` | Sozialversicherungspflichtig Beschäftigte am Arbeitsort | BA | absolute | persons |
| `emp_rate` | Beschäftigungsquote | BA | rate | % of 15–64 |
| `unemp_rate` | Arbeitslosenquote | BA | rate | % of civilian labour force |
| `unemp_young` | Arbeitslosenquote Jugendlicher (u25) | BA | rate | % |
| `emp_manufacturing` | Beschäftigte im verarbeitenden Gewerbe | BA | rate | % of employees |
| `emp_growth` | Wachstum der Beschäftigung (über 5 J.) | BA | rate | % |

### 6.3 Economy

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `gdp_mio` | Bruttoinlandsprodukt | Destatis | absolute | Mio € |
| `gdp_pc` | BIP je Einwohner | Destatis | per-capita | € |
| `gdp_growth` | BIP-Wachstum | Destatis | rate | % |
| `gva_share_industry` | Anteil der Industrie an der Bruttowertschöpfung | Destatis | rate | % |
| `gva_share_services` | Anteil der Dienstleistungen an der BWS | Destatis | rate | % |
| `startups` | Gewerbeanmeldungen je 10 000 | Destatis | per-capita | per 10 000 |
| `disposable_pc` | Verfügbares Einkommen je Einwohner | Destatis | per-capita | € |

### 6.4 Housing

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `dwellings_pc` | Wohnungen je 1 000 Einwohner | Destatis | per-capita | per 1 000 |
| `live_footprint` | Wohnfläche je Einwohner | Destatis | per-capita | m² |
| `rent_index` | Angebotsmiete (Index) | Destatis/eigene Notierung | index | index 2015=100 |
| `vacancy` | Leerstandsquote | BBSR/Destatis | rate | % |
| `build_permits` | Baugenehmigungen je 10 000 | Destatis | per-capita | per 10 000 |
| `new_dwellings` | Fertiggestellte Wohnungen je 10 000 | Destatis | per-capita | per 10 000 |

### 6.5 Mobility

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `cars_pc` | Pkw je 1 000 Einwohner | KBA/Destatis | per-capita | per 1 000 |
| `car_share_ev` | Anteil E-Autos am Bestand | KBA | rate | % |
| `public_transit` | Fahrgäste im ÖPNV je Einwohner | Destatis | per-capita | per person |
| `commute_time` | Durchschnittliche Pendelzeit | Bundesnetzagentur/VBB-spezifisch | absolute | min |
| `commute_pct_freeway_belt` | Berufspendler über Kreisgrenzen | Destatis | rate | % |

### 6.6 Environment

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `co2_pc` | CO₂-Emissionen je Einwohner | UBA | per-capita | t CO₂ |
| `pm10_exceed` | Tage mit PM10-Grenzwertüberschreitung | UBA | absolute | days |
| `renewables_share` | Anteil erneuerbarer Energien am Stromverbrauch | BNetzA | rate | % |
| `protected_area` | Anteil Schutzgebiete an der Fläche | UBA/BKG | rate | % |
| `waste_pc` | Siedlungsabfall je Einwohner | Destatis | per-capita | kg |

### 6.7 Infrastructure

| id | name (de) | source | measure_type | unit |
|----|-----------|--------|--------------|------|
| `broadband_pct` | Anteil Haushalte mit schnellem Breitband | BKG/BMVI | rate | % |
| `childcare_rate` | Kita-Betreuungsquote (u3) | Destatis | rate | % |
| `hospital_beds` | Krankenhausbetten je 10 000 | Destatis | per-capita | per 10 000 |
| `doctors_pc` | Vertragsärzte je 10 000 | KBV/Destatis | per-capita | per 10 000 |
| `road_density` | Straßennetzdichte | BASt | per-capita | km/km² |
| `rail_stations` | Bahnhöfe je 10 000 | BKG | per-capita | per 10 000 |

> **Note on sourcing**: some of the above (rent index, commute time) are
> assembled from multiple official inputs during data-build; each assembled
> indicator must (per §13) expose a methodology note listing its constituent
> sources. The exact catalogue may be refined in Phase 2 when the data-build
> pipeline locks which official series are cleanly available — but the schema,
> measure-type rules, and this breadth are the v1 contract.

---

## 7. Time Model & the Measures Taxonomy

This section is the analytical backbone of the whole product. Every number the
app displays is tagged with exactly one measure type, and the UI is **prohibited
from conflating** them.

### 7.1 The change-measure taxonomy

| Measure | Name | Definition | Example | Valid when |
|---------|------|-----------|---------|-----------|
| **Level** | Level | A single-period value | Population = 250 000 | Always |
| **Abs** | Absolute change | `value(t) − value(t₀)` | +1 200 persons | Level is additive/count-like |
| **%** | Percentage change | `(value(t) − value(t₀)) / value(t₀) × 100` | +2.5 % | Base `t₀` is positive and not near zero; unsuitable for already-percentage denominators where % points is correct |
| **pp** | Percentage-point change | `rate(t) − rate(t₀)` | +1.3 pp (rate from 8.1 % → 9.4 %) | The value is itself a rate/percentage; **never** apply % change to a rate |
| **PerCapita** | Normalized / per-capita | `value / population` (or per 1 000 / per 10 000 / per km²) | €45 000 / inhabitant | Cross-region or cross-time comparability required |
| **Index** | Index | `value(t) / value(base) × 100`, base period = 100 | Rent index 108.4 (2015=100) | Comparing relative growth of a level over time |

### 7.2 Rules (enforced in data-build and in the UI)

1. **% change is never computed on a negative or near-zero base.** If `t₀ ≈ 0`
   or `t₀ < 0`, the app must offer absolute change only and mark % as
   "not meaningful".
2. **Percentage-point change (pp) is the only legitimate "change" for values
   already expressed as percentages/rates.** The app must **never** compute a
   "% change of a rate" (it is misleading). Switching a rate indicator's
   change measure to pp is automatic; the UI shows `pp` in the label.
3. **The app always shows the chosen measure's unit unambiguously** in the
   label — e.g. "Δ +2.5 %" vs "Δ +1.3 pp" vs "Δ +1 200" are visually and
   textually distinct.
4. **Every chart/tooltip states the measure of the series** it plots. A user
   cannot be shown a percentage trend line labeled in ambiguous units.
5. **Per-capita measures require a population base** that exists for the
   region/period; if the base is missing, the value is shown as `n/a` with a
   note, not silently skipped.
6. Derived change measures are **precomputed in data-build** (with the exact
   formula stored), guaranteeing that what the UI shows equals what the
   methodology states.

### 7.3 Time depth

- Default v1 time window: **2015 – latest available**, annual granularity, where
  the source supports it. Indicators with shorter or longer series are
  displayed with their actual min/max explicitly stated.
- "Latest available" is per-indicator and equals the newest period present in
  the **snapshot** — not today's date. The UI always labels the periods it is
  showing (§20).

---

## 8. Conceptual Data Model

The runtime is decoupled from the DuckDB internals; this is the **semantic
contract** the API exposes.

### 8.1 Core entities

- **Region**: `id`, `level` (Bund/Bundesland/Landkreis/kreisfreie Stadt),
  `parent_state_id`, `name` (de), `ags_code`, `type`, `geometry` (vector tile
  ref), `population_series` (used for per-capita normalization).
- **Indicator**: per §6.0 schema — `id`, `domain`, `name`, `source`,
  `level_available`, `unit`, `measure_type`, `time_depth`, `direction_good`,
  `methodology_ref`.
- **Observation**: `region_id` + `indicator_id` + `period` → `value` (the
  level). One row per region/indicator/period.
- **DerivedSeries**: precomputed `Abs`/`%`/`pp`/`PerCapita`/`Index` values with
  their defining formula — so the timeline can render any requested measure
  without re-computation.
- **Rank**: for a given indicator × period × level, the ordinal position and
  percentile of each region (precomputed to keep the top tab instant and to
  guarantee tie-handling consistency).
- **Relationship**: for a given indicator pair × level × chosen periods, the
  precomputed correlation coefficient (Pearson, with `n`, `p`-value, and
  sample-size caveat). **Association only — never causation.**
- **Snapshot**: `version`, `built_at_utc`, `region_catalogue_year`,
  `source_manifest` (list of provider + dataset + retrieval date), summary
  stats.

### 8.2 IDs & stability

- Region ids use the official AGS-style codes so they match source
  documentation.
- Indicator ids are semantic slugs (`pop_total`) that do **not** change between
  snapshots unless the underlying definition changes (in which case a new id /
  a deprecation note is published).
- No client-generated ids; the app never creates entities.

---

## 9. Page-Level Specification

Seven major areas. Each section defines **exact page responsibilities**,
**inputs/controls**, **rendered content**, and **interactions**. Every page is
read-only; no page step may depend on user-uploaded data.

### 9.1 Explore (`/explore`)

**Responsibility**: the entry point and geographic on-ramp. Answer "what is
the value of indicator I across Germany in period P?" and let the user drill
from the national map into a region.

**Controls**:
- **Indicator selector** (domain-grouped).
- **Measure selector** (Level / Abs / % / pp / Index — as valid for the chosen
  indicator per §7).
- **Period selector** (from snapshot's time range).
- **Geographic level** toggle: Bundesland | Landkreis.
- **Map interaction**: click a region to select it.

**Content**:
- Choropleth map of Germany (ECharts/MapLibre), coloured by the selected
  indicator, with a legend and value labels on hover.
- A summary "top / bottom" strip (e.g. highest and lowest region with values).
- A list/grid of regions with their values for the selected period.
- A national distribution histogram (optional but present for context).

**Interactions**:
- Clicking a region **navigates to Region Profile** for that region (same
  indicator preserved in context).
- Changing indicator / measure / period / level re-renders map + list
  synchronously.
- "Explain this selection" affordance links to the indicator's methodology.

**URL**: `/explore?ind=pop_change&period=2023&level=landkreis`

### 9.2 Region Profile (`/region/[id]`)

**Responsibility**: the single-region story. Answer "how is THIS region doing
— now, over time, versus its peers — and why/with what?" It is the deepest,
most content-dense page.

**Content, top to bottom**:
1. **Header**: region name, type, parent state, AGS code, snapshot as-of.
2. **KPI metric blocks** (top 6–8 indicators): headline value, latest-period
   change (correct measure per §7), national rank + percentile, and a small
   sparkline of the trend.
3. **Regional overview / highlights**: a short auto-generated synthesis (see
   §11) listing the region's standout strengths/weaknesses, each traceable to
   a value.
4. **Historical trends**: ECharts line/area charts for each domain
   (selectable indicator), clearly labelled with measure and unit.
5. **Benchmarks**: each trend is overlaid with the Bundesland average and the
   national (Bund) average for context.
6. **Rankings**: the region's rank across all indicators — a compact table
   showing position in the Bundesland and in Germany.
7. **Key changes**: a changelog-style list of the largest changes
   (population, employment, CO₂, etc.) across recent periods.
8. **Analytical insights**: the §11 insight blocks.
9. **Sources**: per-indicator source attribution and links into Methodology
   (§9.7).

**Controls**: indicator (by domain) | period range | benchmark toggles.

**Interactions**:
- Click "Compare" on the header to seed a Compare session with this region as
  the first participant.
- Clicking a region within any mapped context drills deeper (not applicable
  at Landkreis level).
- Copy/deep-link the current region view (read-only shareable URL).

**URL**: `/region/DExxx`

### 9.3 Compare (`/compare`)

**Responsibility**: side-by-side comparison of **2–4 regions** on a chosen
indicator set. Answer "who does better/worse, and by how much?"

**Controls**:
- Region picker (2–4 regions; add/remove).
- Indicator set selector (multiselect across domains).
- Period range.
- Synchronization toggle: whether all region charts share an axis/period.

**Content**:
- **Synchronized comparison charts**: one ECharts panel per chosen indicator
  with all selected regions overlaid (line chart) and synchronized tooltip
  crosshair.
- **Rankings side-panel**: the selected regions' ranks and percentiles for
  each chosen indicator.
- **Major differences**: an auto-computed list of the largest cross-region
  gaps per indicator (e.g. "Regions A vs B differ by +X % on CO₂").

**Interactions**:
- Hovering a point on one region's line highlights that period across all
  region lines (`sync`).
- Clicking a "major difference" navigates to the underlying comparison chart
  with that indicator focused.
- Clear/refill region set.

**URL**: `/compare?regions=DE1,DE911&ind=pop_change,unemp_rate`

### 9.4 Rankings (`/rankings`)

**Responsibility**: rank all regions at a chosen level for one indicator and
period, in both table and map form.

**Controls**:
- Indicator selector.
- Measure (Level typically; % for change-based ranking optional as valid).
- Geographic level (Bundesland | Landkreis).
- Period.
- Sort order & direction toggle; optional filter to a single Bundesland.

**Content**:
- **Ranked table**: position, region, value, delta vs previous period,
  percentile; columns sortable.
- **Map**: choropleth using the **same** value → so table and map are
  coherent.
- Summary: count of regions, best/worst, median.

**Interactions**:
- Clicking a table row or map region → Region Profile.
- Column sorting recalculates order (rank is snapshot-precomputed per
  indicator×period×level).

**URL**: `/rankings?ind=gdp_pc&period=2023&level=landkreis`

### 9.5 Data Explorer (`/explorer`)

**Responsibility**: the power tool for interrogating a single tri-dimensional
cube (indicator × geography × period) with transformations, presented as a
table, chart, or map. Everything is precomputed; there is no upload or
import — this page explores **the snapshot only**.

**Controls**:
- **Indicator** selector.
- **Geography**: level, region(s) — multi-select, or "all".
- **Period**: range.
- **Transformation** (measure): Level / Abs / % / pp / Index, as valid (§7).
- **Pivot orientation**: which dimension goes on rows vs columns (indicator /
  region / period).
- **View toggle**: Table | Chart | Map.

**Content**:
- Data table with the chosen orientation and transformation.
- Side-by-side chart (line/bar) and/or map for the selected slice.
- Cell-level tooltip showing value + measure + source.

**Interactions**:
- Cross-highlighting between table/chart/map (selecting a row highlights the
  matching series).
- Export is **read-only shares/links**, not CSV generation from arbitrary
  selection if it would imply a write path; a "copy link" to the exact query
  is provided (see §14 non-goal on export-as-a-service clarification).

### 9.6 Relationship Explorer (`/relationships`)

**Responsibility**: test **associations** between two indicators across
regions. Strictly correlation-hypothesis tooling; **never causation**.

**Controls**:
- Indicator X, Indicator Y.
- Geographic level.
- Period (or period average).
- Optional colour-by domain/region-type; optional hover highlighting of a
  specific region.

**Content**:
- **Scatter plot** of X vs Y, one point per region, regression trendline.
- **Correlation panel**: Pearson r, n, p-value, and an explicit
  **"association, not causation"** disclaimer with a link to Methodology.
- **Regional highlighting**: click/hover a point to identify the region and
  jump to its profile.

**Interactions**:
- Hover/click points for region identity.
- Switch X/Y.
- Outlier emphasis.

**Mandatory behavior**: the correlation coefficient and null-hypothesis
caveats are **always** shown alongside the plot; the word "causation"/"cause"
is never applied. See §12.2.

**URL**: `/relationships?x=pop_change&y=gdp_growth&level=landkreis`

### 9.7 Methodology / Sources (`/methodology`)

**Responsibility**: explain how the data is produced and where it comes from
— the trust layer.

**Content**:
- **Source register**: per provider, the datasets used, their official
  identifier, retrieval date, and license note.
- **Indicator methodology**: per indicator — definition, unit, basis
  (population, labour force, area), formula for derived measures, caveats.
- **Measures taxonomy** explanation (Level / Abs / % / pp / PerCapita / Index)
  in plain language.
- **Geographic methodology**: region catalogue year, hierarchy, boundary
  change handling.
- **Statistical methodology**: how ranks, percentiles, correlations, and
  trends are computed (Pearson, least-squares linear trend, significance
  threshold and its caveats); the explicit correlation-≠-causation statement.
- **Snapshot manifest**: version, build timestamp, source versions, build
  steps.
- **Missing-data handling**: how `n/a`, suppressed values (Datenschutz/
  Geheimhaltung), and zero bases are treated.

---

## 10. Navigation Model

### 10.1 Primary navigation

A persistent top navigation bar offers the **seven destinations**:

```
Explore | Region Profile | Compare | Rankings | Data Explorer | Relationships | Methodology/Sources
```

- **Explore** is the default landing page.
- The nav is present on every page and always reflects the current selection
  where relevant (e.g. a globally selected region/indicator carries across).
- No deep multi-level menus in v1; all destinations are one click away.

### 10.2 Global context state

A lightweight, **persisted-in-URL** context carries the current (region,
indicator, period, measure, level) so that:
- Navigation is deep-linkable and shareable.
- Region Profile → Compare preserves the selected indicator/region.
- Users returning to Explore keep their selections.

Zustand holds only **client UI transient state** that does not belong in the
URL (e.g. a temporarily expanded accordion, a map's current viewport, chart
zoom). The URL is the canonical context; state store is a thin auxiliary. This
is the only "genuinely necessary" use of Zustand — it is not used for data
fetching (TanStack Query handles that).

### 10.3 Breadcrumbs & drill-down

- Region entities form a breadcrumb: **Deutschland → Bundesland → Landkreis**.
- Explore provides the primary drill-down (click region → Region Profile).

### 10.4 Data-fetching pattern

- All reads go through **TanStack Query** with a per-URL cache key derived
  from the (snapshot version, query). Client-side caching makes repeated
  navigation instant and offline-friendly for a given snapshot.

---

## 11. Analytical Capabilities & Insight Behavior

### 11.1 What "insights" are

An **insight** is a short, machine-generated, human-readable statement about
the data. Every insight **must**:
- be **traceable** to specific (region, indicator, period, value, formula);
- carry a **confidence/validity** qualifier when appropriate;
- be **neutral** — it reports what the data shows, never prescribes policy
  and never editorializes "good"/"bad" beyond an objective, flagged
  direction label.

### 11.2 The insight engine contract

Computed in the data-build stage; served read-only. Insight types:

1. **Level beats**: "Region X has the highest `pop_density` in its state
   (position 3 of 401 nationwide)." — traceable to rank tables.
2. **Trend**: "`pop_total` fell by −1.2 % over 2015–2023 (−3 100 persons),
   a steeper decline than the state average of −0.4 %." — traceable to
   %/Abs values and benchmark.
3. **Key change**: "Largest 2-year change: `unemp_rate` +1.6 pp (2021→2023)."
4. **Benchmark gap**: "Region is 18 % above the national average for
   `disposable_pc`."
5. **Association (careful)**: "Across Länder, `pop_change` and `gdp_growth`
   are positively correlated (r = 0.62). **This shows an association, not a
   causal link.**" — only from the Relationship module, always with the
   disclaimer.

Each insight object stores its **evidence**: the exact values, the formula,
the source ids, and the period — so the UI can render "why am I seeing this?"
links that open the relevant Data Explorer slice.

### 11.3 Presentation rules

- Insights appear as cards on Region Profile and as contextual notes on
  Rankings/Explore.
- Each card has a "Details" affordance that shows the traceable values and
  methodology.
- Insights never compete with the base data; the raw value always remains
  visible.

### 11.4 Statistical analysis scope (thin, honest)

The product performs **descriptive** and light **inferential** statistics,
always with caveats:

- **Measures of centre/spread** (mean, median, min/max, std) across regions.
- **Ranks and percentiles** (precomputed, tie-consistent).
- **Linear trend** (least-squares slope over a chosen window) for timelines.
- **Pearson correlation** (n ≥ 10 regions recommended; p-value and n always
  shown; small-n disclaimers enforced).
- Explicitly **out of scope**: causal inference, panel econometrics, ML model
  predictions for users. Machine learning (scikit-learn) is used **in
  data-build only** for data-cleaning/sanity-checking, never to generate
  user-facing predictions in v1.

### 11.5 Statistical integrity rules

- Any derived statistic shown must have its **method and inputs** stated.
- Aggregations across regions are done consistently (population-weighted where
  a rate is aggregated); the aggregation method is stated per indicator.
- Suppressed/unavailable values are shown as `n/a` with a reason, and are
  excluded from correlation/rank computations with the exclusion noted.

---

## 12. Data Transparency & Methodology Requirements

### 12.1 Transparency rules (binding)

1. **Every displayed value is attributable**: a source + dataset id + period
   is reachable from any chart/table/map tooltip via a "Source" affordance.
2. **Snapshot identity is always visible**: "Data as of {snapshot built date},
   snapshot vX.Y.Z" appears in page footers and the Methodology page.
3. **Basis is explicit**: per-capita and rate values state their basis
   (e.g. "per 1 000 Einwohner", "% of civilian labour force").
4. **Missing/suppressed data is disclosed**, not hidden.
5. **License/usage notes** per source are recorded and surfaced on the
   Methodology page.
6. No value is presented as current if its latest period predates the
   snapshot bound.

### 12.2 Correlation ≠ causation (binding)

- The **Relationship Explorer** always shows: Pearson r, n, p-value, and the
  explicit statement "Correlation does not imply causation; other factors may
  explain the association."
- The words "causes", "because of", "leads to", "results from" are **never**
  generated by the insight engine for relationship results.
- Language on this point is hard-coded and centrally managed (not
  LLM-freestyle) to guarantee the guarantee.

### 12.3 Sources register (see §9.7)

For each provider, the Methodology page lists the exact datasets used, their
official identifier, the retrieval/processing date, and licence — so a reader
or a data maintainer can reconstruct the snapshot.

---

## 13. Methodology Requirements

- The **methodology is part of the product**, an equal title to the data views,
  not a footnote.
- Every indicator references a methodology entry (§6.0 `methodology_ref`) that
  explains: definition, unit, basis, formula for derived measures, caveats,
  and known limitations.
- The **Measures taxonomy** (§7) is documented in plain language on the
  Methodology page so non-experts can trust change numbers.
- Boundary/region change handling is documented: when districts merge or
  rename, the snapshot provides continuity notes so trends are not silently
  distorted.
- Aggregation and statistical methods are documented per §11.4/§11.5.

---

## 14. Non-Goals

The product **explicitly does not**:

1. **Allow any data upload, edit, creation, or deletion** (any user role).
2. **Offer authentication / user accounts / authorization**. Analytics by
   region are public; there is no protected content.
3. **Provide social features** (comments, sharing feeds, follows, ratings).
4. **Provide an admin dashboard** or data-management UI.
5. **Run ingestion / scheduling at runtime** (no Kafka, Airflow, Kubernetes,
   or microservices). Everything is precomputed offline.
6. **Connect the app to live external APIs** from the browser/server at
   runtime. All source integration is offline in data-build.
7. **Offer arbitrary big-data / data-warehouse features**: the snapshot is a
   curated, bounded dataset, not an open query engine for user SQL over
   arbitrary data.
8. **Present causal claims or predictions.** No "what will happen next" rotor
   forecasts; no user-facing ML predictions in v1.
9. **Export raw arbitrary CSVs as a productised service.** (Read-only copies /
   shareable deep links are provided; bulk export policy is a later-phase
   decision — see §15.6.)
10. **Support free-text natural-language querying in v1.** Queries are
    structured selectors and predefined insights. (See roadmap.)
11. **Process personal/individual-level data.** Only aggregate official
    statistics; compliance is bounded to public aggregate data.
12. **Multi-language UI beyond German in v1** (English labels may be added in
    the schema for developers, but the shipped UI is German).

---

## 15. Future Features Explicitly Excluded from v1 (Roadmap)

These are deferred deliberately; listing them here prevents scope creep in v1
while documenting intent.

### 15.1 Delayed to Phase ≥2 (post-v1 snapshot build)
- Finalized, locked indicator catalogue and the full data-build pipeline.
- Regional boundary–change handling tooling.

### 15.2 Roadmap (post-v1, not committed to any release)
1. **Personalisation / dashboards** — requires accounts (excluded from v1 by
   design).
2. **Alerts / watchlists** on a region's key indicators — requires accounts
   and a notification service.
3. **Natural-language querying** over the snapshot — a feasibility-led
   follow-on.
4. **More domains / finer territory levels** (Gemeinden / LAU level, GIS
   cells) — scope and performance to be evaluated against the snapshot size.
5. **English UI/UX** — localization layer.
6. **Bulk / tabular export** (CSV/XLSX download of a sliced query) as a
   productised read-only capability — a deliberate and independent later
   decision because it borders on data-delivery; not in v1.
7. **Time-series predictions / trend forecasting UI** — only once the
   association/causation governance is mature; not in v1.
8. **Offline/PWA snapshot mode** — possible, but not required for v1.

### 15.3 Explicitly rejected (will not be added)
- Runtime ingestion, microservices, Kafka, Airflow, Kubernetes, user uploads,
  auth, social features, admin dashboards (§14).

---

## 16. UX Principles

1. **Consistent primitives**: KPI metric blocks, tables, charts, and insight
   cards use the same layout and semantics everywhere they appear.
2. **No dead ends**: every chart/table/map cell that is meaningful is
   clickable or has an explicit affordance; nothing implies interactivity that
   is absent.
3. **Predictable drill-down**: map → region profile → compare follows a
   consistent, learnable pattern.
4. **The number owns the screen**: charts annotate their headline value,
   measure, unit, and period; tooltips provide detail; the base value is never
   hidden behind a visual.
5. **"Why am I seeing this?"**: every insight and every analytical claim has a
   traceable "Details" affordance (§11.3).
6. **Progressive disclosure**: novices get defaults and plain-language labels;
   advanced controls (transformations, pivot, correlation settings) unfold on
   demand without cluttering.
7. **State is in the URL**: refresh-safe, shareable, back-button friendly.
8. **Forgiving inputs**: clear empty/loading/error states; a sensible default
   selection on every page so no page is ever blank-scary.
9. **Consistent empty/loading**: skeletons, not jumpy content; explicit
   "no data for this selection" rather than silent omissions.
10. **Accessible affordances** for all interactions (§19).

---

## 17. Visual Design Principles

Built on **Tailwind CSS + shadcn/ui** design tokens; charts in **ECharts**;
maps in **MapLibre GL**.

1. **Neutral, data-first canvas**: generous white space, restrained
   chrome; the data, not the chrome, is the visual hero.
2. **Clear typographic hierarchy**: page title → section → KPI value; the
   headline number is the largest text element of its block.
3. **Color has strict semantics**:
   - **Identity/semantic colors** (Bundesland colours, brand, accents) never
     collide with **data value colors**.
   - **Quantitative choropleths** use one sequential ramp (e.g. light→dark)
     with a legend; never a rainbow unless the indicator is inherently
     diverging (where a diverging ramp is used, a zero midpoint is labelled).
   - Consistent "higher vs lower vs contextual" hint colours, kept objective.
4. **Measures are visually distinct**: change-measure labels use
   distinguishable glyph/units so `%` vs `pp` vs absolute are never confused.
5. **Consistent component tokens** across shadcn components (radius, spacing,
   border) rather than ad-hoc styling.
6. **Trust cues**: source/snapshot labels are visually consistent and
   persistent (footer/text-muted), signalling provenance without shouting.
7. **Maps**: legible base, distinct selected region, choropleth legend, and
   clear hover/click states; aria-label on the map container.
8. **Responsive**: usable at ≥1024px fully; core journeys (Explore, Profile,
   Rankings) gracefully degrade to a mobile stacked layout.

---

## 18. Performance Expectations

Because all computation is **precomputed**, targets are aggressive and
achievable:

| Scenario | Target | Justification |
|----------|--------|--------------|
| Initial page load (Explore) | ≤ 2.0 s to interactive (mid-range device, broadband) | Static assets + snapshot queries |
| View switch (Explore→Profile, etc.) | ≤ 300 ms (cached feel) | TanStack Query cache + precomputed ranges |
| Any standard dashboard query | ≤ 250 ms server response (p95) | Bounded snapshot in DuckDB |
| Map pan/zoom | 60 fps target, no jank on mid-range | Static vector tiles + precomputed grids |
| Rankings sort / filter | instant (< 100 ms) | Precomputed ranks |
| Relationship scatter | instant re-render on X/Y switch | Precomputed correlation table |

**Principles**:
- No heavy client-side recompute; the server returns precomputed series.
- Assets: Vite code-splitting, lazy-loaded route chunks, small tiled map data.
- Network: thin API payloads; only requested slices.

---

## 19. Accessibility Expectations

Binding target: **WCAG 2.1 AA**.

1. **Keyboard operable**: all controls, tables, charts reveal, and map
   navigation reachable and operable by keyboard.
2. **Screen-reader parity**: charts expose a **data table** or an
   `aria-label`/described summary; KPI blocks have text equivalents; the map has
   an accessible region list fallback.
3. **Non-color encoding**: choropleths and charts pair color with text/labels
   or patterns, never rely on color alone (also supports colour-blind users).
4. **Contrast**: AA contrast ratios per design tokens.
5. **Focus management**: visible focus states; sensible focus order; skip
   links.
6. **Respect reduced motion**: animations honour `prefers-reduced-motion`.
7. **Semantic HTML + landmarks**: header/nav/main/footer; tables use proper
   headers.
8. **Form-like controls** (selectors) are real form elements with labels.
9. **Language**: `lang="de"` declared; German UI text.

---

## 20. Data Freshness / Snapshot Philosophy

1. **Snapshot is the truth.** The app reflects exactly what is in the
   deployed snapshot — nothing fresher, nothing stale-by-intent.
2. **Versioned & immutable**: every snapshot has a version and build time;
   old snapshots are reproducible from the source manifest.
3. **"As of" labeling**: every page footer and the Methodology page show
   "Data as of {date}, snapshot vX.Y.Z; source catalogue year YYYY."
4. **Per-indicator freshness**: different official series update on different
   schedules; each indicator states its latest available period within the
   snapshot. The app never implies a value is current when its last period is
   in the past relative to the build.
5. **No runtime refresh**: the app never re-fetches or reconciles against live
   sources; updating data = building and deploying a new snapshot (owned by the
   data-build team/CI, Phase 2+).
6. **Rebuild workflow belongs to the data-build stage** (Python + DuckDB +
   GeoPandas), outside the web app scope. The web app is a pure consumer.

---

## 21. Technology Mapping

| Concern | Technology | Role in this product |
|---------|-----------|----------------------|
| Web UI framework | React + TypeScript | Views, state model |
| Build/dev server | Vite | Bundling, dev tooling |
| Styling | Tailwind CSS + shadcn/ui | Design tokens, components |
| Server state / data fetching | TanStack Query | Read cache keyed by snapshot+query |
| Client UI state | Zustand | Only transient UI state not in URL (viewport, open panels) |
| Charts | Apache ECharts | Trends, scatters, distributions, rankings |
| Maps | MapLibre GL | Germany choropleth + drill-down (tiled vectors) |
| Data-build language | Python | All offline pipeline; owns data truth |
| Snapshot storage/query | DuckDB | Immutable snapshot, read API queries |
| Data manipulation (build) | Polars | Fast tabular cleaning/aggregation |
| Numerics / statistics (build) | NumPy, SciPy, scikit-learn | Ranks, percentiles, correlations, trends, sanity checks |
| Geospatial (build) | GeoPandas, Shapely | Joins, geometry, vector-tile prep |
| API | FastAPI | Read-only query service |

---

## 22. Glossary

- **Bund / Bundesland / Landkreis / kreisfreie Stadt** — Federation / federal
  state / district / district-free city.
- **AGS / Region Key** — official German municipality/district code used as
  stable region id.
- **KPI** — key performance indicator; a headline metric block.
- **Measure type** — the semantic kind of a value (level, absolute change, %
  change, pp change, per-capita, index); see §7.
- **pp** — percentage point; the unit of difference between two rates.
- **Percentile** — rank expressed as a percentage; e.g. "top 10 %".
- **Data-build stage** — the offline Python pipeline that produces the
  snapshot; distinct from the web app.
- **Snapshot** — one immutable, versioned release of the whole dataset.
- **Association vs causation** — a correlation between two measures does not
  prove one causes the other; always disclosed.
- **Choropleth** — a map shaded by a data value.

---

## Appendix A — Indicator Catalogue Summary

| Domain | # indicators (v1) | Representative sources |
|--------|------------------|------------------------|
| Demography | 8 | Destatis / GENESIS |
| Employment | 6 | Bundesagentur für Arbeit |
| Economy | 7 | Destatis |
| Housing | 6 | Destatis, BBSR |
| Mobility | 5 | KBA, Destatis, BNetzA |
| Environment | 5 | UBA, BNetzA, BKG |
| Infrastructure | 6 | BKG, BMVI, Destatis, KBV |
| **Total** | **≈ 43** | (refinable in Phase 2) |

**Key guarantees enforced for every indicator** (checked during validation):
- has an unambiguous `measure_type` and unit;
- has a real official source + methodology ref;
- does not permit a mathematically invalid change measure (§7.2);
- is available at a stated level; per-capita indicators have a population base.

---

*End of product specification. This document is the authoritative reference for
Phase 2 implementation; later phases must remain consistent with it.*
