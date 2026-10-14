"""pipeline/reporting/report.py — 7-section one-page report builder (Design §22, FR-17).

Report sections:
  1. Event Overview
  2. Satellite Analysis
  3. Infrastructure Impact
  4. Road Connectivity
  5. Priority Settlements
  6. Limitations
  7. Data Sources / Attribution

If the run provenance is not 'live', the report is prefixed with
"DEMO REPORT: based on placeholder data".

The LLM polishes sentence wording only.
verify_numbers() guards the final text.
"""

from __future__ import annotations

import logging

from pipeline.reporting.copilot import (
    CopilotAnswerData,
    _build_allowed_numbers,
    _gather_facts,
    _substitute_placeholders,
    verify_numbers,
)
from pipeline.reporting.llm import LLMClient
from pipeline.reporting.prompts import (
    NEPALI_DISCLAIMER,
    REFUSAL_EN,
    REFUSAL_NE,
    REPORT_SYSTEM_EN,
    REPORT_SYSTEM_NE,
)
from pipeline.reporting.tools import ToolResult

logger = logging.getLogger("floodsight.report")


def _build_report_prompt(facts: dict[str, ToolResult], lang: str = "en") -> str:
    """Build a detailed structured prompt for the report from tool results."""
    s = facts.get("summary")
    v = s.value if s else {}
    cv = facts.get("cutoff_villages")
    scene = facts.get("scene_metadata")
    lim = facts.get("limitations")
    prov = facts.get("provenance")

    scenes_info = ""
    if scene and scene.value.get("scenes"):
        scenes_info = "\n".join(
            f"  {sc['role'].upper()}: {sc['sensor']} {sc['date']} ({sc['orbit']})"
            for sc in scene.value["scenes"]
        )

    limitations_text = ""
    if lim and lim.value:
        limitations_text = "\n".join(f"  - {item}" for item in lim.value)

    cutoff_text = ""
    if cv and cv.value:
        cutoff_text = "\n".join(
            f"  - {v_['name']}: priority={v_.get('priority')}, "
            f"hospital_before={v_['distance_before_km']} km, alternate={v_['alternate_route']}"
            for v_ in cv.value
        )
    else:
        cutoff_text = "  None"

    data_mode = prov.value.get("data_mode") if prov else "unknown"

    intro = (
        "DEMO REPORT: based on placeholder data.\n\n"
        if data_mode != "live"
        else ""
    )

    prompt = f"""Write the one-page flood situation report using ONLY these verified facts.
Use {{{{key}}}} tokens for every number (do not write any digit directly).

{intro}FACTS:
  area_name = {v.get('area_name')}
  event_date = {v.get('event_date')}
  flooded_area_km2 = {v.get('flooded_area_km2')}
  debris_area_km2 = {v.get('debris_area_km2')}
  buildings_likely_hit = {v.get('buildings_likely_hit')}
  buildings_total = {v.get('buildings_total')}
  road_length_affected_km = {v.get('road_length_affected_km')}
  bridges_likely_damaged = {v.get('bridges_likely_damaged')}
  bridges_total = {v.get('bridges_total')}
  villages_cut_off = {v.get('villages_cut_off')}
  villages_total = {v.get('villages_total')}
  data_mode = {data_mode}

SATELLITE SCENES:
{scenes_info}

CUT-OFF SETTLEMENTS:
{cutoff_text}

LIMITATIONS:
{limitations_text}

Write 7 ## sections in {"Nepali" if lang == "ne" else "English"}.
Use placeholder tokens for every number.
"""
    return prompt


def build_report(
    result,
    llm: LLMClient,
    lang: str = "en",
) -> CopilotAnswerData:
    """Generate a one-page grounded situation report.

    Args:
        result: RunResult
        llm: LLMClient
        lang: "en" or "ne"

    Returns:
        CopilotAnswerData with the report markdown and sources.
    """
    facts, tools_used = _gather_facts(result)
    allowed = _build_allowed_numbers(facts)

    prov = facts.get("provenance")
    data_mode = prov.value.get("data_mode") if prov else "unknown"
    is_demo = data_mode != "live"

    system = REPORT_SYSTEM_NE if lang == "ne" else REPORT_SYSTEM_EN
    report_prompt = _build_report_prompt(facts, lang)
    messages = [{"role": "user", "content": report_prompt}]

    raw = llm.complete(system=system, messages=messages, max_tokens=3000)
    logger.debug("Report raw (lang=%s, demo=%s): %s", lang, is_demo, raw[:200])

    # verify_numbers
    ok, violations = verify_numbers(raw, allowed)
    if not ok:
        logger.warning("Report verify_numbers failed (violations=%s); retrying", violations)
        correction = (
            f"Your previous report contained unverified digits: {violations}. "
            "Replace all digits with {{key}} placeholder tokens."
        )
        messages2 = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": correction},
        ]
        raw = llm.complete(system=system, messages=messages2, max_tokens=3000)
        ok2, violations2 = verify_numbers(raw, allowed)
        if not ok2:
            refusal = (REFUSAL_NE if lang == "ne" else REFUSAL_EN).format(metric="report data")
            return CopilotAnswerData(
                available=False,
                markdown=refusal,
                tools=tools_used,
                note=NEPALI_DISCLAIMER if lang == "ne" else None,
            )

    # Prefix DEMO warning if provenance is not live
    demo_prefix = ""
    if is_demo:
        demo_prefix = (
            "> **DEMO REPORT: based on placeholder data.**\n"
            "> Numbers are illustrative and do not represent a real event.\n\n"
        )

    final = demo_prefix + _substitute_placeholders(raw, facts)

    # Build sources map (same as copilot)
    from pipeline.reporting.copilot import _build_sources  # noqa: PLC0415
    sources = _build_sources(facts, raw, result.run_id)

    return CopilotAnswerData(
        available=True,
        markdown=final,
        sources=sources,
        tools=tools_used,
        note=NEPALI_DISCLAIMER if lang == "ne" else None,
    )
