"""
Multi-agent orchestrator for the BioStream virtual research lab.

Agent hierarchy (inspired by Zou et al., Stanford):
  PI Agent       – orchestrator, synthesizer
  Hypothesis Agent – specialist, generates testable mechanisms
  Critic Agent   – adversarial peer reviewer
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from .base import BaseAgent, _DEFAULT_MODEL
from .tools import lookup_alphafold

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Agent classes
# ---------------------------------------------------------------------------


class PIAgent(BaseAgent):
    """Principal Investigator — parses query and synthesizes final output."""

    _ANALYZE_SYSTEM = """\
You are the PI of a virtual computational biology lab.
Parse the research query into structured entities and a primary hypothesis.
Respond ONLY with valid JSON — no prose before or after.

Schema:
{
  "entities": [{"name": string, "type": "protein|gene|compound|disease|pathway", "priority": "high|medium|low"}],
  "primary_hypothesis": string,
  "research_focus": string,
  "suggested_analyses": [string]
}"""

    _SYNTHESIZE_SYSTEM = """\
You are a PI writing a concise research brief (2-3 paragraphs, plain text).
Integrate multi-agent findings into clear scientific insights covering:
1. What was found (key entities, structural data if available)
2. The most supported hypothesis and its molecular mechanism
3. Recommended next experimental steps
Be specific and scientifically grounded."""

    async def analyze(self, query: str) -> Dict[str, Any]:
        fallback = {
            "entities": [],
            "primary_hypothesis": "Requires experimental validation.",
            "research_focus": query,
            "suggested_analyses": ["Literature review", "Structural prediction"],
        }
        return (
            await self._json_chat(
                f"Research query: {query}",
                system=self._ANALYZE_SYSTEM,
                fallback=fallback,
            )
            or fallback
        )

    async def synthesize(
        self,
        query: str,
        entities: List[dict],
        hypotheses: List[dict],
        critique: Dict[str, Any],
        alphafold_results: List[dict],
    ) -> str:
        entity_summary = ", ".join(
            f"{e['name']} ({e['type']})" for e in entities[:5]
        ) or "no entities identified"

        af_summary = (
            "; ".join(
                f"{r['protein_name']} [UniProt {r['accession']}, "
                f"pLDDT {r['mean_confidence']}%]"
                for r in alphafold_results
            )
            if alphafold_results
            else "No structural data retrieved"
        )

        hyp_lines = "\n".join(
            f"- {h.get('hypothesis', '')} "
            f"[confidence {int(h.get('confidence', 0.65)*100)}%]"
            for h in hypotheses
        ) or "No hypotheses proposed"

        prompt = f"""Query: {query}

Entities: {entity_summary}
Structural data: {af_summary}

Hypotheses:
{hyp_lines}

Critic verdict: {critique.get('assessment', 'moderate').upper()} — \
{critique.get('overall_verdict', '')}

Write the research brief:"""

        result = await self._chat(prompt, system=self._SYNTHESIZE_SYSTEM)
        if result:
            return result

        # Deterministic fallback
        best_hyp = hypotheses[0].get("hypothesis", "") if hypotheses else ""
        return (
            f"Analysis of '{query}' identified {len(entities)} key entities including "
            f"{entity_summary}. "
            + (f"AlphaFold structural predictions were retrieved for proteins with "
               f"{af_summary}. " if alphafold_results else "")
            + (f"The leading hypothesis proposes that {best_hyp}. " if best_hyp else "")
            + f"Critic assessment: {critique.get('overall_verdict', 'moderate confidence — experimental validation required')}."
        )


class HypothesisAgent(BaseAgent):
    """Generates specific, testable scientific hypotheses."""

    _SYSTEM = """\
You are a computational biology hypothesis generator in a virtual research lab.
Generate exactly 2 testable hypotheses from the provided entities and structural data.
Respond ONLY with valid JSON — no prose before or after.

Schema:
{
  "hypotheses": [
    {
      "hypothesis": string,
      "mechanism": string,
      "testability": "high|medium|low",
      "confidence": float (0-1),
      "experimental_approach": string
    }
  ],
  "key_unknowns": [string]
}"""

    async def generate(
        self,
        query: str,
        entities: List[dict],
        alphafold_results: List[dict],
    ) -> Dict[str, Any]:
        entity_block = "\n".join(
            f"- {e['name']} ({e['type']}, {e.get('priority','medium')} priority)"
            for e in entities
        ) or "- (none identified)"

        af_block = (
            "\n".join(
                f"- {r['protein_name']} (UniProt {r['accession']}, "
                f"pLDDT {r['mean_confidence']}%, tier={r['confidence_tier']})"
                for r in alphafold_results
            )
            if alphafold_results
            else "- No structural data available"
        )

        fallback = {
            "hypotheses": [
                {
                    "hypothesis": (
                        f"The entities identified in '{query}' form a co-regulatory "
                        "network that modulates disease phenotype through transcriptional crosstalk."
                    ),
                    "mechanism": "Shared transcription factor binding at promoter regions creates coherent gene expression modules.",
                    "testability": "high",
                    "confidence": 0.67,
                    "experimental_approach": "ChIP-seq + RNA-seq co-expression analysis across cell lines",
                },
                {
                    "hypothesis": (
                        "Post-translational modifications of key proteins alter complex stability "
                        "and downstream signaling under pathological conditions."
                    ),
                    "mechanism": "Phosphorylation-dependent conformational changes reduce binding affinity in the active site.",
                    "testability": "medium",
                    "confidence": 0.58,
                    "experimental_approach": "Mass-spec phosphoproteomics + cryo-EM structural comparison",
                },
            ],
            "key_unknowns": ["Cell-type specificity", "In vivo relevance", "Temporal dynamics"],
        }

        return (
            await self._json_chat(
                f"Research query: {query}\n\nEntities:\n{entity_block}\n\n"
                f"AlphaFold data:\n{af_block}\n\nGenerate 2 hypotheses:",
                system=self._SYSTEM,
                fallback=fallback,
            )
            or fallback
        )


class CriticAgent(BaseAgent):
    """Adversarial peer reviewer — finds flaws and missing evidence."""

    _SYSTEM = """\
You are a rigorous scientific critic and peer reviewer in a virtual research lab.
Your job: identify flaws, confounders, and unsupported claims in proposed hypotheses.
Be skeptical and specific. Respond ONLY with valid JSON — no prose before or after.

Schema:
{
  "assessment": "strong|moderate|weak",
  "confidence_score": float (0-1),
  "critiques": [
    {"issue": string, "severity": "high|medium|low", "suggestion": string}
  ],
  "missing_evidence": [string],
  "overall_verdict": string
}"""

    async def review(
        self,
        query: str,
        hypotheses: List[dict],
    ) -> Dict[str, Any]:
        hyp_block = "\n".join(
            f"{i+1}. {h.get('hypothesis','')}\n   Mechanism: {h.get('mechanism','')}"
            for i, h in enumerate(hypotheses)
        ) or "1. No hypotheses provided."

        fallback = {
            "assessment": "moderate",
            "confidence_score": 0.70,
            "critiques": [
                {
                    "issue": "Causality not established",
                    "severity": "high",
                    "suggestion": "Use isogenic knockdown/knockin models to establish directionality",
                },
                {
                    "issue": "In vitro → in vivo translation unaddressed",
                    "severity": "medium",
                    "suggestion": "Validate key findings in patient-derived organoids or mouse models",
                },
            ],
            "missing_evidence": [
                "Clinical cohort validation",
                "Temporal dynamics data",
                "Orthogonal experimental confirmation",
            ],
            "overall_verdict": (
                "Hypotheses are mechanistically plausible and grounded in published biology, "
                "but causality and clinical relevance remain to be demonstrated. "
                "Recommend genetic perturbation studies before advancing to in vivo models."
            ),
        }

        return (
            await self._json_chat(
                f"Research context: {query}\n\nHypotheses under review:\n{hyp_block}\n\nProvide critique:",
                system=self._SYSTEM,
                fallback=fallback,
            )
            or fallback
        )


# ---------------------------------------------------------------------------
# Module-level agent instances
# ---------------------------------------------------------------------------

pi_agent = PIAgent("PI Agent", "orchestrator", "#0F766E", model=_DEFAULT_MODEL)
hypothesis_agent = HypothesisAgent("Hypothesis Agent", "specialist", "#7C3AED", model=_DEFAULT_MODEL)
critic_agent = CriticAgent("Critic Agent", "critic", "#D97706", model=_DEFAULT_MODEL)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _add_message(
    session: Dict[str, Any],
    agent_name: str,
    agent_role: str,
    agent_color: str,
    content: str,
    msg_type: str = "message",
    tool_data: Any = None,
) -> None:
    session["messages"].append(
        {
            "id": str(uuid.uuid4()),
            "agent_name": agent_name,
            "agent_role": agent_role,
            "agent_color": agent_color,
            "content": content,
            "timestamp": _now(),
            "message_type": msg_type,
            "tool_data": tool_data,
        }
    )


# ---------------------------------------------------------------------------
# Main orchestration pipeline
# ---------------------------------------------------------------------------


async def run_lab_session(
    session_id: str,
    query: str,
    sessions: Dict[str, Dict[str, Any]],
) -> None:
    """
    Multi-agent pipeline. Runs as a FastAPI BackgroundTask.
    Mutates `sessions[session_id]` in-place so the frontend can poll progress.
    """
    session = sessions[session_id]
    session["status"] = "running"

    def pi(content: str, msg_type: str = "message", tool_data: Any = None) -> None:
        _add_message(session, "PI Agent", "orchestrator", "#0F766E", content, msg_type, tool_data)

    def hyp(content: str) -> None:
        _add_message(session, "Hypothesis Agent", "specialist", "#7C3AED", content)

    def crit(content: str) -> None:
        _add_message(session, "Critic Agent", "critic", "#D97706", content)

    try:
        # ── 1. PI: parse query ─────────────────────────────────────────────────
        pi(f'Received research query: **"{query}"**\n\nParsing key entities and dispatching specialist agents...')

        analysis = await pi_agent.analyze(query)
        entities: List[dict] = analysis.get("entities", [])
        session["entities_found"] = entities

        entity_str = ", ".join(f"**{e['name']}** ({e['type']})" for e in entities[:6])
        pi(
            f"Identified {len(entities)} entities: {entity_str}\n\n"
            f"Primary hypothesis: *{analysis.get('primary_hypothesis', 'TBD')}*\n\n"
            f"Requesting AlphaFold structural predictions for proteins..."
        )

        # ── 2. Tool: AlphaFold lookups ─────────────────────────────────────────
        proteins = [e for e in entities if e.get("type") == "protein"][:2]
        for prot in proteins:
            pi(f"→ AlphaFold tool call: **{prot['name']}**", msg_type="tool_call")
            af = await lookup_alphafold(prot["name"])
            if af:
                session["alphafold_results"].append(af)
                tier_label = {"high": "high confidence", "medium": "medium confidence", "low": "low confidence"}.get(
                    af["confidence_tier"], ""
                )
                pi(
                    f"Structure retrieved: **{prot['name']}** → UniProt `{af['accession']}`\n"
                    f"Mean pLDDT score: **{af['mean_confidence']}%** ({tier_label})",
                    msg_type="tool_result",
                    tool_data=af,
                )
            else:
                pi(f"No AlphaFold entry found for **{prot['name']}** in reviewed human proteome.")

        # ── 3. Hypothesis Agent ────────────────────────────────────────────────
        hyp("Analyzing entity co-occurrence patterns and structural data to generate testable mechanistic hypotheses...")

        hyp_result = await hypothesis_agent.generate(query, entities, session["alphafold_results"])
        hypotheses: List[dict] = hyp_result.get("hypotheses", [])
        session["hypotheses"] = [h.get("hypothesis", "") for h in hypotheses]

        for i, h in enumerate(hypotheses):
            pct = int(h.get("confidence", 0.65) * 100)
            hyp(
                f"**Hypothesis {i + 1}:** {h.get('hypothesis', '')}\n\n"
                f"**Mechanism:** {h.get('mechanism', '')}\n\n"
                f"**Experimental approach:** {h.get('experimental_approach', 'TBD')}\n"
                f"Confidence: {pct}% · Testability: {h.get('testability', 'medium')}"
            )

        unknowns = hyp_result.get("key_unknowns", [])
        if unknowns:
            hyp(f"Key unknowns flagged for follow-up: *{', '.join(unknowns)}*")

        # ── 4. Critic Agent ────────────────────────────────────────────────────
        crit("Initiating adversarial peer review. Checking for confounders, missing evidence, and unsupported causal claims...")

        critique = await critic_agent.review(query, hypotheses)
        session["critique"] = critique.get("overall_verdict", "")

        assessment = critique.get("assessment", "moderate").upper()
        score = int(critique.get("confidence_score", 0.7) * 100)
        crit(
            f"**Assessment: {assessment}** · Confidence score: {score}%\n\n"
            f"{critique.get('overall_verdict', '')}"
        )
        for c in critique.get("critiques", [])[:3]:
            sev = c.get("severity", "medium").upper()
            crit(f"[{sev}] *{c.get('issue', '')}* → {c.get('suggestion', '')}")

        missing = critique.get("missing_evidence", [])
        if missing:
            crit(f"Missing evidence: {', '.join(missing)}")

        # ── 5. PI: synthesize ──────────────────────────────────────────────────
        pi("All agents have reported. Synthesizing findings into final research brief...")

        summary = await pi_agent.synthesize(
            query, entities, hypotheses, critique, session["alphafold_results"]
        )
        session["final_summary"] = summary

        pi(f"**Research Brief**\n\n{summary}", msg_type="final")

        session["status"] = "completed"
        session["completed_at"] = _now()

    except Exception as exc:
        logger.exception("[Lab %s] Orchestration failed: %s", session_id, exc)
        _add_message(
            session, "PI Agent", "orchestrator", "#0F766E",
            f"Session error: {exc}", "error"
        )
        session["status"] = "failed"
        session["completed_at"] = _now()
