"""Base agent class for the BioStream virtual research lab."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "llama3.2:3b"


class BaseAgent:
    """
    Async wrapper around Ollama chat API.
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
        """Single chat call to Ollama. Returns empty string on failure."""
        try:
            import ollama  # lazy — module loads without ollama installed
            client = ollama.AsyncClient()
            response = await client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": system or self.SYSTEM_PROMPT},
                    {"role": "user", "content": user},
                ],
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
