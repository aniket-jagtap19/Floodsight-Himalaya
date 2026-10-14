"""pipeline/exposure/osm.py — Historical OSM data snapshot fetcher stub."""

from __future__ import annotations

from pipeline.contracts import OsmLayers
from pipeline.exceptions import NotImplementedStage


def fetch_snapshot(bbox: list[float], osm_date: str) -> OsmLayers:
    """Fetch historical OpenStreetMap snapshot for the AOI via ohsome API.

    Retrieves pre-event geometry layers for buildings, roads, bridges, and settlements
    strictly as of osm_date to preserve historical alignment (Rules §12).

    Args:
        bbox: [west, south, east, north] bounding box coordinates.
        osm_date: Snapshot date as 'YYYY-MM-DD'.

    Returns:
        OsmLayers: File paths to fetched GeoJSON layers.

    Raises:
        NotImplementedStage: Historical OSM snapshot fetching has not been implemented.
    """
    raise NotImplementedStage(
        "osm_snapshot",
        "Historical OpenStreetMap snapshot fetching has not been implemented.",
    )
