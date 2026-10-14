"""pipeline/flood_detection/polygonize.py — Flood mask polygonization stub."""

from __future__ import annotations

from pipeline.contracts import FloodMask, FloodPolygons
from pipeline.exceptions import NotImplementedStage


def run(mask: FloodMask) -> FloodPolygons:
    """Convert binary flood raster into cleaned vector polygons (GeoJSON).

    Extracts vector contours from raster, filters out slivers smaller than
    minimum_polygon_area_m2, and exports valid GeoJSON in EPSG:4326.

    Args:
        mask: Binary flood mask raster with explicit CRS.

    Returns:
        FloodPolygons: Path to GeoJSON file and polygon metadata.

    Raises:
        NotImplementedStage: Flood mask polygonization has not been implemented.
    """
    raise NotImplementedStage(
        "polygonize",
        "Flood mask polygonization has not been implemented.",
    )
