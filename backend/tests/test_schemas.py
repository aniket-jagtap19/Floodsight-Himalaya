import pytest
from pydantic import ValidationError

from app.mock_data import get_mock_run_data
from app.schemas import (
    AnalyzeRequest,
    Building,
    RunResult,
)


def extract_key_paths(obj, prefix=""):
    paths = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            paths.add(path)
            paths.update(extract_key_paths(v, path))
    elif isinstance(obj, list) and obj:
        for item in obj[:5]:
            paths.update(extract_key_paths(item, prefix))
    return paths


def test_mock_run_validates_against_pydantic_models():
    raw_data = get_mock_run_data()
    result = RunResult.model_validate(raw_data)
    assert result.run_id == raw_data["runId"]
    assert len(result.scenes) > 0
    assert len(result.villages) > 0
    assert result.kpis.villages_total > 0


def test_result_json_revalidates_and_no_drift():
    # Load original json from data/mock-run.json
    raw_data = get_mock_run_data()
    original_model = RunResult.model_validate(raw_data)

    # Serialize back with by_alias=True, exclude_unset=True
    serialized = original_model.model_dump(by_alias=True, exclude_unset=True)

    # Re-validate serialized json
    revalidated = RunResult.model_validate(serialized)
    assert revalidated.run_id == original_model.run_id

    # Snapshot test: compare key paths between original json and serialized model
    original_paths = extract_key_paths(raw_data)
    serialized_paths = extract_key_paths(serialized)

    diff = original_paths ^ serialized_paths
    assert not diff, f"Drift detected between mock-run.json and serialized model: {diff}"


def test_bbox_validation():
    # Valid bbox
    req = AnalyzeRequest(
        bbox=(85.12, 27.9, 85.42, 28.3),
        flood_date="2026-08-26",
        osm_date="2026-07-27",
        use_optical=False,
    )
    assert req.bbox == (85.12, 27.9, 85.42, 28.3)

    # West >= East
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            bbox=(85.5, 27.9, 85.1, 28.3),
            flood_date="2026-08-26",
            osm_date="2026-07-27",
            use_optical=False,
        )

    # Out of latitude bounds
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            bbox=(85.1, 95.0, 85.4, 100.0),
            flood_date="2026-08-26",
            osm_date="2026-07-27",
            use_optical=False,
        )


def test_date_validation():
    # Invalid date string
    with pytest.raises(ValidationError):
        AnalyzeRequest(
            bbox=(85.12, 27.9, 85.42, 28.3),
            flood_date="not-a-date",
            osm_date="2026-07-27",
            use_optical=False,
        )


def test_confidence_validation():
    # Confidence out of bounds
    with pytest.raises(ValidationError):
        Building(
            id="b-1",
            osm_id="123",
            name="House",
            category="residential",
            lat=28.0,
            lon=85.0,
            status="likely_hit",
            confidence=1.5,
            reason=None,
            village="Dhunche",
            distance_to_river_m=100.0,
        )
