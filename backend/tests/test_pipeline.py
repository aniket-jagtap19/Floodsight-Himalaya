from datetime import UTC

import pytest
from pydantic import ValidationError

from app.schemas import RunStatus, RunStatusStep
from app.settings import settings
from app.store import InMemoryRunStore
from pipeline.acquisition.sentinel1 import find_pair
from pipeline.config import Config, SarConfig
from pipeline.contracts import ScenePair
from pipeline.exceptions import NotImplementedStage
from pipeline.orchestrator import run_pipeline
from pipeline.result_builder import build_result


def test_config_loads_default_and_validates():
    config = Config.load_default()
    assert config.sar.polarization in ("VV", "VH", "VV+VH")
    assert config.event.before_days == 20
    assert config.event.after_days == 20
    assert config.terrain.max_slope == 15.0
    assert config.roads.affected_ratio_threshold == 0.1
    assert config.processing.minimum_polygon_area_m2 == 500.0


def test_config_rejects_unknown_polarization():
    with pytest.raises(ValidationError):
        SarConfig(polarization="CIRCULAR")  # type: ignore[arg-type]

    with pytest.raises(ValidationError):
        SarConfig(polarization="HH")  # type: ignore[arg-type]

    # Valid values must succeed
    assert SarConfig(polarization="VV").polarization == "VV"
    assert SarConfig(polarization="VH").polarization == "VH"
    assert SarConfig(polarization="VV+VH").polarization == "VV+VH"


def test_stubs_raise_not_implemented_stage():
    config = Config.load_default()
    with pytest.raises(NotImplementedStage) as excinfo:
        find_pair([85.12, 27.9, 85.42, 28.3], "2026-08-26", config)
    assert excinfo.value.stage_name == "acquisition"
    assert "Sentinel-1 scene acquisition has not been implemented" in str(excinfo.value)


@pytest.mark.asyncio
async def test_orchestrator_live_mode_stops_at_stage_1():
    store = InMemoryRunStore()
    bbox = (85.12, 27.9, 85.42, 28.3)
    run_id = "test-live-run-1"

    # Set up initial status with steps
    status = RunStatus(
        run_id=run_id,
        state="queued",
        steps=[
            RunStatusStep(id=1, label="Find satellite scenes", log="", state="pending"),
            RunStatusStep(id=2, label="Preprocess radar", log="", state="pending"),
        ],
    )
    store._statuses[run_id] = status

    await run_pipeline(
        run_id=run_id,
        bbox=bbox,
        flood_date="2026-08-26",
        osm_date="2026-07-27",
        use_optical=False,
        store=store,
    )

    updated_status = await store.get_status(run_id)
    assert updated_status is not None
    assert updated_status.state == "failed_not_implemented"
    assert updated_status.steps[0].state == "not_implemented"
    assert "Sentinel-1 scene acquisition has not been implemented" in updated_status.steps[0].log
    assert "Missing stages: acquisition, preprocessing" in (updated_status.error or "")


@pytest.mark.asyncio
async def test_live_mode_via_store_setting(monkeypatch):
    monkeypatch.setattr(settings, "pipeline_mode", "live")
    store = InMemoryRunStore()
    bbox = (85.12, 27.9, 85.42, 28.3)

    run_id = await store.create_run(
        bbox=bbox,
        flood_date="2026-08-26",
        osm_date="2026-07-27",
        use_optical=False,
    )

    # Let the background task execute
    if run_id in store._active_tasks:
        await store._active_tasks[run_id]

    status = await store.get_status(run_id)
    assert status is not None
    assert status.state == "failed_not_implemented"
    assert status.steps[0].state == "not_implemented"


def test_build_result_provenance_live_vs_not_run():
    bbox = (85.12, 27.9, 85.42, 28.3)
    from datetime import datetime

    # 1. No stage outputs -> all provenance not_run
    res_empty = build_result(
        run_id="run-empty",
        bbox=bbox,
        area_name="Test AOI",
        event_date="2026-08-26",
        osm_snapshot_date="2026-07-27",
        is_mock=False,
    )
    assert res_empty.provenance.scenes == "not_run"
    assert res_empty.provenance.flood == "not_run"
    assert res_empty.provenance.exposure == "not_run"
    assert res_empty.provenance.connectivity == "not_run"
    assert res_empty.metadata.data_mode == "mixed"

    # 2. Stage 1 output provided -> scenes becomes 'live', others remain 'not_run'
    pair = ScenePair(
        before_product_id="S1A_IW_GRDH_1",
        after_product_id="S1A_IW_GRDH_2",
        before_acquisition_time=datetime.now(UTC),
        after_acquisition_time=datetime.now(UTC),
        relative_orbit=120,
        orbit_direction="DESCENDING",
        polarisations=["VV", "VH"],
        mode="IW",
    )
    res_with_scenes = build_result(
        run_id="run-scenes",
        bbox=bbox,
        area_name="Test AOI",
        event_date="2026-08-26",
        osm_snapshot_date="2026-07-27",
        is_mock=False,
        scene_pair=pair,
    )
    assert res_with_scenes.provenance.scenes == "live"
    assert res_with_scenes.provenance.flood == "not_run"
    assert res_with_scenes.provenance.exposure == "not_run"
    assert res_with_scenes.metadata.data_mode == "mixed"

    # 3. Mock mode -> provenance is mock, data_mode is mock
    res_mock = build_result(
        run_id="run-mock",
        bbox=bbox,
        area_name="Test AOI",
        event_date="2026-08-26",
        osm_snapshot_date="2026-07-27",
        is_mock=True,
    )
    assert res_mock.provenance.scenes == "mock"
    assert res_mock.provenance.flood == "mock"
    assert res_mock.metadata.data_mode == "mock"
