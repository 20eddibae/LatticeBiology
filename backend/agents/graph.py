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
    graph_insights: Dict[str, Any]
    hypotheses: List[dict]
    key_unknowns: List[str]
    critique: Dict[str, Any]
    docking_results: List[dict]
    validation_plan: Dict[str, Any]
    revision_count: int
    final_summary: str

    # Observability
    token_usage: Dict[str, int]


# ---------------------------------------------------------------------------
# Agent instances (reuse from orchestrator module)
# ---------------------------------------------------------------------------

from .orchestrator import pi_agent, hypothesis_agent, critic_agent, insight_agent, validation_agent  # noqa: E402


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


def _insight(state: LabState, content: str, msg_type: str = "message", tool_data: Any = None) -> None:
    _push_msg(state, "Insight Agent", "analyst", "#2563EB", content, msg_type, tool_data)


def _val(state: LabState, content: str, msg_type: str = "message", tool_data: Any = None) -> None:
    _push_msg(state, "Validation Agent", "experimentalist", "#059669", content, msg_type, tool_data)


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


async def node_insight(state: LabState) -> LabState:
    """Insight Agent: analyze the knowledge graph for patterns relevant to the query."""
    _insight(state, "Scanning knowledge graph for contradictions, underexplored pathways, and network patterns...")

    from knowledge_graph import knowledge_graph as kg

    # Extract entity names for subgraph query
    entity_names = [e["name"].upper() for e in state.get("entities", [])]

    # Gather KG data
    kg_stats = {
        "node_count": kg.node_count,
        "edge_count": kg.edge_count,
    }

    contradictions_raw = kg.find_contradictions()
    contradictions = [{"edge_a": a, "edge_b": b} for a, b in contradictions_raw]

    underexplored_raw = kg.find_underexplored(min_sources=2, max_degree=5)
    underexplored = [
        {"id": n.id, "entity_type": n.entity_type,
         "source_count": len(n.source_accessions), "degree": n.metadata.get("degree", 0)}
        for n in underexplored_raw[:10]
    ]

    # Subgraph around query entities
    if entity_names:
        sub = kg.subgraph(entity_names, depth=1)
        sub_cyto = sub.to_cytoscape_json()
        subgraph_entities = [n["data"]["id"] for n in sub_cyto["nodes"]]
    else:
        subgraph_entities = []

    _insight(
        state,
        f"Knowledge graph: **{kg_stats['node_count']}** entities, **{kg_stats['edge_count']}** relationships\n"
        f"Contradictions: **{len(contradictions)}** | Underexplored: **{len(underexplored)}**"
    )

    # LLM interpretation
    insights = await insight_agent.analyze_graph(
        state["query"], kg_stats, contradictions, underexplored, subgraph_entities,
    )

    _insight(state, f"**Graph Analysis Summary:**\n{insights.get('summary', '')}")

    for opp in insights.get("research_opportunities", [])[:3]:
        _insight(
            state,
            f"Research opportunity: **{opp.get('entity', '')}** — {opp.get('reason', '')}\n"
            f"Suggested experiment: *{opp.get('suggested_experiment', '')}*"
        )

    # Push to session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["graph_insights"] = insights

    return {**state, "graph_insights": insights}


async def node_docking(state: LabState) -> LabState:
    """Tool node: run heuristic docking predictions for compounds + targets."""
    from .docking import predict_docking

    entities = state.get("entities", [])
    compounds = [e for e in entities if e.get("type") in ("compound", "drug")][:3]
    proteins = [e for e in entities if e.get("type") == "protein"][:2]

    if not compounds or not proteins:
        _val(state, "No compound-protein pairs identified for docking prediction.")
        return {**state, "docking_results": []}

    docking_results = []
    for comp in compounds:
        for prot in proteins:
            _val(
                state,
                f"Docking prediction: **{comp['name']}** → **{prot['name']}**",
                msg_type="tool_call",
            )
            result = await predict_docking(comp["name"], prot["name"])
            docking_results.append(result)

            if result.get("status") == "predicted":
                score = result["overall_score"]
                tier = result["tier"].upper()
                _val(
                    state,
                    f"**{comp['name']}** → **{prot['name']}**: Score **{score}** ({tier})\n"
                    f"{result.get('interpretation', '')}",
                    msg_type="tool_result",
                    tool_data=result,
                )
            else:
                _val(state, f"No data available for {comp['name']}")

    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["docking_results"] = docking_results

    return {**state, "docking_results": docking_results}


async def node_validation(state: LabState) -> LabState:
    """Validation Agent: design concrete experiments to test hypotheses."""
    _val(state, "Designing experimental validation plans based on hypotheses, critique, and docking data...")

    plan = await validation_agent.design_validation(
        state["query"],
        state.get("hypotheses", []),
        state.get("entities", []),
        state.get("critique", {}),
        state.get("docking_results", []),
    )

    for vp in plan.get("validation_plans", []):
        _val(
            state,
            f"**{vp.get('experiment_name', 'Experiment')}** (Hypothesis {vp.get('hypothesis_index', '?')})\n"
            f"Assay: {vp.get('assay_type', '')}\n"
            f"Model: {vp.get('model_system', '')}\n"
            f"Readout: {vp.get('readout', '')}\n"
            f"Expected outcome: *{vp.get('expected_outcome', '')}*\n"
            f"Feasibility: {vp.get('feasibility', 'medium')} · Timeline: {vp.get('estimated_timeline', 'TBD')}"
        )

    if plan.get("overall_feasibility"):
        _val(state, f"**Overall feasibility:** {plan['overall_feasibility']}")

    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["validation_plan"] = plan

    return {**state, "validation_plan": plan}


async def node_synthesize(state: LabState) -> LabState:
    """PI Agent: synthesize all findings into a final research brief."""
    _pi(state, "All agents have reported. Synthesizing findings into final research brief...")

    # Enrich critique with graph insights and validation plan for synthesis
    enriched_critique = dict(state.get("critique", {}))
    graph_insights = state.get("graph_insights", {})
    if graph_insights.get("summary"):
        enriched_critique["graph_analysis"] = graph_insights["summary"]
    validation_plan = state.get("validation_plan", {})
    if validation_plan.get("overall_feasibility"):
        enriched_critique["validation_feasibility"] = validation_plan["overall_feasibility"]

    summary = await pi_agent.synthesize(
        state["query"],
        state.get("entities", []),
        state.get("hypotheses", []),
        enriched_critique,
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
    """
    Construct and compile the LangGraph state machine.

    Pipeline:
      pi_analyze → insight → alphafold → hypothesis → critic
        → (optional revision) → docking → validation → synthesize
    """
    graph = StateGraph(LabState)

    # Add nodes
    graph.add_node("pi_analyze", node_pi_analyze)
    graph.add_node("insight", node_insight)
    graph.add_node("alphafold", node_alphafold)
    graph.add_node("hypothesis", node_hypothesis)
    graph.add_node("critic", node_critic)
    graph.add_node("docking", node_docking)
    graph.add_node("validation", node_validation)
    graph.add_node("synthesize", node_synthesize)

    # Linear edges
    graph.add_edge("pi_analyze", "insight")
    graph.add_edge("insight", "alphafold")
    graph.add_edge("alphafold", "hypothesis")
    graph.add_edge("hypothesis", "critic")

    # Conditional: critic → revise (hypothesis) or proceed to docking
    graph.add_conditional_edges(
        "critic",
        should_revise,
        {
            "revise": "hypothesis",
            "synthesize": "docking",
        },
    )

    graph.add_edge("docking", "validation")
    graph.add_edge("validation", "synthesize")
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
        "graph_insights": {},
        "hypotheses": [],
        "key_unknowns": [],
        "critique": {},
        "docking_results": [],
        "validation_plan": {},
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
