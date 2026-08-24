"""Deutschland Digital Monitor — backend package.

The backend is a read-only FastAPI service over a pre-computed, immutable
DuckDB snapshot. It never writes data, never ingests external sources at
runtime, and never mutates state.
"""

__version__ = "0.1.0"
