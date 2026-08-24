"""Shared helpers for the source fetchers.

The canonical region ids follow the **official German AGS** (Amtliche
Gemeindeschluessel):

* `DE` = Deutschland (Federation)
* Bundeslaender: the official two-digit federal-state codes 01-16
  (01 Schleswig-Holstein ... 16 Thueringen)
* Kreise: the official five-digit AGS (parent = first two digits = Land)

These codes are used consistently across all fetchers and by the DuckDB build.
"""

from __future__ import annotations

COUNTRY_ID = "DE"

# Official federal-state AGS codes (Statistische Ämter / Destatis ordering).
LAND_AGS: dict[str, str] = {
    "Schleswig-Holstein": "01",
    "Hamburg": "02",
    "Niedersachsen": "03",
    "Bremen": "04",
    "Nordrhein-Westfalen": "05",
    "Hessen": "06",
    "Rheinland-Pfalz": "07",
    "Baden-Württemberg": "08",
    "Bayern": "09",
    "Saarland": "10",
    "Berlin": "11",
    "Brandenburg": "12",
    "Mecklenburg-Vorpommern": "13",
    "Sachsen": "14",
    "Sachsen-Anhalt": "15",
    "Thüringen": "16",
}

# Official five-digit AGS prefix -> region_id of the parent Bundesland.
KREIS_AGS_PREFIX_TO_LAND = {code: code for code in LAND_AGS.values()}


def land_id_by_name(name: str) -> str | None:
    """Return the official two-digit region id for a Bundesland name."""
    return LAND_AGS.get(name.strip())


def kreis_parent(ags5: str) -> str | None:
    """Return the parent Land region id for a five-digit Kreis AGS."""
    if len(ags5) >= 2 and ags5[:2] in KREIS_AGS_PREFIX_TO_LAND:
        return KREIS_AGS_PREFIX_TO_LAND[ags5[:2]]
    return None


def normalize_kreis_name(name: str) -> str:
    """Normalise a Kreis name for matching across sources (case-insensitive)."""
    import re as _re

    n = name.strip()
    for token in ("landkreis ", "stadtkreis ", "kreis ", "stadt ", "kreisfreie stadt "):
        if n.lower().startswith(token):
            n = n[len(token) :]
    # Strip trailing qualifiers such as "Stuttgart (Stadtkreis)",
    # "Darmstadt, Wissenschaftsstadt", "Kiel, Landeshauptstadt".
    n = _re.sub(r"\s*\([^)]*stadt\)$", "", n, flags=_re.IGNORECASE)
    n = _re.sub(r",\s*[^,]*stadt$", "", n, flags=_re.IGNORECASE)
    n = n.replace(", Stadt", "").replace(" i. Bay.", "")
    return n.strip()
