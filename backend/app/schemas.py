"""
Data contracts for FloodSight Himalaya mirroring src/lib/types.ts.

Coordinate Order Conventions:
NOTE: The contract deliberately mixes coordinate order depending on context:
- Ring and Road.coordinates are GeoJSON standard [lng, lat].
- Village.route.coordinates, breakPoints, and flowPath are Leaflet standard [lat, lng].
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel

LngLat = tuple[float, float]  # [lng, lat]
LatLng = tuple[float, float]  # [lat, lng]
Ring = list[LngLat]

Status = Literal["likely_hit", "not_hit"]
DataMode = Literal["mock", "live", "mixed"]
ProvenanceState = Literal["mock", "live", "not_run"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


def validate_iso_date_string(v: str) -> str:
    try:
        date.fromisoformat(v)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"'{v}' is not a valid ISO date (YYYY-MM-DD)") from exc
    return v


def validate_confidence_range(v: float | None) -> float | None:
    if v is not None and not (0.0 <= v <= 1.0):
        raise ValueError(f"Confidence value {v} must be between 0.0 and 1.0")
    return v


def validate_bbox_bounds(
    v: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    w, s, e, n = v
    if not (-180.0 <= w <= 180.0 and -180.0 <= e <= 180.0):
        raise ValueError(f"Longitude values [{w}, {e}] must be within [-180, 180]")
    if not (-90.0 <= s <= 90.0 and -90.0 <= n <= 90.0):
        raise ValueError(f"Latitude values [{s}, {n}] must be within [-90, 90]")
    if w >= e:
        raise ValueError(f"Bbox west ({w}) must be less than east ({e})")
    if s >= n:
        raise ValueError(f"Bbox south ({s}) must be less than north ({n})")
    return v


# ---------------- Core Domain Models ----------------


class Scene(CamelModel):
    id: str
    sensor: str
    role: Literal["before", "after", "event", "optical"]
    date: str
    orbit: str
    cloud_cover: float | None

    @field_validator("date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return validate_iso_date_string(v)


class AreaPolygon(CamelModel):
    id: str
    coordinates: list[Ring]
    type: str | None = None
    confidence: float | None = None

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v: float | None) -> float | None:
        return validate_confidence_range(v)


class Building(CamelModel):
    id: str
    osm_id: str
    name: str
    category: str
    lat: float
    lon: float
    status: Status
    confidence: float | None
    reason: str | None
    village: str
    distance_to_river_m: float | None

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v: float | None) -> float | None:
        return validate_confidence_range(v)


class Road(CamelModel):
    id: str
    osm_id: str
    name: str
    road_class: Literal["primary", "secondary", "tertiary", "track"]
    length_km: float
    status: Literal["flooded", "intact"]
    confidence: float | None
    reason: str | None
    coordinates: list[LngLat]

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v: float | None) -> float | None:
        return validate_confidence_range(v)


class Bridge(CamelModel):
    id: str
    osm_id: str
    name: str
    lat: float
    lon: float
    status: Literal["damaged", "intact"]
    confidence: float | None
    reason: str | None

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v: float | None) -> float | None:
        return validate_confidence_range(v)


class VillageRoute(CamelModel):
    coordinates: list[LatLng]
    broken_segment_ids: list[str]
    break_points: list[LatLng]


class Village(CamelModel):
    id: str
    osm_id: str
    name: str
    lat: float
    lon: float
    status: Literal["cut_off", "connected"]
    population: int | None
    nearest_hospital_id: str
    distance_before_km: float
    distance_after_km: float | None
    reason: str | None
    alternate_route: str
    priority: int | None
    confidence: float | None
    route: VillageRoute

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v: float | None) -> float | None:
        return validate_confidence_range(v)


class Facility(CamelModel):
    id: str
    osm_id: str
    name: str
    lat: float
    lon: float
    kind: Literal["hospital", "town"]


class Kpis(CamelModel):
    flooded_area_km2: float
    debris_area_km2: float
    buildings_likely_hit: int
    buildings_total: int
    road_length_affected_km: float
    bridges_likely_damaged: int
    bridges_total: int
    villages_cut_off: int
    villages_total: int
    people_in_cut_off_villages: int | None


class ValidationRegion(CamelModel):
    name: str
    date: str
    orbit: str
    cloud_cover: str
    precision: float
    recall: float
    f1: float
    iou: float


class Validation(CamelModel):
    reference: str
    precision: float
    recall: float
    f1: float
    iou: float
    area_ours_km2: float
    area_ref_km2: float
    tp_km2: float
    fp_km2: float
    fn_km2: float
    regions: list[ValidationRegion]
    reference_polygons: list[AreaPolygon]


class ConfidenceInfo(CamelModel):
    low_confidence_polygons: list[AreaPolygon]
    mean_confidence: float

    @field_validator("mean_confidence")
    @classmethod
    def check_mean_confidence(cls, v: float) -> float:
        res = validate_confidence_range(v)
        return v if res is None else res


class FlowPath(CamelModel):
    upstream: LatLng
    coordinates: list[LatLng]
    labels: list[str]


class Provenance(CamelModel):
    scenes: ProvenanceState
    flood: ProvenanceState
    exposure: ProvenanceState
    connectivity: ProvenanceState
    validation: ProvenanceState
    copilot: ProvenanceState


class QualityInfo(CamelModel):
    sentinel1_pair_quality: str | None
    notes: list[str]


class MetadataInfo(CamelModel):
    generated_at: str
    pipeline_version: str
    model: str | None
    resolution_m: float
    data_mode: DataMode


class RunResult(CamelModel):
    run_id: str
    bbox: tuple[float, float, float, float]
    area_name: str
    event_date: str
    osm_snapshot_date: str
    scenes: list[Scene]
    flood_polygons: list[AreaPolygon]
    debris_polygons: list[AreaPolygon]
    confidence: ConfidenceInfo
    radar_shadow_polygons: list[AreaPolygon]
    flow_path: FlowPath
    buildings: list[Building]
    roads: list[Road]
    bridges: list[Bridge]
    villages: list[Village]
    hospitals: list[Facility]
    towns: list[Facility]
    kpis: Kpis
    validation: Validation | None
    provenance: Provenance
    quality: QualityInfo
    limitations: list[str]
    metadata: MetadataInfo

    @field_validator("bbox")
    @classmethod
    def check_bbox(cls, v: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        return validate_bbox_bounds(v)

    @field_validator("event_date", "osm_snapshot_date")
    @classmethod
    def check_dates(cls, v: str) -> str:
        return validate_iso_date_string(v)


# ---------------- API Request / Response Models ----------------


class AnalyzeRequest(CamelModel):
    bbox: tuple[float, float, float, float]
    flood_date: str
    osm_date: str
    use_optical: bool

    @field_validator("bbox")
    @classmethod
    def check_bbox(cls, v: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        return validate_bbox_bounds(v)

    @field_validator("flood_date", "osm_date")
    @classmethod
    def check_dates(cls, v: str) -> str:
        return validate_iso_date_string(v)


class AnalyzeResponse(CamelModel):
    run_id: str


class PipelineStep(CamelModel):
    id: int
    label: str
    log: str
    duration_ms: int
    warning: str | None = None
    mock: bool | None = None


class RunStatusStep(CamelModel):
    id: int | str
    label: str
    log: str
    state: Literal["pending", "running", "done", "warning", "failed", "not_implemented"]
    warning: str | None = None
    duration_ms: int | None = None


class RunStatus(CamelModel):
    run_id: str
    state: Literal["queued", "running", "succeeded", "failed", "failed_not_implemented"]
    steps: list[RunStatusStep]
    error: str | None = None


class RecentRun(CamelModel):
    run_id: str
    area_name: str
    event_date: str
    flooded_km2: float
    cut_off: int


class ErrorResponse(CamelModel):
    error: str


# ---------------- Copilot / Report Models ----------------


class NumberSource(CamelModel):
    """Provenance record for one verified number shown in the copilot UI."""

    display: str  # human-readable display value
    layer: str  # GIS/data layer name
    query: str  # description of what was queried
    value: str  # the numeric value as string
    run_id: str


class CopilotTable(CamelModel):
    columns: list[str]
    rows: list[list[str | float | int]]


class CopilotMiniMap(CamelModel):
    village_ids: list[str]


class CopilotAnswer(CamelModel):
    """Response shape for both /ask and /report endpoints.

    Matches CopilotAnswer in src/lib/types.ts exactly.
    """

    available: bool  # False = refusal
    markdown: str  # numbers referenced as #key; always plain text for refusals
    sources: dict[str, NumberSource] = {}  # keyed by placeholder key
    tools: list[str] = []  # tool names called
    table: CopilotTable | None = None
    mini_map: CopilotMiniMap | None = None
    note: str | None = None  # shown in UI for Nepali answers


class CopilotAskRequest(CamelModel):
    question: str
    lang: str = "en"
