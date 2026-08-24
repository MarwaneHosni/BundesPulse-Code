"""Insights package (foundation placeholder).

Per the product spec §11, an insight is a short, machine-generated,
human-readable statement about the data. Every insight must be *traceable* to
specific (region, indicator, period, value, formula) and must never present
correlation as causation.

A future phase will implement the insight engine here or in the pipeline, and
materialise insights into the snapshot so they are served read-only by the
backend.
"""
