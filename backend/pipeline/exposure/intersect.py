"""pipeline/exposure/intersect.py — Flood and infrastructure spatial intersection stub."""

from __future__ import annotations

from pipeline.contracts import ExposureResult, FloodPolygons, OsmLayers
from pipeline.exceptions import NotImplementedStage


def run(osm: OsmLayers, flood_polygons: FloodPolygons) -> ExposureResult:
    """Intersect OSM infrastructure features with flood polygons.

    Performs spatial overlay in a projected coordinate system to calculate
    potentially affected buildings, submerged road lengths, and affected bridges.

    Args:
        osm: Historical OSM layers.
        flood_polygons: Cleaned flood vector polygons.

    Returns:
        ExposureResult: Count and identifiers of affected infrastructure.

    Raises:
        NotImplementedStage: Infrastructure exposure intersection has not been implemented.
    """
    raise NotImplementedStage(
        "exposure_intersect",
        "Infrastructure exposure intersection has not been implemented.",
    )
