"""pipeline/reporting/tools.py — Deterministic fact tools (Design §20, Rules §5).

Every function reads a RunResult and returns a ToolResult with:
  - a structured `value` (the fact)
  - a `source` dict {layer, query, run_id}

These functions NEVER call an LLM and NEVER invent data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ToolResult:
    """Container returned by every tool function."""

    value: Any  # The structured fact
    layer: str  # GIS/data layer name
    query: str  # Human-readable description of what was queried
    run_id: str  # The run this came from


def get_summary(result: Any) -> ToolResult:
    """Return top-level KPI figures from result.kpis.

    Args:
        result: RunResult (pydantic or dict-like with .kpis, .area_name, etc.)

    Returns:
        ToolResult with a dict of key KPI values.
    """
    k = result.kpis
    value = {
        "area_name": result.area_name,
        "event_date": result.event_date,
        "flooded_area_km2": k.flooded_area_km2,
        "debris_area_km2": k.debris_area_km2,
        "buildings_likely_hit": k.buildings_likely_hit,
        "buildings_total": k.buildings_total,
        "road_length_affected_km": k.road_length_affected_km,
        "bridges_likely_damaged": k.bridges_likely_damaged,
        "bridges_total": k.bridges_total,
        "villages_cut_off": k.villages_cut_off,
        "villages_total": k.villages_total,
        # Deliberately excluded: people_in_cut_off_villages — null, not verified
    }
    return ToolResult(
        value=value,
        layer="kpis",
        query="aggregate KPI summary from pipeline result",
        run_id=result.run_id,
    )


def get_cutoff_villages(result: Any) -> ToolResult:
    """Return list of villages that lost road connectivity.

    Uses wording 'road-isolated (no remaining mapped road path)'
    as required by Design §20.

    Args:
        result: RunResult

    Returns:
        ToolResult with list of cut-off village records.
    """
    cut_off = [
        {
            "name": v.name,
            "status": "road-isolated (no remaining mapped road path)",
            "distance_before_km": v.distance_before_km,
            "distance_after_km": v.distance_after_km,
            "alternate_route": v.alternate_route,
            "priority": v.priority,
            "nearest_hospital_id": v.nearest_hospital_id,
        }
        for v in result.villages
        if v.status == "cut_off"
    ]
    return ToolResult(
        value=cut_off,
        layer="villages",
        query="villages with status=cut_off from connectivity analysis",
        run_id=result.run_id,
    )


def get_damage_summary(result: Any, layer: str = "buildings", within_m: float | None = None) -> ToolResult:
    """Return estimated affected count for the requested infrastructure layer.

    Args:
        result: RunResult
        layer: One of 'buildings', 'roads', 'bridges'
        within_m: Optional radius filter in metres (applied to buildings only by
                  straight-line distance from nearest river; not available for roads/bridges).

    Returns:
        ToolResult with count and unit string.
    """
    if layer == "buildings":
        items = [b for b in result.buildings if b.status == "likely_hit"]
        if within_m is not None:
            items = [b for b in items if b.distance_to_river_m is not None and b.distance_to_river_m <= within_m]
        value = {"count": len(items), "unit": "estimated affected buildings", "filter_m": within_m}
        query = (
            "buildings with status=likely_hit"
            + (f" within {within_m} m of river" if within_m else "")
        )
    elif layer == "roads":
        affected = [r for r in result.roads if r.status == "flooded"]
        total_km = round(sum(r.length_km for r in affected), 2)
        value = {"count": len(affected), "km": total_km, "unit": "road segments likely affected"}
        query = "road segments with status=flooded"
    elif layer == "bridges":
        affected = [b for b in result.bridges if b.status == "damaged"]
        value = {"count": len(affected), "unit": "bridges likely damaged"}
        query = "bridges with status=damaged"
    else:
        value = {"error": f"unknown layer: {layer}"}
        query = f"unsupported layer '{layer}'"

    return ToolResult(
        value=value,
        layer=layer,
        query=query,
        run_id=result.run_id,
    )


def get_bridges(result: Any, status: str = "damaged") -> ToolResult:
    """Return bridge records filtered by status.

    Args:
        result: RunResult
        status: 'damaged' or 'intact'

    Returns:
        ToolResult with list of bridge records.
    """
    bridges = [
        {"name": b.name, "status": b.status, "lat": b.lat, "lon": b.lon}
        for b in result.bridges
        if b.status == status
    ]
    return ToolResult(
        value=bridges,
        layer="bridges",
        query=f"bridges with status={status}",
        run_id=result.run_id,
    )


def get_scene_metadata(result: Any) -> ToolResult:
    """Return satellite scene acquisition metadata.

    Args:
        result: RunResult

    Returns:
        ToolResult with scene list (sensor, role, date, orbit).
    """
    scenes = [
        {"id": s.id, "sensor": s.sensor, "role": s.role, "date": s.date, "orbit": s.orbit}
        for s in result.scenes
    ]
    return ToolResult(
        value={"scenes": scenes, "data_mode": result.metadata.data_mode},
        layer="scenes",
        query="satellite scene acquisition metadata",
        run_id=result.run_id,
    )


def get_limitations(result: Any) -> ToolResult:
    """Return the pipeline limitations list from the result.

    Args:
        result: RunResult

    Returns:
        ToolResult with list of limitation strings.
    """
    return ToolResult(
        value=result.limitations,
        layer="limitations",
        query="pipeline limitations list",
        run_id=result.run_id,
    )


def get_provenance(result: Any) -> ToolResult:
    """Return data provenance for each result component.

    Args:
        result: RunResult

    Returns:
        ToolResult with provenance dict.
    """
    p = result.provenance
    value = {
        "scenes": p.scenes,
        "flood": p.flood,
        "exposure": p.exposure,
        "connectivity": p.connectivity,
        "validation": p.validation,
        "copilot": p.copilot,
        "data_mode": result.metadata.data_mode,
        "pipeline_version": result.metadata.pipeline_version,
    }
    return ToolResult(
        value=value,
        layer="provenance",
        query="data provenance and pipeline version",
        run_id=result.run_id,
    )


# Registry of all available tools, keyed by name
TOOL_REGISTRY: dict[str, str] = {
    "get_summary": "Flood overview: KPIs (flooded area, buildings, roads, bridges, villages)",
    "get_cutoff_villages": "Which villages lost road connectivity",
    "get_damage_summary": "Estimated affected count for buildings/roads/bridges (with optional radius filter)",
    "get_bridges": "Bridge records filtered by status (damaged/intact)",
    "get_scene_metadata": "Satellite scene acquisition dates and sensor info",
    "get_limitations": "Pipeline limitations and caveats",
    "get_provenance": "Data provenance (mock/live/not_run) for each component",
}
