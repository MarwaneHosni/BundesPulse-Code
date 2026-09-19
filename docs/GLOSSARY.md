# Glossar — Begriffe im Produkt

Ein Begriff pro Konzept, überall gleich verwendet. UI‑Sprache ist Deutsch,
Satzschreibung, aktive Verben.

## Kernbegriffe

| Begriff (UI) | Intern / Code | Bedeutung |
|---|---|---|
| **Region** | `region` / `region_id` | Ein geografisches Gebiet: Bund, Bundesland oder Kreis. Nie „Gebiet“, „Einheit“ oder „Entität“ in der Oberfläche. |
| **Indikator** | `indicator` / `slug` | Eine Kennzahl mit Einheit und Zeitreihe (z. B. „BIP je Einwohner“). Im Datenkatalog stehen 111. |
| **Zeitraum** | `period` / `year` | Ein Jahr, für das Werte vorliegen. In Auswahlfeldern „Zeitraum“, in Sätzen „2024“. |
| **Ebene** | `level` (`bund` \| `bundesland` \| `kreis`) | Die geografische Auflösung. Ein Indikator kann auf mehreren Ebenen vorliegen; fehlt eine Ebene, wird das gesagt, nicht leer gezeigt. |
| **Rang** | `rank_desc` / `rank_asc` | Position einer Region bei einem Indikator und Zeitraum. Richtung ist eine Eigenschaft des Indikators. |
| **Perzentil** | `percentile` | Anteil der Regionen mit gleichem oder niedrigerem Wert (0–100). |
| **Quelle** | `source` / `source_ids` | Offizieller Anbieter + Datensatz + Stand + Link. Jede Zahl ist bis zur Quelle nachvollziehbar. |
| **Snapshot** | `deutschland.duckdb` | Der vorbereitete, unveränderliche Datenbestand. Alle Anzeigen lesen ausschließlich daraus. |

## Ebenen und Geografie

| Begriff | Bedeutung |
|---|---|
| **Bund** | Deutschland als Ganzes („DE“). |
| **Bundesland** | Eines der 16 Länder (AGS 01–16). |
| **Kreis** | Landkreis oder kreisfreie Stadt (5‑stellige AGS). ~400. |
| **Kreisfreie Stadt** | Ein Kreis, der nur eine Stadt umfasst. In Listen als Typ ausgewiesen. |
| **Land** | Kurzform für Bundesland – nur im Fließtext, in Auswahlfeldern immer „Bundesland“. |
| **AGS** | Amtlicher Gemeindeschlüssel (stabile Regionskennung). |

## Analyse-Begriffe

| Begriff (UI) | Intern | Bedeutung |
|---|---|---|
| **Veränderung** | `yoy_pct`, `percentage_change` | Prozentuale Änderung gegenüber dem vorherigen Zeitraum. Bei Anteilen zusätzlich in Prozentpunkten. |
| **Gegenüber Deutschland** | `vs_de_ratio` | Wert ÷ Bundeswert. In Diagrammen divergierende Skala, Mitte = Bundeswert. |
| **Gegenüber dem Bundesland** | `vs_land_ratio` | Wert ÷ Landeswert. Nur für Kreise; ergänzt den Bundesvergleich. |
| **Einordnung** | `PositioningBar` | Rang/Perzentil im eigenen Bundesland **und** bundesweit – immer beide Kontexte. |
| **Streuung** | (Gap G4) | Spannweite zwischen oberstem und unterstem Fünftel – wie ungleich ein Indikator streut. |
| **Fingerabdruck** | `RegionFingerprint` | 12 Kategorien‑Perzentile einer Region auf gemeinsamen Achsen; über alle Regionen vergleichbar. |
| **Ähnliche Regionen** | (Gap G3) | Regionen mit ähnlichem Fingerabdruck. Ähnlichkeit veröffentlichter Kennzahlen, keine Bewertung. |
| **Kurzfassung** | `GeneratedSummary` | Automatisch aus dem Snapshot erzeugter Satz zur Region. Kein Sprachmodell, keine Laufzeitabfrage. |

## Werkzeuge (Seiten)

| Titel | Route | Beantwortet |
|---|---|---|
| **Karte** | `/` und `/explore` | „Wie ist die Lage wo ich lebe?“ – Deutschland flächig lesen. |
| **Regionen** | `/region/:regionId` | Steckbrief einer Region: Überblick, Trends, Vergleiche, Quellen. |
| **Vergleichen** | `/compare` | „Wie schlagen sich diese 2–4 Regionen nebeneinander?“ |
| **Ranglisten** | `/rankings` | „Wer führt bei diesem Indikator?“ |
| **Daten** | `/explorer` | Der vollständige Katalog (111 Indikatoren) mit Tabelle, Karte und CSV. |
| **Zusammenhänge** | `/relationships` | „Hängen zwei Indikatoren zusammen?“ (Korrelation ≠ Kausalität). |
| **Methodik** | `/methodology` | Quellen, Definitionen, Berechnung, Grenzen. |

## Einheiten (Anzeige‑Zuordnung)

Interne Einheiten sind teils englisch; die Oberfläche zeigt deutsche kürzel:

| intern | Anzeige |
|---|---|
| `percent`, `Prozent` | `%` |
| `persons` | `Personen` |
| `Anzahl` | `Anzahl` |
| `EUR`, `Mio EUR`, `Tsd. EUR` | `€`, `Mio. €`, `Tsd. €` |
| `per 10 000` | `je 10.000` |
| `per 1000` | `je 1.000` |
| `points` | `Ladepunkte` |
| `dwellings` | `Wohnungen` |
| `accidents` | `Unfälle` |
| `years` | `Jahre` |
| `µg/m³`, `ha`, `kg`, `l`, `qm`, `Tage` | unverändert |

Zahlenformat immer `de-DE` (`1.234.567,89`, `12,3 %`, `62.200 €`). Nie
US‑Format.

## Schreibregeln

- Satzschreibung, keine durchgehenden Großbuchstaben.
- Aktive Verben: „Region vergleichen“, „Indikator wählen“, „Werte herunterladen“.
- Leere Zustände sagen, was zu tun ist. Fehler sagen, was passiert ist und was
  hilft – ohne Entschuldigung.
- Ein Konzept, ein Wort: nie „Kennzahl“ und „Indikator“ gemischt für dasselbe;
  „Kennzahl“ ist nur die Obermenge in Fließtext‑Überschriften.
- Keine Metazeilen mit Mittelpunkt („A · B · C“) und kein „→“ an Links.
