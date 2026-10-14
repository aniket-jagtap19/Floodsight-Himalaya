"""pipeline/result_builder.py — Assembles RunResult with strict provenance enforcement."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.schemas import (
    ConfidenceInfo,
    DataMode,
    Facility,
    FlowPath,
    Kpis,
    MetadataInfo,
    Provenance,
    ProvenanceState,
    QualityInfo,
    RunResult,
    Scene,
)
from pipeline.contracts import (
    ConnectivityResult,
    ExposureResult,
    FloodMask,
    FloodPolygons,
    OsmLayers,
    ScenePair,
)


def build_result(
    *,
    run_id: str,
    bbox: tuple[float, float, float, float] | list[float],
    area_name: str,
    event_date: str,
    osm_snapshot_date: str,
    is_mock: bool = False,
    scene_pair: ScenePair | None = None,
    flood_mask: FloodMask | None = None,
    flood_polygons: FloodPolygons | None = None,
    osm_layers: OsmLayers | None = None,
    exposure: ExposureResult | None = None,
    connectivity: ConnectivityResult | None = None,
    validation: Any | None = None,
    copilot_ready: bool = False,
    scenes_list: list[Scene] | None = None,
    raw_polygons: list[Any] | None = None,
    buildings: list[Any] | None = None,
    roads: list[Any] | None = None,
    bridges: list[Any] | None = None,
    villages: list[Any] | None = None,
    hospitals: list[Facility] | None = None,
    towns: list[Facility] | None = None,
    kpis: Kpis | None = None,
    limitations: list[str] | None = None,
) -> RunResult:
    """Assemble RunResult from stage outputs, enforcing strict provenance rules.

    Rules §20 / Prompt 4 Task 6:
    A provenance section is marked 'live' ONLY if its corresponding stage
    output actually exists. Otherwise it must be 'not_run' (or 'mock' in mock mode).
    """
    bbox_tuple = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))

    if is_mock:
        scenes_prov: ProvenanceState = "mock"
        flood_prov: ProvenanceState = "mock"
        exposure_prov: ProvenanceState = "mock"
        conn_prov: ProvenanceState = "mock"
        val_prov: ProvenanceState = "mock" if validation is not None else "not_run"
        copilot_prov: ProvenanceState = "mock" if copilot_ready else "not_run"
        data_mode: DataMode = "mock"
    else:
        # Live mode: strictly derive provenance from actual stage outputs
        scenes_prov = "live" if scene_pair is not None else "not_run"
        flood_prov = "live" if (flood_mask is not None or flood_polygons is not None) else "not_run"
        exposure_prov = "live" if exposure is not None else "not_run"
        conn_prov = "live" if connectivity is not None else "not_run"
        val_prov = "live" if validation is not None else "not_run"
        copilot_prov = "live" if copilot_ready else "not_run"

        all_live = all(
            p == "live" for p in [scenes_prov, flood_prov, exposure_prov, conn_prov]
        )
        data_mode = "live" if all_live else "mixed"

    provenance = Provenance(
        scenes=scenes_prov,
        flood=flood_prov,
        exposure=exposure_prov,
        connectivity=conn_prov,
        validation=val_prov,
        copilot=copilot_prov,
    )

    now_iso = datetime.now(UTC).isoformat()

    default_kpis = kpis or Kpis(
        flooded_area_km2=0.0,
        debris_area_km2=0.0,
        buildings_likely_hit=exposure.buildings_affected if exposure else 0,
        buildings_total=exposure.buildings_total if exposure else 0,
        road_length_affected_km=exposure.roads_affected_km if exposure else 0.0,
        bridges_likely_damaged=exposure.bridges_affected if exposure else 0,
        bridges_total=exposure.bridges_total if exposure else 0,
        villages_cut_off=connectivity.settlements_cut_off if connectivity else 0,
        villages_total=connectivity.settlements_analyzed if connectivity else 0,
        people_in_cut_off_villages=None,
    )

    return RunResult(
        run_id=run_id,
        bbox=bbox_tuple,
        area_name=area_name,
        event_date=event_date,
        osm_snapshot_date=osm_snapshot_date,
        scenes=scenes_list or [],
        flood_polygons=raw_polygons or [],
        debris_polygons=[],
        confidence=ConfidenceInfo(low_confidence_polygons=[], mean_confidence=0.0),
        radar_shadow_polygons=[],
        flow_path=FlowPath(upstream=(0.0, 0.0), coordinates=[], labels=[]),
        buildings=buildings or [],
        roads=roads or [],
        bridges=bridges or [],
        villages=villages or [],
        hospitals=hospitals or [],
        towns=towns or [],
        kpis=default_kpis,
        validation=validation,
        provenance=provenance,
        quality=QualityInfo(sentinel1_pair_quality=None, notes=[]),
        limitations=limitations or [
            "Analysis pipeline stages are stubs under active construction.",
        ],
        metadata=MetadataInfo(
            generated_at=now_iso,
            pipeline_version="0.1.0-stub",
            model=None,
            resolution_m=10.0,
            data_mode=data_mode,
        ),
    )
