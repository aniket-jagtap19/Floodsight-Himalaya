"""pipeline/orchestrator.py — Orchestrates pipeline stages and writes progress to RunStore."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from pipeline.acquisition.sentinel1 import find_pair
from pipeline.config import Config
from pipeline.connectivity.cutoff import run as run_cutoff
from pipeline.connectivity.graph import build as build_graph
from pipeline.exceptions import NotImplementedStage
from pipeline.exposure.intersect import run as run_intersect
from pipeline.exposure.osm import fetch_snapshot
from pipeline.flood_detection.change_detection import run as run_change_detection
from pipeline.flood_detection.polygonize import run as run_polygonize
from pipeline.preprocessing.sar import prepare as prepare_sar

if TYPE_CHECKING:
    from app.store import InMemoryRunStore

logger = logging.getLogger("floodsight.pipeline.orchestrator")

ALL_STAGES = [
    "acquisition",
    "preprocessing",
    "flood_detection",
    "exposure",
    "connectivity",
    "reporting",
]


async def run_pipeline(
    run_id: str,
    bbox: tuple[float, float, float, float],
    flood_date: str,
    osm_date: str,
    use_optical: bool,
    store: InMemoryRunStore,
    config: Config | None = None,
) -> None:
    """Execute pipeline stages in order in live mode.

    With current stubs, stage 1 (Sentinel-1 acquisition) raises NotImplementedStage,
    stopping execution immediately and recording state 'failed_not_implemented'.
    """
    cfg = config or Config.load_default()
    status = await store.get_status(run_id)
    if not status:
        logger.error("Run %s not found in store for pipeline execution", run_id)
        return

    status.state = "running"
    logger.info("Starting live pipeline execution for run %s", run_id)

    # Stage 1: Acquisition (maps to step 1)
    t0 = time.perf_counter()
    if status.steps:
        status.steps[0].state = "running"

    try:
        # Stage 1
        scene_pair = find_pair(list(bbox), flood_date, cfg)
        d_ms = int((time.perf_counter() - t0) * 1000)
        if status.steps:
            status.steps[0].state = "done"
            status.steps[0].duration_ms = d_ms

        # Subsequent stages (when implemented)
        rasters = prepare_sar(scene_pair, list(bbox), cfg)
        mask = run_change_detection(rasters, cfg)
        polygons = run_polygonize(mask)
        osm = fetch_snapshot(list(bbox), osm_date)
        exposure = run_intersect(osm, polygons)
        graph = build_graph(osm)
        _connectivity = run_cutoff(graph, exposure.affected_road_ids)
        # NOTE: Report generation is done on-demand via /api/runs/{id}/report endpoint,
        # not here in the orchestrator. The LLM copilot reads the final RunResult.

        status.state = "succeeded"

    except NotImplementedStage as exc:
        d_ms = int((time.perf_counter() - t0) * 1000)
        missing_stages = ", ".join(ALL_STAGES)
        err_msg = (
            f"Pipeline stage not implemented: {exc.detail} "
            f"Missing stages: {missing_stages}."
        )

        if status.steps:
            status.steps[0].state = "not_implemented"
            status.steps[0].log = exc.detail
            status.steps[0].duration_ms = d_ms

        status.state = "failed_not_implemented"
        status.error = err_msg
        logger.warning("Live pipeline for run %s stopped at stage 1: %s", run_id, exc.detail)

    except Exception as exc:  # noqa: BLE001
        d_ms = int((time.perf_counter() - t0) * 1000)
        if status.steps:
            status.steps[0].state = "failed"
            status.steps[0].duration_ms = d_ms
        status.state = "failed"
        status.error = f"Pipeline execution failed: {exc}"
        logger.error("Live pipeline error for run %s: %s", run_id, exc)
