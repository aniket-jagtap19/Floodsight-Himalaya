"""
pipeline/contracts.py — Intermediate data contracts between pipeline stages.

Each dataclass documents the exact inputs and outputs of a stage.
Every file path must reference a GeoTIFF with an explicit CRS (Rules §7).
No magic constants: all thresholds come from Config (Design §27).

These contracts are stubs; the fields will be populated as stages are implemented.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

# ---------------------------------------------------------------------------
# Stage 1 — Acquisition
# ---------------------------------------------------------------------------


@dataclass
class ScenePair:
    """A matched before/after Sentinel-1 product pair suitable for change detection.

    Rules §8 (Satellite Pair Rule): same track, mode, polarisation, comparable geometry.
    """

    before_product_id: str
    """Copernicus Data Space product identifier for the pre-event scene."""

    after_product_id: str
    """Copernicus Data Space product identifier for the post-event scene."""

    before_acquisition_time: datetime
    """UTC acquisition time of the before scene."""

    after_acquisition_time: datetime
    """UTC acquisition time of the after scene."""

    relative_orbit: int
    """Sentinel-1 relative orbit number (same for before and after)."""

    orbit_direction: str
    """'ASCENDING' or 'DESCENDING'."""

    polarisations: list[str]
    """List of available polarisation bands, e.g. ['VV', 'VH']."""

    mode: str
    """Acquisition mode, e.g. 'IW' (Interferometric Wide-Swath)."""


# ---------------------------------------------------------------------------
# Stage 2 — Preprocessing
# ---------------------------------------------------------------------------


@dataclass
class AnalysisReadyRasters:
    """Paths to calibrated, terrain-corrected, co-registered GeoTIFFs.

    Rules §9 (SAR Processing Rule): each file has an explicit CRS (Rules §7).
    Missing bands remain None (not fabricated).
    """

    before_vv_path: str | None
    """Path to before-event VV polarisation GeoTIFF, or None if unavailable."""

    after_vv_path: str | None
    """Path to after-event VV polarisation GeoTIFF, or None if unavailable."""

    before_vh_path: str | None
    """Path to before-event VH polarisation GeoTIFF, or None if unavailable."""

    after_vh_path: str | None
    """Path to after-event VH polarisation GeoTIFF, or None if unavailable."""

    quality_mask_path: str | None
    """Path to quality/nodata mask GeoTIFF, or None if not produced."""

    crs_epsg: int
    """EPSG code of the common CRS for all rasters."""

    resolution_m: float
    """Spatial resolution in metres (approximately 10 m for Sentinel-1 GRD)."""


# ---------------------------------------------------------------------------
# Stage 3a — Change detection (raster)
# ---------------------------------------------------------------------------


@dataclass
class FloodMask:
    """Binary flood/debris raster produced by change detection + thresholding.

    Rules §7: explicit CRS required.
    Design §13: area must be calculated in a projected CRS, not in degrees.
    """

    mask_path: str
    """Path to the binary GeoTIFF flood/debris mask (0=unaffected, 1=affected)."""

    crs_epsg: int
    """EPSG code of the mask CRS."""

    threshold_method: str
    """Description of the thresholding method used, e.g. 'otsu'."""

    change_image_path: str | None
    """Path to the log-ratio change image used for thresholding, if retained."""

    affected_area_m2: float
    """Approximate affected area in square metres (calculated in projected CRS)."""


# ---------------------------------------------------------------------------
# Stage 3b — Polygonize
# ---------------------------------------------------------------------------


@dataclass
class FloodPolygons:
    """Vector representation of the flood/debris mask.

    Design §12: tiny/invalid polygons cleaned before export.
    """

    geojson_path: str
    """Path to the flood polygon GeoJSON file (EPSG:4326 for interchange)."""

    feature_count: int
    """Number of flood/debris polygon features after cleaning."""

    minimum_area_m2: float
    """Minimum polygon area threshold applied (from Config, Design §27)."""


# ---------------------------------------------------------------------------
# Stage 4 — OSM exposure data
# ---------------------------------------------------------------------------


@dataclass
class OsmLayers:
    """Pre-event OSM feature layers fetched from the ohsome API.

    Rules §12 (OSM Rule): must use a snapshot at osm_date, not current OSM.
    """

    snapshot_date: str
    """The OSM snapshot date used (YYYY-MM-DD)."""

    buildings_geojson_path: str | None
    """Path to buildings GeoJSON, or None if none found in AOI."""

    roads_geojson_path: str | None
    """Path to roads GeoJSON, or None if none found in AOI."""

    bridges_geojson_path: str | None
    """Path to bridges GeoJSON, or None if none found in AOI."""

    villages_geojson_path: str | None
    """Path to settlement centroids GeoJSON, or None if none found in AOI."""

    hospitals_geojson_path: str | None
    """Path to hospital points GeoJSON, or None if none found in AOI."""


# ---------------------------------------------------------------------------
# Stage 5 — Exposure intersection
# ---------------------------------------------------------------------------


@dataclass
class ExposureResult:
    """Results of intersecting OSM features with the flood polygons.

    Rules §11: at ~10 m resolution use 'estimated affected', not 'destroyed'.
    Design §14: spatial intersection performed in a projected CRS.
    """

    buildings_affected: int
    """Number of buildings whose footprint intersects the flood/debris mask."""

    buildings_total: int
    """Total number of buildings in the AOI from the OSM snapshot."""

    roads_affected_km: float
    """Total length of road segments intersecting the flood area, in km."""

    bridges_affected: int
    """Number of bridge features intersecting the flood corridor."""

    bridges_total: int
    """Total number of bridges in the AOI."""

    affected_buildings_ids: list[str] = field(default_factory=list)
    """OSM IDs of affected buildings."""

    affected_road_ids: list[str] = field(default_factory=list)
    """OSM IDs of affected road segments."""

    affected_bridge_ids: list[str] = field(default_factory=list)
    """OSM IDs of affected bridges."""


# ---------------------------------------------------------------------------
# Stage 6a — Road graph
# ---------------------------------------------------------------------------


@dataclass
class RoadGraph:
    """NetworkX-compatible road graph derived from OSM road network.

    Design §15: nodes = intersections/endpoints, edges = road segments.
    Each edge carries: length, geometry, road type, affected status.
    """

    node_count: int
    """Number of graph nodes."""

    edge_count: int
    """Number of graph edges."""

    affected_edge_ids: list[str]
    """Edge IDs removed/penalised due to intersection with flood polygons."""

    graph_path: str | None
    """Path to serialised graph file, or None if held in memory only."""


# ---------------------------------------------------------------------------
# Stage 6b — Settlement connectivity
# ---------------------------------------------------------------------------


@dataclass
class ConnectivityResult:
    """Road-connectivity analysis result for all settlements in the AOI.

    Rules §13: 'cut off' means no remaining *mapped* road path to destination.
    Design §17: before/after comparison required.
    """

    settlements_analyzed: int
    """Total number of settlements for which connectivity was evaluated."""

    settlements_cut_off: int
    """Settlements connected before the event but disconnected after."""

    records: list[dict]
    """Per-settlement records: {village_id, name, connected_before, connected_after,
    nearest_destination, route_km, note}."""


# ---------------------------------------------------------------------------
# Stage 7 — Report
# ---------------------------------------------------------------------------


@dataclass
class ReportData:
    """Structured report data assembled from all stage outputs.

    Design §22: sections = Event, Satellite, Infrastructure, Connectivity,
    Priority, Limitations, Attribution.
    """

    lang: str
    """Language code, e.g. 'en' or 'ne'."""

    generated_at: str
    """ISO 8601 UTC timestamp of generation."""

    event_summary: dict
    """Event overview section (date, bbox, area name)."""

    satellite_summary: dict
    """Satellite analysis section (pair metadata, method)."""

    infrastructure_summary: dict
    """Infrastructure impact section (buildings, roads, bridges)."""

    connectivity_summary: dict
    """Connectivity section (settlements analyzed/cut off)."""

    priority_settlements: list[dict]
    """Ordered list of highest-priority cut-off settlements."""

    limitations: list[str]
    """Documented limitations that apply to this result."""

    attribution: list[str]
    """Data source attribution strings."""
