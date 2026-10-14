"""pipeline/reporting/copilot.py — Grounded copilot tool-calling loop (Design §20-21, Rules §5).

Flow:
  1. Call all relevant tools to gather facts.
  2. Inject facts into the system prompt as context.
  3. Call the LLM once.
  4. Run verify_numbers() — if unverified digits found, retry once with correction message.
  5. If still failing, return refusal.
  6. Substitute {{key}} placeholders from tool results.
  7. Return CopilotAnswerData with sources map and tool list.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from pipeline.reporting.llm import LLMClient
from pipeline.reporting.prompts import (
    NEPALI_DISCLAIMER,
    REFUSAL_EN,
    REFUSAL_NE,
    SYSTEM_EN,
    SYSTEM_NE,
)
from pipeline.reporting.tools import (
    ToolResult,
    get_bridges,
    get_cutoff_villages,
    get_damage_summary,
    get_limitations,
    get_provenance,
    get_scene_metadata,
    get_summary,
)

logger = logging.getLogger("floodsight.copilot")


@dataclass
class NumberSource:
    """One verifiable number with its source reference."""

    display: str
    layer: str
    query: str
    value: str
    run_id: str


@dataclass
class CopilotAnswerData:
    """Mirrors CopilotAnswer from src/lib/types.ts."""

    available: bool
    markdown: str
    sources: dict[str, NumberSource] = field(default_factory=dict)
    tools: list[str] = field(default_factory=list)
    table: dict | None = None
    mini_map: dict | None = None
    note: str | None = None  # shown in UI for Nepali answers


def verify_numbers(answer: str, allowed_numbers: set[str]) -> tuple[bool, list[str]]:
    """Pure function: check that every digit sequence in `answer` is allowed.

    A digit sequence is allowed if:
      - it appears in `allowed_numbers` (the set of values produced by tool calls), OR
      - it is inside a {{...}} placeholder (which will be substituted by the server).

    Args:
        answer: The LLM-generated text (after placeholder substitution).
        allowed_numbers: Set of string representations of all tool-result numbers.

    Returns:
        (ok, violations) where ok=True means no violations.
    """
    # Remove all {{...}} placeholder tokens before scanning
    stripped = re.sub(r"\{\{[^}]+\}\}", "", answer)
    # Remove markdown code spans that contain #key references
    stripped = re.sub(r"`#[^`]+`", "", stripped)

    # Find all digit sequences (runs of digits, possibly with commas/dots for formatting)
    # We match numbers like 184, 1,184, 7.2, etc.
    found = re.findall(r"\b[\d,]+(?:\.\d+)?\b", stripped)
    violations = [n for n in found if n.replace(",", "") not in {a.replace(",", "") for a in allowed_numbers}]
    return len(violations) == 0, violations


def _gather_facts(result: Any) -> tuple[dict[str, ToolResult], list[str]]:
    """Call all tools and return a dict of results and tool names used."""
    tools_used: list[str] = []
    facts: dict[str, ToolResult] = {}

    def call(name: str, fn, *args, **kwargs) -> ToolResult | None:
        try:
            r = fn(*args, **kwargs)
            facts[name] = r
            tools_used.append(name)
            return r
        except Exception:
            logger.exception("Tool %s failed", name)
            return None

    call("summary", get_summary, result)
    call("cutoff_villages", get_cutoff_villages, result)
    call("buildings_all", get_damage_summary, result, "buildings")
    call("roads", get_damage_summary, result, "roads")
    call("bridges", get_damage_summary, result, "bridges")
    call("bridges_list", get_bridges, result, "damaged")
    call("scene_metadata", get_scene_metadata, result)
    call("limitations", get_limitations, result)
    call("provenance", get_provenance, result)

    return facts, tools_used


def _build_context(facts: dict[str, ToolResult]) -> str:
    """Serialise tool results into a concise context block for the system prompt."""
    lines = ["VERIFIED SYSTEM FACTS (from deterministic pipeline):"]
    s = facts.get("summary")
    if s and s.value:
        v = s.value
        lines += [
            f"  area_name = {v.get('area_name')}",
            f"  event_date = {v.get('event_date')}",
            f"  flooded_area_km2 = {v.get('flooded_area_km2')}",
            f"  debris_area_km2 = {v.get('debris_area_km2')}",
            f"  buildings_likely_hit = {v.get('buildings_likely_hit')}",
            f"  buildings_total = {v.get('buildings_total')}",
            f"  road_length_affected_km = {v.get('road_length_affected_km')}",
            f"  bridges_likely_damaged = {v.get('bridges_likely_damaged')}",
            f"  villages_cut_off = {v.get('villages_cut_off')}",
        ]
    cv = facts.get("cutoff_villages")
    if cv and cv.value:
        lines.append(f"  cutoff_villages = {[v['name'] for v in cv.value]}")

    lim = facts.get("limitations")
    if lim and lim.value:
        lines.append(f"  limitations = {lim.value[:3]}...")  # first 3

    prov = facts.get("provenance")
    if prov and prov.value:
        lines.append(f"  data_mode = {prov.value.get('data_mode')}")

    lines.append(
        "\nPOPULATION / PEOPLE TRAPPED: NOT AVAILABLE — refuse if asked.\n"
        "WATER DEPTH: NOT AVAILABLE — refuse if asked.\n"
        "BUILDING COLLAPSE COUNT: NOT AVAILABLE — only 'likely hit' is computed.\n"
    )
    return "\n".join(lines)


def _build_allowed_numbers(facts: dict[str, ToolResult]) -> set[str]:
    """Collect all numeric values from tool results into an allowed-numbers set."""
    allowed: set[str] = set()

    def _add(v: Any) -> None:
        if isinstance(v, (int, float)):
            allowed.add(str(v))
            allowed.add(str(int(v)) if isinstance(v, float) and v == int(v) else str(v))
        elif isinstance(v, dict):
            for item in v.values():
                _add(item)
        elif isinstance(v, list):
            for item in v:
                _add(item)

    for tr in facts.values():
        _add(tr.value)
    return allowed


def _build_sources(
    facts: dict[str, ToolResult],
    answer: str,
    run_id: str,
) -> dict[str, NumberSource]:
    """Map placeholder keys used in the final answer to NumberSource objects."""
    sources: dict[str, NumberSource] = {}
    s = facts.get("summary")
    if not s:
        return sources
    v = s.value

    key_map: dict[str, tuple[str, str, str]] = {
        # key → (display_value, layer, query)
        "n_cutoff": (
            str(v.get("villages_cut_off", "")),
            "villages",
            "villages with status=cut_off",
        ),
        "n_buildings": (
            str(v.get("buildings_likely_hit", "")),
            "buildings",
            "buildings with status=likely_hit",
        ),
        "n_buildings_total": (
            str(v.get("buildings_total", "")),
            "buildings",
            "total buildings analyzed",
        ),
        "road_km": (
            str(v.get("road_length_affected_km", "")),
            "roads",
            "road length affected (km)",
        ),
        "n_bridges_damaged": (
            str(v.get("bridges_likely_damaged", "")),
            "bridges",
            "bridges with status=damaged",
        ),
        "n_bridges_total": (
            str(v.get("bridges_total", "")),
            "bridges",
            "total bridges analyzed",
        ),
        "flood_km2": (
            str(v.get("flooded_area_km2", "")),
            "flood_polygons",
            "flooded area (km²)",
        ),
        "debris_km2": (
            str(v.get("debris_area_km2", "")),
            "debris_polygons",
            "debris area (km²)",
        ),
        "event_date": (str(v.get("event_date", "")), "metadata", "event date"),
        "area_name": (str(v.get("area_name", "")), "metadata", "area name"),
    }

    # Add cutoff village names
    cv = facts.get("cutoff_villages")
    if cv and cv.value:
        for i, village in enumerate(cv.value):
            k = f"village_{i + 1}"
            key_map[k] = (village["name"], "villages", f"cut-off village #{i + 1}")
        key_map["priority_village"] = (
            cv.value[0]["name"] if cv.value else "N/A",
            "villages",
            "highest-priority cut-off village",
        )
        key_map["cutoff_villages"] = (
            ", ".join(v_["name"] for v_ in cv.value),
            "villages",
            "all cut-off villages",
        )

    # Only emit sources for keys actually referenced in the answer
    used_keys = set(re.findall(r"\{\{([^}]+)\}\}", answer))
    used_keys |= set(re.findall(r"`#([^`]+)`", answer))

    for k, (display, layer, query) in key_map.items():
        if k in used_keys or k in answer:
            sources[k] = NumberSource(
                display=display,
                layer=layer,
                query=query,
                value=display,
                run_id=run_id,
            )

    return sources


def _substitute_placeholders(answer: str, facts: dict[str, ToolResult]) -> str:
    """Replace {{key}} tokens with actual values from tool results."""
    s = facts.get("summary")
    v = s.value if s else {}

    replacements = {
        "n_cutoff": str(v.get("villages_cut_off", "N/A")),
        "n_buildings": str(v.get("buildings_likely_hit", "N/A")),
        "n_buildings_total": str(v.get("buildings_total", "N/A")),
        "road_km": str(v.get("road_length_affected_km", "N/A")),
        "n_bridges_damaged": str(v.get("bridges_likely_damaged", "N/A")),
        "n_bridges_total": str(v.get("bridges_total", "N/A")),
        "flood_km2": str(v.get("flooded_area_km2", "N/A")),
        "debris_km2": str(v.get("debris_area_km2", "N/A")),
        "event_date": str(v.get("event_date", "N/A")),
        "area_name": str(v.get("area_name", "N/A")),
    }

    # Add village placeholders
    cv = facts.get("cutoff_villages")
    if cv and cv.value:
        replacements["cutoff_villages"] = ", ".join(v_["name"] for v_ in cv.value)
        replacements["priority_village"] = cv.value[0]["name"]
        for i, village in enumerate(cv.value):
            replacements[f"village_{i + 1}"] = village["name"]

    def _replace(m: re.Match) -> str:
        key = m.group(1)
        return replacements.get(key, m.group(0))

    return re.sub(r"\{\{([^}]+)\}\}", _replace, answer)


def _is_refusal(answer: str) -> bool:
    """Detect if the LLM produced a refusal response."""
    lower = answer.lower()
    return (
        "cannot provide a verified" in lower
        or "does not contain a validated" in lower
        or "not available" in lower
        or "I cannot" in answer
    )


def ask(
    question: str,
    result: Any,
    llm: LLMClient,
    lang: str = "en",
) -> CopilotAnswerData:
    """Answer a question grounded in the RunResult.

    Args:
        question: The user's question string.
        result: RunResult (Pydantic model with .kpis, .villages, etc.)
        llm: LLMClient instance.
        lang: "en" or "ne"

    Returns:
        CopilotAnswerData with available/markdown/sources/tools/note fields.
    """
    facts, tools_used = _gather_facts(result)
    context = _build_context(facts)
    allowed = _build_allowed_numbers(facts)

    system = (SYSTEM_NE if lang == "ne" else SYSTEM_EN) + "\n\n" + context
    messages = [{"role": "user", "content": question}]

    # First LLM call
    raw = llm.complete(system=system, messages=messages)
    logger.debug("Copilot raw answer (lang=%s): %s", lang, raw[:200])

    # Check if it's a refusal — refusals are always OK
    if _is_refusal(raw):
        return CopilotAnswerData(
            available=False,
            markdown=raw,
            tools=tools_used,
            note=NEPALI_DISCLAIMER if lang == "ne" else None,
        )

    # verify_numbers on the pre-substitution text (placeholders not yet filled)
    ok, violations = verify_numbers(raw, allowed)
    if not ok:
        logger.warning("verify_numbers failed (violations=%s); retrying once", violations)
        correction = (
            f"Your previous answer contained unverified numbers: {violations}. "
            "Please remove all direct digits and use {{key}} placeholder tokens only."
        )
        messages2 = messages + [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": correction},
        ]
        raw = llm.complete(system=system, messages=messages2)

        ok2, violations2 = verify_numbers(raw, allowed)
        if not ok2:
            logger.warning("verify_numbers still failing after retry (violations=%s); returning refusal", violations2)
            refusal = (REFUSAL_NE if lang == "ne" else REFUSAL_EN).format(
                metric="the requested metric"
            )
            return CopilotAnswerData(
                available=False,
                markdown=refusal,
                tools=tools_used,
                note=NEPALI_DISCLAIMER if lang == "ne" else None,
            )

    # Substitute placeholders
    final = _substitute_placeholders(raw, facts)
    sources = _build_sources(facts, raw, result.run_id)

    # Build table for cut-off villages if question was about villages
    table = None
    cv = facts.get("cutoff_villages")
    if cv and cv.value and ("village" in question.lower() or "cut" in question.lower() or "isolated" in question.lower()):
        table = {
            "columns": ["Village", "Priority", "Hospital distance (before)", "Alternate"],
            "rows": [
                [v_["name"], str(v_.get("priority") or "—"), f"{v_['distance_before_km']} km", v_["alternate_route"]]
                for v_ in cv.value
            ],
        }
        mini_map = {"village_ids": [v_.get("name", "") for v_ in cv.value]}
    else:
        mini_map = None

    return CopilotAnswerData(
        available=True,
        markdown=final,
        sources=sources,
        tools=tools_used,
        table=table,
        mini_map=mini_map,
        note=NEPALI_DISCLAIMER if lang == "ne" else None,
    )
