"""
BioStream FastAPI application entry point.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

import pathlib as _pathlib
# Load .env from project root (one level up from backend/)
_project_root = _pathlib.Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")
load_dotenv()  # also check backend/.env for overrides

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger(__name__)

from celery_app import _CELERY_ENABLED  # noqa: E402
from database import (  # noqa: E402
    AsyncSessionLocal,
    _DB_ENABLED,
    get_all_runs_from_db,
    get_all_studies_from_db,
    init_db,
    save_run,
    save_study,
)
from mock_data import ALL_STUDIES, STUDIES_BY_ACCESSION  # noqa: E402
from models import AnnotatedText, PipelineRun, PipelineStatus, Study  # noqa: E402
from pipeline import pipeline  # noqa: E402
from tasks import run_ingestion_task  # noqa: E402

# ---------------------------------------------------------------------------
# Lifespan — DB init + cache warm-up
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    now = datetime.now(timezone.utc).isoformat()
    logger.info("[%s] BioStream startup", now)

    # Initialise database (creates tables if they don't exist)
    await init_db()

    # Load studies from DB into in-memory cache for fast reads
    loaded = await pipeline.load_from_db()

    if loaded == 0:
        logger.info("[%s] DB empty — seeding with mock studies", now)
        pipeline.preload_mock_data()
        # Persist mock data so the next restart loads from DB instead
        if _DB_ENABLED and AsyncSessionLocal is not None:
            async with AsyncSessionLocal() as session:
                for study in ALL_STUDIES:
                    await save_study(session, study)

    logger.info(
        "[%s] Cache ready: %d studies, %d total entities | DB=%s | Celery=%s",
        datetime.now(timezone.utc).isoformat(),
        len(pipeline.studies_cache),
        sum(len(s.entities) for s in pipeline.studies_cache.values()),
        _DB_ENABLED,
        _CELERY_ENABLED,
    )
    yield
    logger.info("[%s] BioStream shutdown", datetime.now(timezone.utc).isoformat())


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="BioStream API",
    version="2.0.0",
    description=(
        "Biotech data intelligence platform — BioStudies API ingestion, "
        "PostgreSQL persistence, Celery task queue, and local SLM NER."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Studies endpoints
# ---------------------------------------------------------------------------


@app.get("/api/studies", response_model=List[Study], tags=["Studies"])
async def get_studies() -> List[Study]:
    """Return all studies. Reads from DB when available, falls back to in-memory cache."""
    if _DB_ENABLED and AsyncSessionLocal is not None:
        async with AsyncSessionLocal() as session:
            studies = await get_all_studies_from_db(session)
            if studies:
                return studies

    if pipeline.studies_cache:
        return list(pipeline.studies_cache.values())

    logger.info("[%s] Cache empty — returning static mock studies", datetime.now(timezone.utc).isoformat())
    return ALL_STUDIES


@app.get("/api/study/{accession}", response_model=Study, tags=["Studies"])
async def get_study(accession: str) -> Study:
    """Return a single study. Tries DB → cache → live fetch → static mock → 404."""
    # 1. In-memory cache (fastest)
    if accession in pipeline.studies_cache:
        return pipeline.studies_cache[accession]

    # 2. Database
    if _DB_ENABLED and AsyncSessionLocal is not None:
        from database import get_study_from_db
        async with AsyncSessionLocal() as session:
            study = await get_study_from_db(session, accession)
            if study:
                pipeline.studies_cache[accession] = study  # warm the cache
                return study

    # 3. Live fetch + AI processing
    try:
        from biostudies import fetch_study
        from ai_processor import BioStreamProcessor

        raw = await fetch_study(accession)
        processor = BioStreamProcessor()
        study = await processor.process_study(raw)
        pipeline.studies_cache[study.accession] = study

        if _DB_ENABLED and AsyncSessionLocal is not None:
            async with AsyncSessionLocal() as session:
                await save_study(session, study)

        return study
    except Exception as exc:
        logger.warning("[%s] On-demand processing failed for %s: %s", datetime.now(timezone.utc).isoformat(), accession, exc)

    # 4. Static mock fallback
    if accession in STUDIES_BY_ACCESSION:
        return STUDIES_BY_ACCESSION[accession]

    raise HTTPException(status_code=404, detail=f"Study '{accession}' not found")


@app.get("/api/study/{accession}/entities", tags=["Studies"])
async def get_study_entities(accession: str) -> Dict[str, Any]:
    """Return study data with entities and annotated raw text."""
    study = await get_study(accession)

    annotated = pipeline.get_annotated_text(accession)
    raw_text = annotated.raw_text if annotated else " ".join(filter(None, [study.title, study.abstract]))

    data = study.model_dump(by_alias=True)
    data["rawText"] = raw_text
    return data


# ---------------------------------------------------------------------------
# Pipeline endpoints
# ---------------------------------------------------------------------------


async def _background_ingestion(query: str, count: int, run_id: str) -> None:
    """BackgroundTask fallback wrapper (used when Celery is not configured)."""
    try:
        await pipeline.run_ingestion(query=query, count=count, run_id=run_id)
    except Exception as exc:
        logger.error("[%s] Background ingestion error: %s", datetime.now(timezone.utc).isoformat(), exc)


@app.post("/api/pipeline/run", response_model=PipelineRun, tags=["Pipeline"])
async def trigger_pipeline_run(
    background_tasks: BackgroundTasks,
    query: str = "cancer",
    count: int = 10,
) -> PipelineRun:
    """
    Trigger a new ingestion pipeline run. Returns a pending PipelineRun immediately.

    When Celery is configured (REDIS_URL set), the job is handed to a worker
    process. Otherwise, FastAPI BackgroundTasks handles it in-process.
    Poll /api/pipeline/runs to observe status transitions.
    """
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    pending_run = PipelineRun(
        run_id=run_id,
        triggered_at=now,
        studies_processed=0,
        duration_seconds=0.0,
        status="pending",
        logs=f"Queued for query='{query}', count={count}",
    )

    # Persist the pending run to DB immediately (Celery workers need it there)
    if _DB_ENABLED and AsyncSessionLocal is not None:
        async with AsyncSessionLocal() as session:
            await save_run(session, pending_run)

    # Also keep it in the API process's in-memory list
    pipeline.runs.append(pending_run)

    # Dispatch to Celery or BackgroundTasks
    if _CELERY_ENABLED and run_ingestion_task is not None:
        run_ingestion_task.delay(query=query, count=count, run_id=run_id)
        logger.info("[%s] Celery task queued for run %s", now, run_id)
    else:
        background_tasks.add_task(_background_ingestion, query, count, run_id)
        logger.info("[%s] BackgroundTask queued for run %s", now, run_id)

    return pending_run


@app.get("/api/pipeline/status", response_model=PipelineStatus, tags=["Pipeline"])
async def get_pipeline_status() -> PipelineStatus:
    """Return current pipeline health and throughput metrics."""
    return pipeline.get_status()


@app.get("/api/pipeline/runs", response_model=List[PipelineRun], tags=["Pipeline"])
async def get_pipeline_runs() -> List[PipelineRun]:
    """
    Return all recorded pipeline runs, most recent first.
    Reads from DB when available so Celery worker updates are visible to the API.
    """
    if _DB_ENABLED and AsyncSessionLocal is not None:
        async with AsyncSessionLocal() as session:
            return await get_all_runs_from_db(session)
    return list(reversed(pipeline.runs))


@app.get("/api/dashboard/metrics", tags=["Dashboard"])
async def get_dashboard_metrics() -> Dict[str, Any]:
    """Aggregated metrics for the dashboard cards."""
    studies = list(pipeline.studies_cache.values())
    total_studies = len(studies)
    total_entities = sum(len(s.entities) for s in studies)
    avg_confidence = 0.0
    if studies:
        scores = [s.confidence_score for s in studies if s.confidence_score > 0]
        avg_confidence = round(sum(scores) / len(scores) * 100, 1) if scores else 0.0

    # Uptime: percentage of completed runs out of total runs
    all_runs = pipeline.runs
    completed = sum(1 for r in all_runs if r.status == "completed")
    uptime = round(completed / len(all_runs) * 100, 1) if all_runs else 100.0

    return {
        "studies_indexed": total_studies,
        "entities_extracted": total_entities,
        "pipeline_uptime": uptime,
        "avg_confidence": avg_confidence,
    }


@app.get("/api/dashboard/trending", tags=["Dashboard"])
async def get_trending_entities() -> List[Dict[str, Any]]:
    """Top entities across all studies, ranked by occurrence count."""
    from collections import Counter
    counts: Counter[tuple[str, str]] = Counter()
    for study in pipeline.studies_cache.values():
        for e in study.entities:
            counts[(e.text, e.type)] += e.mentions

    trending = []
    for (name, etype), count in counts.most_common(12):
        trending.append({
            "name": name,
            "type": etype,
            "count": count,
        })
    return trending


@app.get("/api/pipeline/jobs", tags=["Pipeline"])
async def get_pipeline_jobs() -> List[Dict[str, Any]]:
    """Return a synthetic job queue derived from recent pipeline runs."""
    # Read runs from the same source as get_pipeline_runs for consistency
    if _DB_ENABLED and AsyncSessionLocal is not None:
        async with AsyncSessionLocal() as session:
            all_runs = await get_all_runs_from_db(session)
        recent = all_runs[:5]  # already newest-first from DB query
    else:
        recent = list(reversed(pipeline.runs[-5:]))

    job_types = ["INGEST", "NER_EXTRACT", "VECTOR_INDEX", "REPORT"]
    jobs: List[Dict[str, Any]] = []
    for i, run in enumerate(recent):
        jobs.append({
            "jobId": f"job-{run.run_id.split('-')[-1]}",
            "type": job_types[i % len(job_types)],
            "status": run.status,
            "createdAt": run.triggered_at,
            "priority": i + 1,
        })

    if not jobs:
        now = datetime.now(timezone.utc).isoformat()
        jobs = [{"jobId": "job-idle-001", "type": "INGEST", "status": "completed", "createdAt": now, "priority": 1}]

    return jobs


# ---------------------------------------------------------------------------
# Knowledge Graph endpoints
# ---------------------------------------------------------------------------

from knowledge_graph import knowledge_graph as _kg


@app.get("/api/knowledge-graph/stats", tags=["Knowledge Graph"])
async def kg_stats() -> Dict[str, Any]:
    """Return node/edge counts and top entity types."""
    from collections import Counter
    type_counts: Counter[str] = Counter()
    for _, data in _kg._graph.nodes(data=True):
        type_counts[data.get("entity_type", "unknown")] += 1

    return {
        "node_count": _kg.node_count,
        "edge_count": _kg.edge_count,
        "entity_types": dict(type_counts),
    }


@app.get("/api/knowledge-graph/subgraph", tags=["Knowledge Graph"])
async def kg_subgraph(
    nodes: str = "",
    depth: int = 1,
) -> Dict[str, Any]:
    """
    Return a Cytoscape.js-compatible subgraph around the given nodes.
    ?nodes=BRCA1,TP53&depth=2
    If nodes is empty, returns the full graph (capped at 500 nodes).
    """
    if nodes.strip():
        node_ids = [n.strip().upper() for n in nodes.split(",") if n.strip()]
        sub = _kg.subgraph(node_ids, depth=depth)
    else:
        sub = _kg  # full graph

    cyto = sub.to_cytoscape_json()

    # Safety cap for the full-graph case
    if len(cyto["nodes"]) > 500:
        cyto["nodes"] = cyto["nodes"][:500]

    return {
        "node_count": len(cyto["nodes"]),
        "edge_count": len(cyto["edges"]),
        "elements": cyto,
    }


@app.get("/api/knowledge-graph/contradictions", tags=["Knowledge Graph"])
async def kg_contradictions() -> List[Dict[str, Any]]:
    """Return pairs of edges with opposing relationships between the same entities."""
    raw = _kg.find_contradictions()
    return [{"edge_a": a, "edge_b": b} for a, b in raw]


@app.get("/api/docking/predict", tags=["Docking"])
async def docking_predict(
    compound: str = "ibuprofen",
    target: str = "COX-2",
) -> Dict[str, Any]:
    """Heuristic docking prediction for a compound-target pair."""
    from agents.docking import predict_docking
    return await predict_docking(compound, target)


@app.get("/api/docking/batch", tags=["Docking"])
async def docking_batch(
    compounds: str = "ibuprofen,aspirin",
    target: str = "COX-2",
) -> List[Dict[str, Any]]:
    """Batch docking prediction. Comma-separated compound names."""
    from agents.docking import batch_docking
    compound_list = [c.strip() for c in compounds.split(",") if c.strip()]
    return await batch_docking(compound_list, target)


@app.get("/api/knowledge-graph/ppi-network", tags=["Knowledge Graph"])
async def kg_ppi_network(
    nodes: str = "",
    depth: int = 1,
) -> Dict[str, Any]:
    """
    Return a protein-protein interaction subgraph with subtypes and Kd values.
    Filters to only protein/gene nodes and their interconnections.
    """
    if nodes.strip():
        node_ids = [n.strip().upper() for n in nodes.split(",") if n.strip()]
        sub = _kg.subgraph(node_ids, depth=depth)
    else:
        sub = _kg

    cyto = sub.to_cytoscape_json()

    # Filter to protein/gene nodes only
    protein_ids = set()
    protein_nodes = []
    for n in cyto["nodes"]:
        if n["data"].get("entity_type") in ("protein", "gene"):
            protein_ids.add(n["data"]["id"])
            protein_nodes.append(n)

    # Filter edges to only those between proteins
    ppi_edges = [
        e for e in cyto["edges"]
        if e["data"]["source"] in protein_ids and e["data"]["target"] in protein_ids
    ]

    return {
        "node_count": len(protein_nodes),
        "edge_count": len(ppi_edges),
        "elements": {"nodes": protein_nodes, "edges": ppi_edges},
    }


@app.get("/api/knowledge-graph/underexplored", tags=["Knowledge Graph"])
async def kg_underexplored(
    min_sources: int = 2,
    max_degree: int = 3,
) -> List[Dict[str, Any]]:
    """Nodes appearing in multiple studies but with few graph connections."""
    nodes = _kg.find_underexplored(min_sources=min_sources, max_degree=max_degree)
    return [
        {
            "id": n.id,
            "entity_type": n.entity_type,
            "source_count": len(n.source_accessions),
            "degree": n.metadata.get("degree", 0),
        }
        for n in nodes
    ]


# ---------------------------------------------------------------------------
# Virtual Lab endpoints (multi-agent orchestration)
# ---------------------------------------------------------------------------

# In-memory session store — fine for demo; replace with Redis/DB for prod
_lab_sessions: Dict[str, Dict[str, Any]] = {}


@app.post("/api/lab/run", tags=["Lab"])
async def start_lab_session(
    background_tasks: BackgroundTasks,
    body: Dict[str, str],
) -> Dict[str, str]:
    """
    Start a new multi-agent virtual lab session.
    Returns immediately with a session_id; poll /api/lab/session/{id} for progress.
    """
    from agents.graph import run_lab_graph  # LangGraph-based orchestration

    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=422, detail="query is required")

    session_id = f"lab-{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    _lab_sessions[session_id] = {
        "session_id": session_id,
        "query": query,
        "status": "pending",
        "messages": [],
        "entities_found": [],
        "alphafold_results": [],
        "binding_interface": {},
        "per_residue_plddt": {},
        "lead_compounds": [],
        "binding_energy_matrix": {},
        "graph_insights": {},
        "hypotheses": [],
        "critique": "",
        "docking_results": [],
        "validation_plan": {},
        "visualization_data": {},
        "final_summary": "",
        "created_at": now,
        "completed_at": None,
    }

    background_tasks.add_task(run_lab_graph, session_id, query, _lab_sessions)
    logger.info("[%s] Lab session %s started for query: %s", now, session_id, query)
    return {"session_id": session_id}


@app.get("/api/lab/session/{session_id}", tags=["Lab"])
async def get_lab_session(session_id: str) -> Dict[str, Any]:
    """Return the current state of a lab session (poll until status=completed|failed)."""
    if session_id not in _lab_sessions:
        raise HTTPException(status_code=404, detail=f"Lab session '{session_id}' not found")
    return _lab_sessions[session_id]


@app.get("/api/lab/session/{session_id}/visualizations", tags=["Lab"])
async def get_lab_visualizations(session_id: str) -> Dict[str, Any]:
    """Return the consolidated visualization payload for a completed lab session."""
    if session_id not in _lab_sessions:
        raise HTTPException(status_code=404, detail=f"Lab session '{session_id}' not found")

    session = _lab_sessions[session_id]
    return session.get("visualization_data", {
        "molecule_viewer": {
            "alphafold_results": session.get("alphafold_results", []),
            "per_residue_plddt": session.get("per_residue_plddt", {}),
            "binding_interface": session.get("binding_interface", {}),
        },
        "binding_heatmap": session.get("binding_energy_matrix", {}),
        "smiles_compounds": session.get("lead_compounds", []),
        "telemetry": {
            "per_residue_plddt": session.get("per_residue_plddt", {}),
            "docking_results": session.get("docking_results", []),
        },
    })


@app.get("/api/lab/sessions", tags=["Lab"])
async def list_lab_sessions() -> List[Dict[str, Any]]:
    """Return all lab sessions, most recent first."""
    sessions = list(_lab_sessions.values())
    sessions.sort(key=lambda s: s["created_at"], reverse=True)
    return sessions


@app.get("/api/lab/session/{session_id}/stream", tags=["Lab"])
async def stream_lab_session(session_id: str, request: Request):
    """
    SSE stream for a lab session. Yields new agent messages as they appear.
    Events: 'message' (new agent message), 'status' (session status change),
    'done' (session completed/failed).
    """
    if session_id not in _lab_sessions:
        raise HTTPException(status_code=404, detail=f"Lab session '{session_id}' not found")

    async def event_generator():
        seen = 0
        last_status = None
        import asyncio as _asyncio

        while True:
            if await request.is_disconnected():
                break

            session = _lab_sessions.get(session_id)
            if session is None:
                break

            current_status = session["status"]

            # Emit new messages
            messages = session.get("messages", [])
            if len(messages) > seen:
                for msg in messages[seen:]:
                    yield {
                        "event": "message",
                        "data": json.dumps(msg),
                    }
                seen = len(messages)

            # Emit status changes
            if current_status != last_status:
                yield {
                    "event": "status",
                    "data": json.dumps({
                        "status": current_status,
                        "entities_found": session.get("entities_found", []),
                        "alphafold_results": session.get("alphafold_results", []),
                        "per_residue_plddt": session.get("per_residue_plddt", {}),
                        "binding_interface": session.get("binding_interface", {}),
                        "binding_energy_matrix": session.get("binding_energy_matrix", {}),
                        "lead_compounds": session.get("lead_compounds", []),
                        "graph_insights": session.get("graph_insights", {}),
                        "hypotheses": session.get("hypotheses", []),
                        "critique": session.get("critique", ""),
                        "docking_results": session.get("docking_results", []),
                        "validation_plan": session.get("validation_plan", {}),
                        "final_summary": session.get("final_summary", ""),
                    }),
                }
                last_status = current_status

            # Done — send final snapshot and close
            if current_status in ("completed", "failed"):
                yield {
                    "event": "done",
                    "data": json.dumps(session),
                }
                break

            await _asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["Meta"])
async def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cache_size": len(pipeline.studies_cache),
        "db_enabled": _DB_ENABLED,
        "celery_enabled": _CELERY_ENABLED,
    }


# ---------------------------------------------------------------------------
# Development entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
