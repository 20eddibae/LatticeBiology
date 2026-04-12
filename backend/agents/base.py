"""Base agent class for the LatticeBio virtual research lab."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Groq API (free, OpenAI-compatible) ────────────────────────────────────────
# Uses the openai SDK pointed at Groq's endpoint for Llama 3.3 70B inference.
_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
_DEFAULT_MODEL = os.getenv("LLM_AGENT_MODEL", "llama-3.3-70b-versatile")

_llm_client: Any = None
if _GROQ_API_KEY:
    try:
        from openai import AsyncOpenAI
        _llm_client = AsyncOpenAI(
            api_key=_GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        logger.info("Groq LLM client initialised (model=%s)", _DEFAULT_MODEL)
    except ImportError:
        logger.warning("openai library not installed — agents will use Ollama fallback")

# Ollama fallback — always check, even if Groq is available (for runtime failures)
_OLLAMA_AVAILABLE = False
try:
    import ollama  # type: ignore  # noqa: F401
    _OLLAMA_AVAILABLE = True
except ImportError:
    pass


async def groq_chat_with_retry(messages: list, model: str | None = None, temperature: float = 0.3, max_tokens: int = 2048, caller: str = "groq") -> str:
    """Shared Groq chat call with exponential backoff on rate limits.
    Use this for direct _llm_client calls outside BaseAgent."""
    if not _llm_client:
        return ""
    model = model or _DEFAULT_MODEL
    max_retries = 6
    for attempt in range(max_retries):
        try:
            response = await _llm_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as exc:
            if "429" in str(exc) or "rate" in str(exc).lower():
                wait = min(3 * (2 ** attempt), 60)
                logger.info("[%s] Groq rate limited (attempt %d/%d), retrying in %ds", caller, attempt + 1, max_retries, wait)
                await asyncio.sleep(wait)
            else:
                logger.warning("[%s] Groq call failed: %s", caller, exc)
                return ""
    logger.warning("[%s] Groq rate limit exhausted after %d retries", caller, max_retries)
    return ""


class BaseAgent:
    """
    Async wrapper around Groq chat API (primary) with Ollama fallback.
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
        """Single chat call with retry on Groq rate limits. Returns empty string on failure."""
        messages = [
            {"role": "system", "content": system or self.SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ]

        # ── Groq path (primary) — retry up to 5 times on rate limit ──────
        if _llm_client:
            max_retries = 6
            for attempt in range(max_retries):
                try:
                    response = await _llm_client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=0.3,
                        max_tokens=2048,
                    )
                    return (response.choices[0].message.content or "").strip()
                except Exception as exc:
                    if "429" in str(exc) or "rate" in str(exc).lower():
                        wait = min(3 * (2 ** attempt), 60)  # 3, 6, 12, 24, 48, 60 seconds
                        logger.info(
                            "[%s] Groq rate limited (attempt %d/%d), retrying in %ds",
                            self.name, attempt + 1, max_retries, wait,
                        )
                        await asyncio.sleep(wait)
                    else:
                        logger.warning("[%s] Groq LLM call failed: %s", self.name, exc)
                        break
            else:
                logger.warning("[%s] Groq rate limit exhausted after %d retries", self.name, max_retries)

        # ── Ollama fallback ────────────────────────────────────────────
        if _OLLAMA_AVAILABLE:
            try:
                import ollama
                client = ollama.AsyncClient()
                response = await client.chat(
                    model="llama3.2:latest",
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
