"""pipeline/flood_detection/change_detection.py — SAR change detection stub."""

from __future__ import annotations

from typing import Any

from pipeline.contracts import AnalysisReadyRasters, FloodMask
from pipeline.exceptions import NotImplementedStage


def run(rasters: AnalysisReadyRasters, config: Any) -> FloodMask:
    """Run SAR change detection (log-ratio + thresholding) to create binary flood mask.

    Computes difference between pre- and post-event backscatter, applies thresholding
    (Otsu/bimodal/fixed as configured), and generates a binary GeoTIFF raster.

    Args:
        rasters: Calibrated and co-registered SAR rasters.
        config: Pipeline Config object containing thresholding parameters.

    Returns:
        FloodMask: Path to binary flood GeoTIFF with explicit CRS.

    Raises:
        NotImplementedStage: Flood change detection has not been implemented.
    """
    raise NotImplementedStage(
        "flood_detection",
        "SAR change detection has not been implemented.",
    )
