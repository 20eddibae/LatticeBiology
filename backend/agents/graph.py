"""
LangGraph-based orchestration for the Virtual Wet Lab.

Replaces the sequential run_lab_session with a stateful graph:
  PI Analysis → AlphaFold Lookup → Hypothesis → Critic → (optional revision) → Synthesis

State is a TypedDict flowing through nodes. Each node mutates and returns state.
The frontend polls the same /api/lab/session/{id} endpoint — we push messages
into the shared session dict as nodes execute.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, TypedDict

from langgraph.graph import END, StateGraph

from .base import BaseAgent, _DEFAULT_MODEL
from .tools import lookup_alphafold

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------


class LabState(TypedDict, total=False):
    """Typed state flowing through the LangGraph."""
    # Immutable inputs
    session_id: str
    query: str
    sessions_ref: Dict[str, Dict[str, Any]]  # mutable ref to shared sessions dict

    # Accumulated by nodes
    entities: List[dict]
    analysis: Dict[str, Any]
    alphafold_results: List[dict]
    hypotheses: List[dict]
    key_unknowns: List[str]
    critique: Dict[str, Any]
    revision_count: int
    final_summary: str

    # Observability
    token_usage: Dict[str, int]  # {"pi": N, "hypothesis": N, "critic": N}


# ---------------------------------------------------------------------------
# Agent instances (reuse from orchestrator module)
# ---------------------------------------------------------------------------

from .orchestrator import pi_agent, hypothesis_agent, critic_agent  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _push_msg(
    state: LabState,
    agent_name: str,
    agent_role: str,
    agent_color: str,
    content: str,
    msg_type: str = "message",
    tool_data: Any = None,
) -> None:
    """Push a message into the live session so the frontend can poll it."""
    session = state["sessions_ref"].get(state["session_id"])
    if session is None:
        return
    session["messages"].append({
        "id": str(uuid.uuid4()),
        "agent_name": agent_name,
        "agent_role": agent_role,
        "agent_color": agent_color,
        "content": content,
        "timestamp": _now(),
        "message_type": msg_type,
        "tool_data": tool_data,
    })


def _pi(state: LabState, content: str, msg_type: str = "message", tool_data: Any = None) -> None:
    _push_msg(state, "PI Agent", "orchestrator", "#0F766E", content, msg_type, tool_data)


def _hyp(state: LabState, content: str) -> None:
    _push_msg(state, "Hypothesis Agent", "specialist", "#7C3AED", content)


def _crit(state: LabState, content: str) -> None:
    _push_msg(state, "Critic Agent", "critic", "#D97706", content)


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------


async def node_pi_analyze(state: LabState) -> LabState:
    """PI Agent: parse query into entities and primary hypothesis."""
    query = state["query"]
    _pi(state, f'Received research query: **"{query}"**\n\nParsing key entities and dispatching specialist agents...')

    analysis = await pi_agent.analyze(query)
    entities: List[dict] = analysis.get("entities", [])

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["entities_found"] = entities

    entity_str = ", ".join(f"**{e['name']}** ({e['type']})" for e in entities[:6])
    _pi(
        state,
        f"Identified {len(entities)} entities: {entity_str}\n\n"
        f"Primary hypothesis: *{analysis.get('primary_hypothesis', 'TBD')}*\n\n"
        f"Requesting AlphaFold structural predictions for proteins..."
    )

    return {
        **state,
        "entities": entities,
        "analysis": analysis,
    }


async def node_alphafold(state: LabState) -> LabState:
    """Tool node: look up protein structures via AlphaFold/UniProt API."""
    entities = state.get("entities", [])
    proteins = [e for e in entities if e.get("type") == "protein"][:2]
    af_results: List[dict] = []

    for prot in proteins:
        _pi(state, f"→ AlphaFold tool call: **{prot['name']}**", msg_type="tool_call")
        af = await lookup_alphafold(prot["name"])
        if af:
            af_results.append(af)
            tier_label = {"high": "high confidence", "medium": "medium confidence", "low": "low confidence"}.get(
                af["confidence_tier"], ""
            )
            _pi(
                state,
                f"Structure retrieved: **{prot['name']}** → UniProt `{af['accession']}`\n"
                f"Mean pLDDT score: **{af['mean_confidence']}%** ({tier_label})",
                msg_type="tool_result",
                tool_data=af,
            )
        else:
            _pi(state, f"No AlphaFold entry found for **{prot['name']}** in reviewed human proteome.")

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["alphafold_results"] = af_results

    return {**state, "alphafold_results": af_results}


async def node_hypothesis(state: LabState) -> LabState:
    """Hypothesis Agent: generate testable hypotheses from entities + structural data."""
    revision = state.get("revision_count", 0)
    if revision > 0:
        _hyp(state, f"Revising hypotheses based on critic feedback (revision {revision})...")
    else:
        _hyp(state, "Analyzing entity co-occurrence patterns and structural data to generate testable mechanistic hypotheses...")

    hyp_result = await hypothesis_agent.generate(
        state["query"],
        state.get("entities", []),
        state.get("alphafold_results", []),
    )
    hypotheses: List[dict] = hyp_result.get("hypotheses", [])

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["hypotheses"] = [h.get("hypothesis", "") for h in hypotheses]

    for i, h in enumerate(hypotheses):
        pct = int(h.get("confidence", 0.65) * 100)
        _hyp(
            state,
            f"**Hypothesis {i + 1}:** {h.get('hypothesis', '')}\n\n"
            f"**Mechanism:** {h.get('mechanism', '')}\n\n"
            f"**Experimental approach:** {h.get('experimental_approach', 'TBD')}\n"
            f"Confidence: {pct}% · Testability: {h.get('testability', 'medium')}"
        )

    unknowns = hyp_result.get("key_unknowns", [])
    if unknowns:
        _hyp(state, f"Key unknowns flagged for follow-up: *{', '.join(unknowns)}*")

    return {
        **state,
        "hypotheses": hypotheses,
        "key_unknowns": unknowns,
    }


async def node_critic(state: LabState) -> LabState:
    """Critic Agent: adversarial peer review of hypotheses."""
    _crit(state, "Initiating adversarial peer review. Checking for confounders, missing evidence, and unsupported causal claims...")

    critique = await critic_agent.review(state["query"], state.get("hypotheses", []))

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["critique"] = critique.get("overall_verdict", "")

    assessment = critique.get("assessment", "moderate").upper()
    score = int(critique.get("confidence_score", 0.7) * 100)
    _crit(
        state,
        f"**Assessment: {assessment}** · Confidence score: {score}%\n\n"
        f"{critique.get('overall_verdict', '')}"
    )
    for c in critique.get("critiques", [])[:3]:
        sev = c.get("severity", "medium").upper()
        _crit(state, f"[{sev}] *{c.get('issue', '')}* → {c.get('suggestion', '')}")

    missing = critique.get("missing_evidence", [])
    if missing:
        _crit(state, f"Missing evidence: {', '.join(missing)}")

    return {**state, "critique": critique}


async def node_synthesize(state: LabState) -> LabState:
    """PI Agent: synthesize all findings into a final research brief."""
    _pi(state, "All agents have reported. Synthesizing findings into final research brief...")

    summary = await pi_agent.synthesize(
        state["query"],
        state.get("entities", []),
        state.get("hypotheses", []),
        state.get("critique", {}),
        state.get("alphafold_results", []),
    )

    _pi(state, f"**Research Brief**\n\n{summary}", msg_type="final")

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["final_summary"] = summary
        session["status"] = "completed"
        session["completed_at"] = _now()

    return {**state, "final_summary": summary}


# ---------------------------------------------------------------------------
# Conditional edge: should critic send back for revision?
# ---------------------------------------------------------------------------


def should_revise(state: LabState) -> Literal["revise", "synthesize"]:
    """
    If the critic assessment is 'weak' AND we haven't revised yet,
    loop back to hypothesis generation. Otherwise proceed to synthesis.
    Max 1 revision to prevent infinite loops.
    """
    critique = state.get("critique", {})
    assessment = critique.get("assessment", "moderate").lower()
    revision_count = state.get("revision_count", 0)

    if assessment == "weak" and revision_count < 1:
        logger.info("[Graph] Critic flagged WEAK — triggering revision (round %d)", revision_count + 1)
        return "revise"

    return "synthesize"


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------


def build_lab_graph() -> Any:
    """Construct and compile the LangGraph state machine."""
    graph = StateGraph(LabState)

    # Add nodes
    graph.add_node("pi_analyze", node_pi_analyze)
    graph.add_node("alphafold", node_alphafold)
    graph.add_node("hypothesis", node_hypothesis)
    graph.add_node("critic", node_critic)
    graph.add_node("synthesize", node_synthesize)

    # Linear edges
    graph.add_edge("pi_analyze", "alphafold")
    graph.add_edge("alphafold", "hypothesis")
    graph.add_edge("hypothesis", "critic")

    # Conditional: critic → revise (hypothesis) or synthesize
    graph.add_conditional_edges(
        "critic",
        should_revise,
        {
            "revise": "hypothesis",
            "synthesize": "synthesize",
        },
    )

    graph.add_edge("synthesize", END)
    graph.set_entry_point("pi_analyze")

    return graph.compile()


# Module-level compiled graph
lab_graph = build_lab_graph()


# ---------------------------------------------------------------------------
# Public entry point (drop-in replacement for run_lab_session)
# ---------------------------------------------------------------------------


async def run_lab_graph(
    session_id: str,
    query: str,
    sessions: Dict[str, Dict[str, Any]],
) -> None:
    """
    Run the LangGraph-based lab pipeline. Drop-in replacement for
    the old sequential run_lab_session.
    """
    session = sessions[session_id]
    session["status"] = "running"

    initial_state: LabState = {
        "session_id": session_id,
        "query": query,
        "sessions_ref": sessions,
        "entities": [],
        "analysis": {},
        "alphafold_results": [],
        "hypotheses": [],
        "key_unknowns": [],
        "critique": {},
        "revision_count": 0,
        "final_summary": "",
        "token_usage": {},
    }

    try:
        # ainvoke runs the full graph to completion
        await lab_graph.ainvoke(initial_state)

    except Exception as exc:
        logger.exception("[Lab %s] LangGraph orchestration failed: %s", session_id, exc)
        _push_msg(
            initial_state,
            "PI Agent", "orchestrator", "#0F766E",
            f"Session error: {exc}", "error"
        )
        session["status"] = "failed"
        session["completed_at"] = _now()
