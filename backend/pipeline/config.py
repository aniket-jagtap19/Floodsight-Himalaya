"""pipeline/config.py — Typed pipeline configuration loaded from YAML (Design §27)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field


class EventConfig(BaseModel):
    """Event window search configuration."""

    before_days: int = Field(20, description="placeholder, not validated")
    after_days: int = Field(20, description="placeholder, not validated")


class SarConfig(BaseModel):
    """SAR acquisition and thresholding parameters."""

    polarization: Literal["VV", "VH", "VV+VH"]
    threshold_method: str = "otsu"


class TerrainConfig(BaseModel):
    """Terrain filtering configuration."""

    max_slope: float = Field(15.0, description="placeholder, not validated")
    use_hand: bool = False


class RoadsConfig(BaseModel):
    """Road cutoff thresholding configuration."""

    affected_ratio_threshold: float = Field(0.1, description="placeholder, not validated")


class ProcessingConfig(BaseModel):
    """Vector polygonization and cleanup parameters."""

    minimum_polygon_area_m2: float = Field(500.0, description="placeholder, not validated")


class Config(BaseModel):
    """Master pipeline configuration schema."""

    event: EventConfig = Field(default_factory=EventConfig)
    sar: SarConfig = Field(default_factory=lambda: SarConfig(polarization="VV"))
    terrain: TerrainConfig = Field(default_factory=TerrainConfig)
    roads: RoadsConfig = Field(default_factory=RoadsConfig)
    processing: ProcessingConfig = Field(default_factory=ProcessingConfig)

    @classmethod
    def from_yaml(cls, path: str | Path) -> Config:
        """Load configuration from a YAML file."""
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"Config file not found at: {file_path}")
        with open(file_path, encoding="utf-8") as f:
            data: dict[str, Any] = yaml.safe_load(f) or {}
        return cls.model_validate(data)

    @classmethod
    def load_default(cls) -> Config:
        """Load default configuration from backend/config/default.yaml."""
        base_dir = Path(__file__).resolve().parent.parent
        default_yaml = base_dir / "config" / "default.yaml"
        if default_yaml.exists():
            return cls.from_yaml(default_yaml)
        return cls()
