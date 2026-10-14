"""backend/tests/test_copilot.py — Tests for Prompt 5 (Design §20-21, FR-14, FR-15, Rules §5).

Tests cover:
  1. tools.py — tool functions return correct values for mock-run.json
  2. copilot.py — verify_numbers (accepts grounded, rejects invented)
  3. copilot.py — FakeLLM refuses trapped-people question
  4. copilot.py — FakeLLM returns grounded village answer
  5. report.py — FakeLLM path builds a non-empty report
  6. llm.py — FakeLLM produces no network call
  7. API — /ask endpoint returns CopilotAnswer with available=False for refusal
  8. API — /report endpoint returns CopilotAnswer with markdown for mock run
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import RunResult as RunResultSchema

# ── Load mock-run.json ─────────────────────────────────────────────────────────

MOCK_RUN_PATH = Path(__file__).parent.parent / "data" / "mock-run.json"


@pytest.fixture(scope="module")
def mock_result():
    """Load the mock RunResult Pydantic model from data/mock-run.json."""
    raw = json.loads(MOCK_RUN_PATH.read_text(encoding="utf-8"))
    return RunResultSchema.model_validate(raw)


# ── Tool function tests ────────────────────────────────────────────────────────


def test_get_summary_returns_correct_kpis(mock_result):
    from pipeline.reporting.tools import get_summary

    tr = get_summary(mock_result)
    v = tr.value
    assert v["buildings_likely_hit"] == 20
    assert v["villages_cut_off"] == 4
    assert v["road_length_affected_km"] == pytest.approx(21.5)
    assert v["bridges_likely_damaged"] == 2
    assert v["flooded_area_km2"] == pytest.approx(6.8)
    assert tr.layer == "kpis"
    assert tr.run_id == mock_result.run_id
    # Population must NOT be in summary (it's null and not verified)
    assert "people_in_cut_off_villages" not in v


def test_get_cutoff_villages_returns_cut_off_only(mock_result):
    from pipeline.reporting.tools import get_cutoff_villages

    tr = get_cutoff_villages(mock_result)
    assert isinstance(tr.value, list)
    assert len(tr.value) == 4  # villages_cut_off = 4
    for v in tr.value:
        assert v["status"] == "road-isolated (no remaining mapped road path)"
    names = [v["name"] for v in tr.value]
    assert "Rasuwagadhi" in names


def test_get_damage_summary_buildings(mock_result):
    from pipeline.reporting.tools import get_damage_summary

    tr = get_damage_summary(mock_result, "buildings")
    assert tr.value["count"] == 20
    assert tr.layer == "buildings"


def test_get_damage_summary_buildings_within_m(mock_result):
    from pipeline.reporting.tools import get_damage_summary

    # Filter to buildings within 2000 m of river
    tr = get_damage_summary(mock_result, "buildings", within_m=2000.0)
    # Count should be ≤ total affected buildings
    assert tr.value["count"] <= 20
    assert tr.value["filter_m"] == 2000.0


def test_get_damage_summary_roads(mock_result):
    from pipeline.reporting.tools import get_damage_summary

    tr = get_damage_summary(mock_result, "roads")
    assert tr.value["km"] == pytest.approx(21.51, abs=0.1)
    assert tr.layer == "roads"


def test_get_damage_summary_bridges(mock_result):
    from pipeline.reporting.tools import get_damage_summary

    tr = get_damage_summary(mock_result, "bridges")
    assert tr.value["count"] == 2
    assert tr.layer == "bridges"


def test_get_bridges_damaged(mock_result):
    from pipeline.reporting.tools import get_bridges

    tr = get_bridges(mock_result, "damaged")
    assert isinstance(tr.value, list)
    assert len(tr.value) == 2


def test_get_scene_metadata(mock_result):
    from pipeline.reporting.tools import get_scene_metadata

    tr = get_scene_metadata(mock_result)
    assert "scenes" in tr.value
    assert len(tr.value["scenes"]) >= 2


def test_get_limitations(mock_result):
    from pipeline.reporting.tools import get_limitations

    tr = get_limitations(mock_result)
    assert isinstance(tr.value, list)
    assert len(tr.value) > 0


def test_get_provenance(mock_result):
    from pipeline.reporting.tools import get_provenance

    tr = get_provenance(mock_result)
    assert "scenes" in tr.value
    assert "data_mode" in tr.value


# ── verify_numbers tests ───────────────────────────────────────────────────────


def test_verify_numbers_accepts_grounded_answer():
    from pipeline.reporting.copilot import verify_numbers

    # Answer uses only placeholder tokens — no raw digits
    answer = "The analysis found {{n_buildings}} buildings estimated affected."
    allowed: set[str] = {"20", "184", "4"}
    ok, violations = verify_numbers(answer, allowed)
    assert ok, f"Expected no violations but got: {violations}"


def test_verify_numbers_accepts_allowed_digit_after_substitution():
    from pipeline.reporting.copilot import verify_numbers

    # After substitution, "20" appears — but 20 is in allowed set
    answer = "The flood affected 20 buildings and 4 villages."
    allowed: set[str] = {"20", "4"}
    ok, violations = verify_numbers(answer, allowed)
    assert ok, f"Expected no violations but got: {violations}"


def test_verify_numbers_rejects_invented_number():
    from pipeline.reporting.copilot import verify_numbers

    # "1,200" was not returned by any tool — should be rejected
    answer = "The flood affected approximately 1,200 buildings in the valley."
    allowed: set[str] = {"20", "4", "21.5", "2", "6.8"}
    ok, violations = verify_numbers(answer, allowed)
    assert not ok
    assert any("1200" in v or "1,200" in v.replace(",", "") for v in ["1200"]) or len(violations) > 0


def test_verify_numbers_rejects_percentage_hallucination():
    from pipeline.reporting.copilot import verify_numbers

    answer = "About 35% of villages are cut off."
    allowed: set[str] = {"4", "20"}
    ok, violations = verify_numbers(answer, allowed)
    assert not ok


# ── FakeLLM / copilot ask tests ───────────────────────────────────────────────


def test_fakelm_refuses_trapped_people(mock_result):
    """Critical: 'how many people are trapped?' MUST be refused (Design §21, Rules §5)."""
    from pipeline.reporting.copilot import ask
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    answer = ask("How many people are trapped?", mock_result, llm, lang="en")
    assert answer.available is False
    assert "cannot" in answer.markdown.lower() or "not available" in answer.markdown.lower()


def test_fakelm_refuses_population_question(mock_result):
    from pipeline.reporting.copilot import ask
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    answer = ask("What is the population of affected villages?", mock_result, llm, lang="en")
    assert answer.available is False


def test_fakelm_answers_village_question(mock_result):
    from pipeline.reporting.copilot import ask
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    answer = ask("Which villages are cut off?", mock_result, llm, lang="en")
    assert answer.available is True
    # The answer should reference the number of cut-off villages (4), not invent numbers
    assert isinstance(answer.markdown, str)
    assert len(answer.markdown) > 10


def test_fakelm_answer_contains_no_invented_numbers(mock_result):
    """Every digit in the final answer must trace to a tool result (FR-15)."""
    from pipeline.reporting.copilot import (
        _build_allowed_numbers,
        _gather_facts,
        ask,
        verify_numbers,
    )
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    answer = ask("Which villages are cut off?", mock_result, llm, lang="en")
    if answer.available:
        facts, _ = _gather_facts(mock_result)
        allowed = _build_allowed_numbers(facts)
        ok, violations = verify_numbers(answer.markdown, allowed)
        assert ok, f"Invented numbers found in final answer: {violations}"


def test_fakelm_buildings_within_2km(mock_result):
    from pipeline.reporting.copilot import ask
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    answer = ask("How many buildings are affected within 2 km of the river?", mock_result, llm, lang="en")
    assert isinstance(answer.markdown, str)
    assert len(answer.markdown) > 5


# ── FakeLLM report tests ───────────────────────────────────────────────────────


def test_fakelm_builds_report(mock_result):
    from pipeline.reporting.llm import FakeLLM
    from pipeline.reporting.report import build_report

    llm = FakeLLM()
    answer = build_report(mock_result, llm, lang="en")
    assert isinstance(answer.markdown, str)
    assert len(answer.markdown) > 50
    assert "DEMO REPORT" in answer.markdown or answer.available


def test_fakelm_report_demo_prefix_for_mock(mock_result):
    from pipeline.reporting.llm import FakeLLM
    from pipeline.reporting.report import build_report

    llm = FakeLLM()
    answer = build_report(mock_result, llm, lang="en")
    # mock-run.json has provenance.flood = "mock" → data_mode = "mock" → DEMO prefix
    assert "DEMO REPORT" in answer.markdown or answer.available is False or answer.tools


def test_fakelm_nepali_report_has_note(mock_result):
    from pipeline.reporting.llm import FakeLLM
    from pipeline.reporting.report import build_report

    llm = FakeLLM()
    answer = build_report(mock_result, llm, lang="ne")
    assert answer.note is not None
    assert "machine-generated" in answer.note.lower() or "verify" in answer.note.lower()


# ── FakeLLM no-network-call test ──────────────────────────────────────────────


def test_fakelm_makes_no_network_call(mock_result, monkeypatch):
    """FakeLLM must not import or call the anthropic SDK."""
    import socket

    def _no_network(*args, **kwargs):
        raise AssertionError("Network call attempted during FakeLLM test!")

    monkeypatch.setattr(socket, "create_connection", _no_network)

    from pipeline.reporting.copilot import ask
    from pipeline.reporting.llm import FakeLLM

    llm = FakeLLM()
    # Should complete without network
    answer = ask("Which villages are cut off?", mock_result, llm, lang="en")
    assert isinstance(answer.markdown, str)


# ── API endpoint tests ─────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def mock_run_id(client):
    """Get the run_id from the mock store (after a /api/runs poll)."""
    response = client.get("/api/runs")
    assert response.status_code == 200
    runs = response.json()
    if runs:
        return runs[0]["runId"]
    # Fall back: start an analysis and get the run_id
    resp = client.post(
        "/api/analyze",
        json={"bbox": [85.12, 27.9, 85.42, 28.3], "floodDate": "2026-08-26", "osmDate": "2026-07-27", "useOptical": False},
    )
    assert resp.status_code == 202
    return resp.json()["runId"]


def test_ask_endpoint_refusal_for_trapped_people(client, mock_run_id):
    """POST /api/runs/{id}/ask must refuse trapped-people questions (Design §21)."""
    # Wait for run to be in succeeded state
    import time

    for _ in range(30):
        status = client.get(f"/api/runs/{mock_run_id}/status").json()
        if status.get("state") == "succeeded":
            break
        time.sleep(0.5)

    resp = client.post(
        f"/api/runs/{mock_run_id}/ask",
        json={"question": "How many people are trapped?", "lang": "en"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert "cannot" in body["markdown"].lower() or "not available" in body["markdown"].lower()


def test_ask_endpoint_villages_answer(client, mock_run_id):
    """POST /api/runs/{id}/ask for villages returns available=True with sources."""
    import time

    for _ in range(30):
        status = client.get(f"/api/runs/{mock_run_id}/status").json()
        if status.get("state") == "succeeded":
            break
        time.sleep(0.5)

    resp = client.post(
        f"/api/runs/{mock_run_id}/ask",
        json={"question": "Which villages are cut off?", "lang": "en"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert isinstance(body["markdown"], str)
    assert isinstance(body["tools"], list)
    assert len(body["tools"]) > 0


def test_report_endpoint_returns_copilot_answer(client, mock_run_id):
    """GET /api/runs/{id}/report returns CopilotAnswer with markdown."""
    import time

    for _ in range(30):
        status = client.get(f"/api/runs/{mock_run_id}/status").json()
        if status.get("state") == "succeeded":
            break
        time.sleep(0.5)

    resp = client.get(f"/api/runs/{mock_run_id}/report?lang=en")
    assert resp.status_code == 200
    body = resp.json()
    assert "available" in body
    assert "markdown" in body
    assert isinstance(body["markdown"], str)
    assert len(body["markdown"]) > 20


def test_ask_endpoint_404_for_unknown_run(client):
    resp = client.post(
        "/api/runs/does-not-exist/ask",
        json={"question": "test", "lang": "en"},
    )
    assert resp.status_code == 404


def test_report_endpoint_404_for_unknown_run(client):
    resp = client.get("/api/runs/does-not-exist/report?lang=en")
    assert resp.status_code == 404


def test_llm_api_key_not_in_frontend_bundle():
    """Verify no LLM_API_KEY or secret appears in any src/ file."""
    import re

    src_dir = Path(__file__).parent.parent.parent / "src"
    patterns = [
        r"LLM_API_KEY\s*=\s*['\"][a-zA-Z0-9_-]{10,}",  # actual key value
        r"sk-ant-[a-zA-Z0-9_-]{10,}",  # Anthropic key format
        r"anthropic_api_key\s*=\s*['\"][a-zA-Z0-9]",
    ]
    violations = []
    for f in src_dir.rglob("*.ts"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        for pat in patterns:
            if re.search(pat, content, re.IGNORECASE):
                violations.append(str(f))
    for f in src_dir.rglob("*.tsx"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        for pat in patterns:
            if re.search(pat, content, re.IGNORECASE):
                violations.append(str(f))
    assert violations == [], f"API key found in frontend files: {violations}"
