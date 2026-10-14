"""pipeline/exceptions.py — Exceptions raised by pipeline stages."""

from __future__ import annotations


class NotImplementedStage(NotImplementedError):
    """Raised when an unbuilt pipeline stage is invoked in live mode."""

    def __init__(self, stage_name: str, detail: str | None = None) -> None:
        self.stage_name = stage_name
        self.detail = detail or f"Stage '{stage_name}' has not been implemented."
        super().__init__(self.detail)
