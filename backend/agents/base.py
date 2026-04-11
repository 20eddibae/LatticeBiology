"""Base agent class for the BioStream virtual research lab."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
_DEFAULT_MODEL = os.getenv("OPENAI_AGENT_MODEL", "gpt-4o-mini")

# Initialise shared OpenAI client once
_openai_client: Any = None
if _OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=_OPENAI_API_KEY)
        logger.info("Agent OpenAI client initialised (model=%s)", _DEFAULT_MODEL)
    except ImportError:
        logger.warning("openai library not installed — agents will use Ollama fallback")

# Ollama fallback
_OLLAMA_AVAILABLE = False
if _openai_client is None:
    try:
        import ollama  # type: ignore  # noqa: F401
        _OLLAMA_AVAILABLE = True
    except ImportError:
        pass


class BaseAgent:
    """
    Async wrapper around OpenAI chat API (primary) with Ollama fallback.
    Subclasses define SYSTEM_PROMPT and domain-specific methods.
    """

    SYSTEM_PROMPT: str = "You are a helpful AI research assistant."

    def __init__(
        self,
        name: str,
        role: str,
        color: str,
        model: str = _DEFAULT_MODEL,
    ) -> None:
        self.name = name
        self.role = role
        self.color = color
        self.model = model

    async def _chat(self, user: str, system: str | None = None) -> str:
        """Single chat call. Returns empty string on failure."""
        messages = [
            {"role": "system", "content": system or self.SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ]

        # ── OpenAI path (primary) ──────────────────────────────────────
        if _openai_client:
            try:
                response = await _openai_client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=2048,
                )
                return (response.choices[0].message.content or "").strip()
            except Exception as exc:
                logger.warning("[%s] OpenAI call failed: %s", self.name, exc)
                # Fall through to Ollama

        # ── Ollama fallback ────────────────────────────────────────────
        if _OLLAMA_AVAILABLE:
            try:
                import ollama
                client = ollama.AsyncClient()
                response = await client.chat(
                    model="llama3.2:3b",
                    messages=messages,
                )
                return response.message.content.strip()
            except Exception as exc:
                logger.warning("[%s] Ollama call failed: %s", self.name, exc)

        return ""

    async def _json_chat(
        self,
        user: str,
        system: str | None = None,
        fallback: Any = None,
    ) -> Any:
        """Chat call that parses the response as JSON. Returns fallback on error."""
        text = await self._chat(user, system)
        if not text:
            return fallback

        # Strip markdown code fences
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

        # Isolate first JSON object (handles preamble text)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        return fallback
