"""pipeline/reporting/llm.py — Provider-agnostic LLM interface (Design §20, Rules §5).

Architecture:
  LLMClient (ABC)
    ├── AnthropicLLM  — used when LLM_PROVIDER=anthropic and LLM_API_KEY is set
    └── FakeLLM       — used in tests and when LLM_PROVIDER is empty; no network call

The model name is read from config (not hardcoded), set via LLM_MODEL env var.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("floodsight.llm")

# Message dict shape: {"role": "user"|"assistant", "content": str}
Message = dict[str, str]


class LLMClient(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    def complete(
        self,
        system: str,
        messages: list[Message],
        max_tokens: int = 2048,
    ) -> str:
        """Call the model and return the text response.

        Args:
            system: System prompt string.
            messages: List of {"role": ..., "content": ...} dicts.
            max_tokens: Maximum tokens to generate.

        Returns:
            The model's text response string.
        """


class AnthropicLLM(LLMClient):
    """Anthropic Messages API implementation.

    Uses the official `anthropic` Python SDK (v1.x).
    The model name is NOT hardcoded — it comes from settings.

    Docs: https://docs.anthropic.com/en/api/messages
    Current model IDs (confirmed 2026-10):
      claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5, claude-fable-5-1
    """

    def __init__(self, api_key: str, model: str) -> None:
        try:
            import anthropic  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError(
                "anthropic SDK not installed. Run: pip install 'anthropic>=0.50.0'"
            ) from exc
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model
        logger.info("AnthropicLLM initialised with model=%s", model)

    def complete(
        self,
        system: str,
        messages: list[Message],
        max_tokens: int = 2048,
    ) -> str:
        """Call the Anthropic Messages API and return the text content."""
        response = self._client.messages.create(
            model=self._model,
            system=system,
            messages=messages,  # type: ignore[arg-type]
            max_tokens=max_tokens,
        )
        # response.content is a list of ContentBlock; extract text
        parts = [block.text for block in response.content if hasattr(block, "text")]
        return "\n".join(parts).strip()


class FakeLLM(LLMClient):
    """Deterministic fallback LLM used when no API key is configured or in tests.

    Builds a structured English summary directly from the context facts injected
    in the system prompt — no network call is made.  The answer uses {{key}}
    placeholder tokens so verify_numbers() passes.
    """

    def complete(
        self,
        system: str,
        messages: list[Message],
        max_tokens: int = 2048,
    ) -> str:
        """Return a simple deterministic response that uses placeholder tokens."""
        # Extract the last user message
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        lower = last_user.lower()

        # Refuse population / people-trapped questions
        refusal_triggers = [
            "people trapped",
            "how many people",
            "trapped",
            "population",
            "casualties",
            "fatalities",
            "dead",
            "deaths",
            "injured",
        ]
        if any(t in lower for t in refusal_triggers):
            return (
                "I cannot provide a verified number of trapped or affected people "
                "because the current analysis does not contain a validated population "
                "or trapped-person estimate."
            )

        # Village cut-off question
        if "village" in lower or "cut" in lower or "isolated" in lower or "settlement" in lower:
            return (
                "Based on the road-connectivity analysis, {{n_cutoff}} villages "
                "are road-isolated (no remaining mapped road path) after the flood event. "
                "The affected villages are listed in `#cutoff_villages`. "
                "Note: road isolation is based on mapped road data only; "
                "foot trails may still exist. "
                "The highest-priority settlement is shown in `#priority_village`."
            )

        # Building damage question
        if "building" in lower:
            return (
                "The analysis estimates {{n_buildings}} buildings "
                "as estimated affected (likely hit) by the flood or debris. "
                "See `#n_buildings` for the data source."
            )

        # Bridge question
        if "bridge" in lower:
            return (
                "{{n_bridges_damaged}} bridges are assessed as likely damaged "
                "based on their intersection with the flood polygon. "
                "See `#n_bridges` for the data source."
            )

        # General summary
        return (
            "Flood event on {{event_date}} in {{area_name}}.\n\n"
            "- Flooded area: {{flood_km2}} km²\n"
            "- Buildings estimated affected: {{n_buildings}}\n"
            "- Road length affected: {{road_km}} km\n"
            "- Bridges likely damaged: {{n_bridges_damaged}}\n"
            "- Villages road-isolated: {{n_cutoff}}\n\n"
            "All figures come from the deterministic pipeline result. "
            "See the sources panel for data provenance."
        )


def make_llm_client(provider: str, api_key: str, model: str) -> LLMClient:
    """Factory that returns the appropriate LLM client.

    Args:
        provider: "anthropic" or "" (empty → FakeLLM)
        api_key: API key string (can be empty if provider is empty)
        model: Model name string (from config)

    Returns:
        Configured LLMClient instance.
    """
    if provider.lower() == "anthropic" and api_key:
        return AnthropicLLM(api_key=api_key, model=model)
    if provider and not api_key:
        logger.warning("LLM_PROVIDER=%s but LLM_API_KEY is empty — falling back to FakeLLM", provider)
    else:
        logger.info("LLM_PROVIDER is empty — using FakeLLM (no network calls)")
    return FakeLLM()
