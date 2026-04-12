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

from .base import BaseAgent, _DEFAULT_MODEL, groq_chat_with_retry
from .tools import lookup_alphafold, fetch_per_residue_plddt, generate_binding_interface, generate_binding_energy_matrix, _llm_client, _MOCK_LEAD_COMPOUNDS

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
    binding_interface: Dict[str, Any]
    per_residue_plddt: Dict[str, List[dict]]  # keyed by accession
    graph_insights: Dict[str, Any]
    hypotheses: List[dict]
    key_unknowns: List[str]
    critique: Dict[str, Any]
    docking_results: List[dict]
    validation_plan: Dict[str, Any]
    lead_compounds: List[dict]
    binding_energy_matrix: Dict[str, Any]
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

    # Populate knowledge graph with extracted entities and relationships
    try:
        from ..knowledge_graph import knowledge_graph as kg, KGNode, KGEdge, RelationshipType

        # Add nodes
        entity_ids = []
        for entity in entities:
            entity_id = entity["name"].upper()
            entity_ids.append(entity_id)
            kg.add_node(KGNode(
                id=entity_id,
                entity_type=entity.get("type", "unknown"),
                metadata={"source": "query_extraction"}
            ))

        # Add inferred relationships (proteins can bind/interact)
        if len(entity_ids) >= 2:
            # Create binding relationship between proteins
            proteins = [e for e in entities if e.get("type") in ("protein", "gene")]
            if len(proteins) >= 2:
                for i, prot_a in enumerate(proteins):
                    for prot_b in proteins[i+1:]:
                        try:
                            edge = KGEdge(
                                source=prot_a["name"].upper(),
                                target=prot_b["name"].upper(),
                                relationship=RelationshipType.BINDS_TO,
                                confidence=0.7
                            )
                            kg.add_edge(edge)
                        except Exception:
                            pass  # Skip if edge can't be added
    except Exception as e:
        logger.warning("Failed to populate knowledge graph: %s", e)

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
    """Tool node: look up protein structures via AlphaFold/UniProt API, fetch per-residue pLDDT, and predict binding interface."""
    entities = state.get("entities", [])
    # Include both "protein" and "gene" entities since genes encode proteins
    proteins = [e for e in entities if e.get("type") in ("protein", "gene")][:2]
    af_results: List[dict] = []
    per_residue_plddt: Dict[str, List[dict]] = {}

    for prot in proteins:
        _pi(state, f"→ AlphaFold tool call: **{prot['name']}**", msg_type="tool_call")
        af = await lookup_alphafold(prot["name"])
        if af:
            # Fetch per-residue pLDDT from the PDB file
            pdb_url = af.get("pdb_url", "")
            if pdb_url:
                _pi(state, f"Fetching per-residue pLDDT scores for **{prot['name']}**...")
                residues = await fetch_per_residue_plddt(pdb_url)
                if residues:
                    af["per_residue_plddt"] = residues
                    per_residue_plddt[af["accession"]] = residues
                    # Recompute mean confidence from per-residue data if API returned 0
                    if af.get("mean_confidence", 0) < 1 and residues:
                        avg = sum(r["plddt_score"] for r in residues) / len(residues)
                        af["mean_confidence"] = round(avg, 1)
                        af["confidence_tier"] = (
                            "high" if avg >= 70 else
                            "medium" if avg >= 50 else "low"
                        )
                    high = sum(1 for r in residues if r["plddt_score"] >= 90)
                    med = sum(1 for r in residues if 70 <= r["plddt_score"] < 90)
                    low = sum(1 for r in residues if r["plddt_score"] < 70)
                    _pi(
                        state,
                        f"Per-residue pLDDT parsed: **{len(residues)}** residues — "
                        f"**{high}** high (≥90), **{med}** medium (70-90), **{low}** low (<70)",
                    )

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

    # Predict binding interface if we have 2 proteins
    binding_interface: Dict[str, Any] = {}
    if len(af_results) >= 2:
        prot_a = af_results[0]
        prot_b = af_results[1]
        _pi(
            state,
            f"Predicting binding interface between **{prot_a['protein_name']}** and **{prot_b['protein_name']}**...",
            msg_type="tool_call",
        )
        interface = await generate_binding_interface(
            prot_a["protein_name"],
            prot_b["protein_name"],
            gene_a=prot_a.get("gene", ""),
            gene_b=prot_b.get("gene", ""),
        )
        if interface:
            binding_interface = interface
            n_bonds = len(interface.get("hydrogen_bonds", []))
            n_res_a = len(interface.get("interface_residues_a", []))
            n_res_b = len(interface.get("interface_residues_b", []))
            _pi(
                state,
                f"Binding interface predicted: **{n_res_a + n_res_b}** interface residues, "
                f"**{n_bonds}** hydrogen bonds\n"
                f"Interface area: **{interface.get('interface_area_sq_angstrom', 0):.0f}** Å²\n"
                f"Type: {interface.get('binding_type', 'unknown')} · "
                f"Confidence: {int(interface.get('confidence', 0) * 100)}%\n\n"
                f"*{interface.get('description', '')}*",
                msg_type="tool_result",
                tool_data=interface,
            )

    # Generate binding energy matrix if we have an interface
    energy_matrix: Dict[str, Any] = {}
    if binding_interface:
        _pi(state, "Computing residue-to-residue interaction energy matrix...", msg_type="tool_call")
        matrix = await generate_binding_energy_matrix(
            binding_interface.get("protein_a", proteins[0]["name"] if proteins else ""),
            binding_interface.get("protein_b", proteins[1]["name"] if len(proteins) > 1 else ""),
            binding_interface,
        )
        if matrix:
            energy_matrix = matrix
            n_rows = len(matrix.get("rows", []))
            n_cols = len(matrix.get("cols", []))
            _pi(
                state,
                f"Energy matrix computed: **{n_rows}×{n_cols}** residue pairs\n"
                f"Unit: {matrix.get('unit', 'kcal/mol')}",
                msg_type="tool_result",
                tool_data=matrix,
            )

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["alphafold_results"] = af_results
        if binding_interface:
            session["binding_interface"] = binding_interface
        if per_residue_plddt:
            session["per_residue_plddt"] = per_residue_plddt
        if energy_matrix:
            session["binding_energy_matrix"] = energy_matrix

    return {
        **state,
        "alphafold_results": af_results,
        "binding_interface": binding_interface,
        "per_residue_plddt": per_residue_plddt,
        "binding_energy_matrix": energy_matrix,
    }


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
    """Insight Agent: analyze the knowledge graph for patterns relevant to the query.
    Also classifies protein entities into subtypes and looks up Kd for binds_to edges."""
    _insight(state, "Scanning knowledge graph for contradictions, underexplored pathways, and network patterns...")

    from ..knowledge_graph import knowledge_graph as kg, KGNode, KGEdge, RelationshipType, ProteinSubtype
    import os as _os

    entities = state.get("entities", [])
    entity_names = [e["name"].upper() for e in entities]

    # ── Classify protein subtypes via OpenAI ──
    proteins = [e for e in entities if e.get("type") == "protein"]
    if proteins and _llm_client:
        protein_names = [p["name"] for p in proteins]
        try:
            raw = await groq_chat_with_retry(
                messages=[
                    {"role": "system", "content": (
                        "Classify each protein into exactly one subtype. "
                        "Valid subtypes: transcription_factor, tumor_suppressor, "
                        "hypoxia_inducible_factor, kinase, receptor, enzyme, structural, signaling, unknown. "
                        "Return JSON: {\"classifications\": [{\"name\": \"...\", \"subtype\": \"...\"}]}"
                    )},
                    {"role": "user", "content": f"Classify these proteins: {', '.join(protein_names)}"},
                ],
                model=_os.getenv("LLM_AGENT_MODEL", "llama-3.3-70b-versatile"),
                temperature=0.0,
                max_tokens=300,
                caller="InsightSubtype",
            )
            import json
            classifications = json.loads(raw or "{}").get("classifications", [])
            for cls in classifications:
                name_upper = cls["name"].upper()
                subtype_val = cls.get("subtype", "unknown")
                # Validate subtype
                try:
                    ProteinSubtype(subtype_val)
                except ValueError:
                    subtype_val = "unknown"
                # Update the KG node if it exists
                if kg._graph.has_node(name_upper):
                    kg._graph.nodes[name_upper]["subtype"] = subtype_val
                _insight(state, f"Classified **{cls['name']}** as *{subtype_val}*")
        except Exception as exc:
            logger.warning("Protein subtype classification failed: %s", exc)

    # ── Look up Kd values for binds_to edges ──
    try:
        from ..clients.chembl import get_chembl_bioactivities
        for u, v, key, d in list(kg._graph.edges(data=True, keys=True)):
            if d.get("relationship") == "binds_to" and d.get("kd_value") is None:
                # Try to find Kd from ChEMBL bioactivities
                try:
                    activities = await get_chembl_bioactivities(u, max_results=10)
                    for act in activities:
                        if act.get("standard_type") in ("Kd", "KD", "Ki") and act.get("standard_value"):
                            d["kd_value"] = act["standard_value"]
                            _insight(state, f"Found Kd for **{u}** → **{v}**: {act['standard_value']} {act.get('standard_units', 'nM')}")
                            break
                except Exception:
                    pass
    except ImportError:
        pass

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


def _synth(state: LabState, content: str, msg_type: str = "message", tool_data: Any = None) -> None:
    _push_msg(state, "Synthesis Agent", "specialist", "#6D28D9", content, msg_type, tool_data)


async def node_compound_synthesis(state: LabState) -> LabState:
    """Synthesis node: identify lead small-molecule inhibitors using ChEMBL + PubChem."""
    import os as _os
    from ..clients.chembl import search_chembl_compounds, get_chembl_bioactivities
    from ..clients.pubchem import get_compound_properties, get_smiles_from_pubchem

    _synth(state, "Searching for lead small-molecule inhibitors targeting identified proteins...")

    entities = state.get("entities", [])
    # Include both "protein" and "gene" entities since genes encode proteins
    proteins = [e for e in entities if e.get("type") in ("protein", "gene")][:2]

    if not proteins:
        _synth(state, "No protein targets identified for compound screening.")
        return {**state, "lead_compounds": []}

    all_compounds: list[dict] = []
    for prot in proteins:
        _synth(state, f"→ ChEMBL search: inhibitors for **{prot['name']}**", msg_type="tool_call")
        try:
            hits = await search_chembl_compounds(prot["name"], max_results=5)
            for hit in hits:
                if hit.get("smiles"):
                    hit["target_protein"] = prot["name"]
                    all_compounds.append(hit)
        except Exception as exc:
            logger.warning("ChEMBL search failed for %s: %s", prot["name"], exc)

    if not all_compounds:
        _synth(state, "No compounds found in ChEMBL. Trying PubChem...")
        for prot in proteins:
            try:
                props = await get_compound_properties(f"{prot['name']} inhibitor")
                if props and props.get("smiles"):
                    props["target_protein"] = prot["name"]
                    props["chembl_id"] = ""
                    props["pref_name"] = f"{prot['name']} inhibitor"
                    props["mw_freebase"] = props.get("molecular_weight")
                    props["alogp"] = props.get("xlogp")
                    all_compounds.append(props)
            except Exception:
                pass

    # Deduplicate by SMILES and take top 3
    seen_smiles: set[str] = set()
    unique: list[dict] = []
    for c in all_compounds:
        smi = c.get("smiles", "")
        if smi and smi not in seen_smiles:
            seen_smiles.add(smi)
            unique.append(c)
    candidates = unique[:3]

    # Enrich with bioactivity data and scaffold descriptions
    lead_compounds: list[dict] = []
    for comp in candidates:
        bioactivities: list[dict] = []
        if comp.get("chembl_id"):
            try:
                bioactivities = await get_chembl_bioactivities(comp["chembl_id"], max_results=5)
            except Exception:
                pass

        # Get scaffold description via Groq with retry
        scaffold_desc = ""
        if _llm_client and comp.get("smiles"):
            try:
                scaffold_desc = await groq_chat_with_retry(
                    messages=[
                        {"role": "system", "content": "You are a medicinal chemistry expert. Respond with only a brief scaffold description."},
                        {"role": "user", "content": f"Describe the chemical scaffold of this compound in one sentence (e.g., 'dihydro-pyrazole derivative with a phenyl substituent').\nSMILES: {comp['smiles']}\nName: {comp.get('pref_name', 'unknown')}"},
                    ],
                    model=_os.getenv("LLM_AGENT_MODEL", "llama-3.3-70b-versatile"),
                    temperature=0.2,
                    max_tokens=100,
                    caller="ScaffoldDesc",
                )
                if not scaffold_desc:
                    scaffold_desc = "Scaffold analysis unavailable"
            except Exception:
                scaffold_desc = "Scaffold analysis unavailable"

        lead = {
            "name": comp.get("pref_name") or comp.get("name", "Unknown"),
            "chembl_id": comp.get("chembl_id", ""),
            "smiles": comp.get("smiles", ""),
            "molecular_weight": comp.get("mw_freebase") or comp.get("molecular_weight"),
            "logp": comp.get("alogp") or comp.get("xlogp"),
            "molecular_formula": comp.get("molecular_formula", ""),
            "scaffold_description": scaffold_desc,
            "target_protein": comp.get("target_protein", ""),
            "bioactivities": [
                {
                    "type": ba.get("standard_type", ""),
                    "value": ba.get("standard_value"),
                    "units": ba.get("standard_units", ""),
                    "target": ba.get("target_pref_name", ""),
                    "pchembl": ba.get("pchembl_value"),
                }
                for ba in bioactivities[:3]
            ],
        }
        lead_compounds.append(lead)

        mw = lead.get("molecular_weight")
        try:
            mw_str = f"{float(mw):.1f}" if mw is not None and mw != "N/A" else "N/A"
        except (ValueError, TypeError):
            mw_str = str(mw) if mw else "N/A"

        logp = lead.get("logp")
        try:
            logp_str = f"{float(logp):.2f}" if logp is not None and logp != "N/A" else "N/A"
        except (ValueError, TypeError):
            logp_str = str(logp) if logp else "N/A"
        _synth(
            state,
            f"**Lead compound: {lead['name']}**\n"
            f"SMILES: `{lead['smiles'][:60]}{'...' if len(lead['smiles']) > 60 else ''}`\n"
            f"MW: {mw_str} · LogP: {logp_str}\n"
            f"Scaffold: *{scaffold_desc}*\n"
            f"Target: {lead['target_protein']} · Bioactivities: {len(lead['bioactivities'])}",
            msg_type="tool_result",
            tool_data=lead,
        )

    # Fallback: use mock compounds if none found
    if not lead_compounds:
        _synth(state, "Using demo compounds for visualization...")
        lead_compounds = list(_MOCK_LEAD_COMPOUNDS)
        for comp in lead_compounds:
            _synth(
                state,
                f"**Lead compound: {comp['name']}**\n"
                f"SMILES: `{comp['smiles'][:60]}{'...' if len(comp['smiles']) > 60 else ''}`\n"
                f"MW: {comp.get('molecular_weight', 'N/A')} · LogP: {comp.get('logp', 'N/A')}\n"
                f"Scaffold: *{comp.get('scaffold_description', 'N/A')}*",
                msg_type="tool_result",
                tool_data=comp,
            )

    _synth(state, f"Identified **{len(lead_compounds)}** lead compounds for further investigation.")

    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["lead_compounds"] = lead_compounds

    return {**state, "lead_compounds": lead_compounds}


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

    # Assemble consolidated visualization_data payload
    visualization_data: Dict[str, Any] = {
        "molecule_viewer": {
            "alphafold_results": state.get("alphafold_results", []),
            "per_residue_plddt": state.get("per_residue_plddt", {}),
            "binding_interface": state.get("binding_interface", {}),
        },
        "binding_heatmap": state.get("binding_energy_matrix", {}),
        "smiles_compounds": state.get("lead_compounds", []),
        "telemetry": {
            "per_residue_plddt": state.get("per_residue_plddt", {}),
            "docking_results": state.get("docking_results", []),
        },
    }

    # Push to live session
    session = state["sessions_ref"].get(state["session_id"])
    if session:
        session["final_summary"] = summary
        session["visualization_data"] = visualization_data
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
        → (optional revision) → docking → validation → compound_synthesis → synthesize
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
    graph.add_node("compound_synthesis", node_compound_synthesis)
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
    graph.add_edge("validation", "compound_synthesis")
    graph.add_edge("compound_synthesis", "synthesize")
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
        "binding_interface": {},
        "per_residue_plddt": {},
        "graph_insights": {},
        "hypotheses": [],
        "key_unknowns": [],
        "critique": {},
        "docking_results": [],
        "validation_plan": {},
        "lead_compounds": [],
        "binding_energy_matrix": {},
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
