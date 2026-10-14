import json
from pathlib import Path
from typing import Any

from app.settings import settings


def load_json_file(filename: str) -> Any:
    file_path = settings.data_dir / filename
    if not file_path.exists():
        # Fallback to local data folder relative to this file
        fallback = Path(__file__).resolve().parent.parent / "data" / filename
        if fallback.exists():
            file_path = fallback
        else:
            raise FileNotFoundError(
                f"Required data file not found: {filename} (searched {file_path})"
            )

    with open(file_path, encoding="utf-8") as f:
        return json.load(f)


def get_mock_run_data() -> dict[str, Any]:
    return load_json_file("mock-run.json")


def get_pipeline_steps_data() -> list[dict[str, Any]]:
    return load_json_file("pipeline-steps.json")
