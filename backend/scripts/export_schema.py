#!/usr/bin/env python3
"""
backend/scripts/export_schema.py — Export Pydantic response models to JSON Schema.

Exports the RunResult schema to backend/data/runresult.schema.json for
frontend-backend contract verification.
Can be executed from repository root or backend directory.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def _resolve_paths() -> tuple[Path, Path]:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent
    backend_dir = script_dir.parent

    # Ensure backend directory is in sys.path
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    # Fallback to backend/.venv site-packages if running with external python
    try:
        import pydantic  # noqa: F401
    except ModuleNotFoundError:
        # Check Windows venv
        win_site = backend_dir / ".venv" / "Lib" / "site-packages"
        if win_site.exists():
            sys.path.insert(0, str(win_site))
        else:
            # Check POSIX venv
            for p in (backend_dir / ".venv" / "lib").glob("python*/site-packages"):
                sys.path.insert(0, str(p))

    output_path = backend_dir / "data" / "runresult.schema.json"
    return repo_root, output_path


def export_schema() -> Path:
    _, output_path = _resolve_paths()
    from app.schemas import RunResult

    schema = RunResult.model_json_schema()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Sort keys for deterministic output
    content = json.dumps(schema, indent=2, sort_keys=True) + "\n"
    output_path.write_text(content, encoding="utf-8")
    print(f"Exported RunResult JSON Schema to {output_path}")
    return output_path


if __name__ == "__main__":
    export_schema()
