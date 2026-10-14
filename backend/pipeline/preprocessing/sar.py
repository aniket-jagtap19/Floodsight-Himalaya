"""pipeline/preprocessing/sar.py — SAR calibration and terrain correction stub."""

from __future__ import annotations

from typing import Any

from pipeline.contracts import AnalysisReadyRasters, ScenePair
from pipeline.exceptions import NotImplementedStage


def prepare(pair: ScenePair, bbox: list[float], config: Any) -> AnalysisReadyRasters:
    """Prepare analysis-ready SAR rasters from raw Sentinel-1 GRD products.

    Calibrates to sigma0 (dB), terrain-corrects using Copernicus DEM GLO-30,
    co-registers, and applies mountain shadow/layover masking.

    Args:
        pair: Pre- and post-event Sentinel-1 scene pair.
        bbox: [west, south, east, north] bounding box coordinates.
        config: Pipeline Config object.

    Returns:
        AnalysisReadyRasters: File paths to GeoTIFFs with explicit CRS.

    Raises:
        NotImplementedStage: SAR preprocessing has not been implemented.
    """
    raise NotImplementedStage(
        "preprocessing",
        "SAR preprocessing (radiometric calibration and terrain correction) has not been implemented.",
    )
