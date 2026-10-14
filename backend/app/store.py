import asyncio
import copy
import logging
import uuid
from abc import ABC, abstractmethod

from app.mock_data import get_mock_run_data, get_pipeline_steps_data
from app.schemas import (
    RecentRun,
    RunResult,
    RunStatus,
    RunStatusStep,
)
from app.settings import settings

logger = logging.getLogger("floodsight.store")


class RunStore(ABC):
    @abstractmethod
    async def create_run(
        self,
        bbox: tuple[float, float, float, float],
        flood_date: str,
        osm_date: str,
        use_optical: bool,
    ) -> str:
        """Create a new analysis run and start the progress lifecycle."""

    @abstractmethod
    async def get_status(self, run_id: str) -> RunStatus | None:
        """Get the current execution status of a run."""

    @abstractmethod
    async def get_result(self, run_id: str) -> RunResult | None:
        """Get the completed RunResult for a run."""

    @abstractmethod
    async def list_runs(self) -> list[RecentRun]:
        """List all recent runs."""


class InMemoryRunStore(RunStore):
    def __init__(self) -> None:
        self._results: dict[str, RunResult] = {}
        self._statuses: dict[str, RunStatus] = {}
        self._recent_runs: list[RecentRun] = []
        self._active_tasks: dict[str, asyncio.Task[None]] = {}
        self._steps_template = get_pipeline_steps_data()

        # Seed with initial Trishuli mock run
        self._seed_default_run()

    def _seed_default_run(self) -> None:
        mock_raw = get_mock_run_data()
        default_result = RunResult.model_validate(mock_raw)
        run_id = default_result.run_id
        self._results[run_id] = default_result

        completed_steps = [
            RunStatusStep(
                id=step["id"],
                label=step["label"],
                log=step["log"],
                state="warning" if step.get("warning") else "done",
                warning=step.get("warning"),
                duration_ms=step.get("durationMs"),
            )
            for step in self._steps_template
        ]
        self._statuses[run_id] = RunStatus(
            run_id=run_id,
            state="succeeded",
            steps=completed_steps,
        )

        self._recent_runs.append(
            RecentRun(
                run_id=run_id,
                area_name=default_result.area_name,
                event_date=default_result.event_date,
                flooded_km2=default_result.kpis.flooded_area_km2,
                cut_off=default_result.kpis.villages_cut_off,
            )
        )

    def _build_initial_steps(self) -> list[RunStatusStep]:
        return [
            RunStatusStep(
                id=step["id"],
                label=step["label"],
                log=step["log"],
                state="pending",
                warning=step.get("warning"),
                duration_ms=step.get("durationMs", 0),
            )
            for step in self._steps_template
        ]

    async def create_run(
        self,
        bbox: tuple[float, float, float, float],
        flood_date: str,
        osm_date: str,
        use_optical: bool,
    ) -> str:
        run_id = f"run-{flood_date.replace('-', '')}-{uuid.uuid4().hex[:6]}"

        # Initialize status as queued with pending steps
        initial_status = RunStatus(
            run_id=run_id,
            state="queued",
            steps=self._build_initial_steps(),
        )
        self._statuses[run_id] = initial_status

        if settings.pipeline_mode == "live":
            from pipeline.orchestrator import run_pipeline

            task = asyncio.create_task(
                run_pipeline(
                    run_id=run_id,
                    bbox=bbox,
                    flood_date=flood_date,
                    osm_date=osm_date,
                    use_optical=use_optical,
                    store=self,
                )
            )
            self._active_tasks[run_id] = task
        else:
            # Build mock result replacing request fields
            mock_raw = copy.deepcopy(get_mock_run_data())
            mock_raw["runId"] = run_id
            mock_raw["bbox"] = list(bbox)
            mock_raw["eventDate"] = flood_date
            mock_raw["osmSnapshotDate"] = osm_date
            mock_raw["provenance"] = {
                "scenes": "mock",
                "flood": "mock",
                "exposure": "mock",
                "connectivity": "mock",
                "validation": "mock",
                "copilot": "mock",
            }
            mock_raw["metadata"]["dataMode"] = "mock"
            mock_raw["metadata"]["pipelineVersion"] = "mock"

            # Explicit placeholder note per requirements
            notes = list(mock_raw.get("quality", {}).get("notes", []))
            placeholder_note = (
                "Geometry is placeholder demo data and does not correspond to the requested area."
            )
            if placeholder_note not in notes:
                notes.append(placeholder_note)
            mock_raw["quality"]["notes"] = notes

            result_model = RunResult.model_validate(mock_raw)
            self._results[run_id] = result_model

            # Record in recent runs
            recent_entry = RecentRun(
                run_id=run_id,
                area_name=result_model.area_name,
                event_date=flood_date,
                flooded_km2=result_model.kpis.flooded_area_km2,
                cut_off=result_model.kpis.villages_cut_off,
            )
            self._recent_runs.insert(0, recent_entry)

            # Launch progress simulator task (~8 seconds total)
            task = asyncio.create_task(self._advance_run_progress(run_id))
            self._active_tasks[run_id] = task

        logger.info(
            "Created run %s: bbox=%s floodDate=%s osmDate=%s useOptical=%s",
            run_id,
            bbox,
            flood_date,
            osm_date,
            use_optical,
        )
        return run_id

    async def _advance_run_progress(self, run_id: str) -> None:
        """Simulate advancing the 9 pipeline steps over ~8 seconds."""
        try:
            status = self._statuses.get(run_id)
            if not status:
                return

            status.state = "running"
            total_steps = len(status.steps)
            step_delay = 8.0 / max(total_steps, 1)

            for i in range(total_steps):
                status.steps[i].state = "running"
                await asyncio.sleep(step_delay)

                template_step = self._steps_template[i]
                if template_step.get("warning"):
                    status.steps[i].state = "warning"
                else:
                    status.steps[i].state = "done"

            status.state = "succeeded"
            logger.info("Run %s succeeded", run_id)
        except asyncio.CancelledError:
            if run_id in self._statuses:
                self._statuses[run_id].state = "failed"
                self._statuses[run_id].error = "Analysis execution cancelled."
            logger.warning("Run %s was cancelled", run_id)
        except Exception as exc:  # noqa: BLE001
            if run_id in self._statuses:
                self._statuses[run_id].state = "failed"
                self._statuses[run_id].error = str(exc)
            logger.error("Run %s failed: %s", run_id, exc)
        finally:
            self._active_tasks.pop(run_id, None)

    async def get_status(self, run_id: str) -> RunStatus | None:
        return self._statuses.get(run_id)

    async def get_result(self, run_id: str) -> RunResult | None:
        return self._results.get(run_id)

    async def list_runs(self) -> list[RecentRun]:
        return list(self._recent_runs)


# Global singleton store instance
run_store = InMemoryRunStore()
