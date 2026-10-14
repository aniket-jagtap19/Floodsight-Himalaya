"""pipeline — FloodSight analysis pipeline package.

Stages (Design §24):
  acquisition  → preprocessing → flood_detection → exposure → connectivity → reporting

Each stage is currently a stub that raises NotImplementedStage.
Use PIPELINE_MODE=live to run the real orchestrator; PIPELINE_MODE=mock
(default) uses the pre-computed mock dataset unchanged.
"""

from pipeline.config import Config
from pipeline.exceptions import NotImplementedStage

__all__ = ["Config", "NotImplementedStage"]
