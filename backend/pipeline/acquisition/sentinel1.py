"""pipeline/acquisition/sentinel1.py — Sentinel-1 scene pair acquisition stub."""

from __future__ import annotations

from typing import Any

from pipeline.contracts import ScenePair
from pipeline.exceptions import NotImplementedStage


def find_pair(bbox: list[float], event_date: str, config: Any) -> ScenePair:
    """Find a matching Sentinel-1 pre/post event scene pair.

    Searches Copernicus Data Space Ecosystem for Sentinel-1 GRD scenes covering bbox.
    Enforces same relative orbit, acquisition mode, and polarization geometry.

    Args:
        bbox: [west, south, east, north] bounding box coordinates.
        event_date: Event date formatted as 'YYYY-MM-DD'.
        config: Pipeline Config object containing search parameters.

    Returns:
        ScenePair: Matched before/after product IDs and acquisition metadata.

    Raises:
        NotImplementedStage: Sentinel-1 scene acquisition has not been implemented.
    """
    raise NotImplementedStage(
        "acquisition",
        "Sentinel-1 scene acquisition has not been implemented.",
    )
