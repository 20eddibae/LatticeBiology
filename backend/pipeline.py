"""
DataPipeline orchestrator — simulates AWS Glue + Step Functions.
Singleton instance `pipeline` is imported by main.py and Celery tasks.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from ai_processor import BioStreamProcessor
from biostudies import fetch_study, search_studies
from database import (
    AsyncSessionLocal,
    _DB_ENABLED,
    get_all_runs_from_db,
    get_all_studies_from_db,
    save_run,
    save_study,
)
from mock_data import ALL_STUDIES, STUDIES_BY_ACCESSION
from models import (
    AnnotatedText,
    PipelineRun,
    PipelineStage,
    PipelineStatus,
    Study,
)

logger = logging.getLogger(__name__)

_processor = BioStreamProcessor()


class DataPipeline:
    """Orchestrates ingestion, processing, and persistence of biomedical studies."""

    def __init__(self) -> None:
        # In-memory cache — populated from DB on startup, updated on each ingestion
        self.studies_cache: Dict[str, Study] = {}
        # In-memory run list for the API process (Celery workers write to DB only)
        self.runs: List[PipelineRun] = []
        self.ingestion_history: List[int] = []

    # ------------------------------------------------------------------
    # DB bootstrap helpers
    # ------------------------------------------------------------------

    async def load_from_db(self) -> int:
        """
        Populate the in-memory cache from the database.
        Called on startup. Returns the number of studies loaded.
        """
        if not _DB_ENABLED or AsyncSessionLocal is None:
            return 0
        async with AsyncSessionLocal() as session:
            studies = await get_all_studies_from_db(session)
        for study in studies:
            self.studies_cache[study.accession] = study
        logger.info(
            "[%s] Loaded %d studies from database",
            datetime.now(timezone.utc).isoformat(),
            len(studies),
        )
        return len(studies)

    def preload_mock_data(self) -> None:
        """Populate in-memory cache from static mock data (no DB write)."""
        for study in ALL_STUDIES:
            self.studies_cache[study.accession] = study
        logger.info(
            "[%s] Pre-loaded %d mock studies into pipeline cache",
            datetime.now(timezone.utc).isoformat(),
            len(ALL_STUDIES),
        )

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------

    async def run_ingestion(
        self, query: str = "cancer", count: int = 10, run_id: Optional[str] = None
    ) -> PipelineRun:
        """
        Full pipeline run:
        1. Fetch raw study metadata from BioStudies API.
        2. Process each study through ai_processor (entity extraction, hypothesis).
        3. Persist each study to DB + update in-memory cache.
        4. Persist the final PipelineRun record to DB.

        If run_id is provided, the method finds (or creates) the matching run
        record and updates it. This links the result back to the pending run
        the API process already created and saved before handing off to Celery.
        """
        triggered_at = datetime.now(timezone.utc).isoformat()
        start_ts = asyncio.get_event_loop().time()

        # Resolve the run record ------------------------------------------------
        if run_id:
            # Try the in-memory list first (API process path)
            run_record = next((r for r in self.runs if r.run_id == run_id), None)
            if run_record is None:
                # Celery worker (different process) — create a local working copy
                run_record = PipelineRun(
                    run_id=run_id,
                    triggered_at=triggered_at,
                    studies_processed=0,
                    duration_seconds=0.0,
                    status="running",
                )
        else:
            run_id = f"run-{uuid.uuid4().hex[:10]}"
            run_record = PipelineRun(
                run_id=run_id,
                triggered_at=triggered_at,
                studies_processed=0,
                duration_seconds=0.0,
                status="running",
            )
            self.runs.append(run_record)

        run_record.status = "running"  # type: ignore[assignment]
        logger.info(
            "[%s] Pipeline run %s started (query='%s', count=%d)",
            triggered_at, run_id, query, count,
        )

        processed = 0
        errors = 0
        log_lines: List[str] = []

        try:
            raw_studies = await search_studies(query=query, page_size=count)
            log_lines.append(f"Fetched {len(raw_studies)} raw studies from BioStudies API")

            for raw in raw_studies:
                accession = raw.get("accession", "")
                try:
                    detail = await fetch_study(accession)
                    merged = {**raw, **detail}
                    if not merged.get("abstract"):
                        merged["abstract"] = raw.get("content", "")

                    log_lines.append(f"[S3] Stored raw/studies/{accession}.json")
                    study = await _processor.process_study(merged)

                    # Update in-memory cache
                    self.studies_cache[study.accession] = study

                    # Persist to database
                    if _DB_ENABLED and AsyncSessionLocal is not None:
                        async with AsyncSessionLocal() as session:
                            await save_study(session, study)

                    processed += 1
                    log_lines.append(
                        f"Processed {accession}: {len(study.entities)} entities, "
                        f"confidence={study.confidence_score:.2f}"
                    )
                except Exception as exc:
                    errors += 1
                    log_lines.append(f"ERROR processing {accession}: {exc}")
                    logger.error(
                        "[%s] Failed to process %s: %s",
                        datetime.now(timezone.utc).isoformat(), accession, exc,
                    )

            self.ingestion_history.append(processed)
            if len(self.ingestion_history) > 12:
                self.ingestion_history = self.ingestion_history[-12:]

            duration = asyncio.get_event_loop().time() - start_ts
            final_status: str = "completed" if errors == 0 else "failed"
            log_lines.append(
                f"Completed: {processed} studies processed, {errors} errors, "
                f"duration={duration:.1f}s"
            )

            run_record.studies_processed = processed
            run_record.duration_seconds = round(duration, 2)
            run_record.status = final_status  # type: ignore[assignment]
            run_record.logs = "\n".join(log_lines[-10:])

            # Persist run result to DB
            if _DB_ENABLED and AsyncSessionLocal is not None:
                async with AsyncSessionLocal() as session:
                    await save_run(session, run_record)

            logger.info(
                "[%s] Pipeline run %s %s",
                datetime.now(timezone.utc).isoformat(), run_id, final_status,
            )
            return run_record

        except Exception as exc:
            duration = asyncio.get_event_loop().time() - start_ts
            run_record.status = "failed"  # type: ignore[assignment]
            run_record.duration_seconds = round(duration, 2)
            run_record.logs = f"Fatal error: {exc}"
            if _DB_ENABLED and AsyncSessionLocal is not None:
                async with AsyncSessionLocal() as session:
                    await save_run(session, run_record)
            logger.error(
                "[%s] Pipeline run %s crashed: %s",
                datetime.now(timezone.utc).isoformat(), run_id, exc,
            )
            return run_record

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> PipelineStatus:
        """Return current pipeline health and throughput metrics."""
        now_str = datetime.now(timezone.utc).isoformat()
        total_studies = len(self.studies_cache)
        total_entities = sum(len(s.entities) for s in self.studies_cache.values())

        history = list(self.ingestion_history)
        while len(history) < 12:
            history.insert(0, 0)
        history = history[-12:]

        last_run = self.runs[-1] if self.runs else None
        ingestion_tput = (
            round(last_run.studies_processed / max(last_run.duration_seconds, 0.1), 2)
            if last_run and last_run.duration_seconds > 0
            else 2.4
        )
        _ = ingestion_tput  # reserved for future throughput endpoint

        last_run_at = last_run.triggered_at if last_run else now_str
        is_running = any(r.status == "running" for r in self.runs)

        stages: List[PipelineStage] = [
            PipelineStage(
                id="ingest",
                label="Ingest",
                source="BioStudies API",
                status="active" if total_studies > 0 else "idle",
                records_processed=total_studies,
                last_updated=last_run_at,
            ),
            PipelineStage(
                id="store",
                label="Store",
                source="PostgreSQL" if _DB_ENABLED else "SQLite",
                status="active",
                records_processed=total_studies,
                last_updated=last_run_at,
            ),
            PipelineStage(
                id="process",
                label="Process",
                source="OpenAI NER",
                status="processing" if is_running else ("active" if total_studies > 0 else "idle"),
                records_processed=total_studies,
                last_updated=last_run_at,
            ),
            PipelineStage(
                id="index",
                label="Index",
                source="Entity DB",
                status="active" if total_entities > 0 else "idle",
                records_processed=total_entities,
                last_updated=last_run_at,
            ),
        ]

        return PipelineStatus(
            stages=stages,
            hourly_ingestion=history,
            last_run_at=last_run_at,
            is_running=is_running,
        )

    # ------------------------------------------------------------------
    # Annotated text
    # ------------------------------------------------------------------

    def get_annotated_text(self, accession: str) -> Optional[AnnotatedText]:
        """
        Return study text with character-level entity annotation offsets.
        Searches in-memory cache first, then static mock data.
        """
        study = self.studies_cache.get(accession) or STUDIES_BY_ACCESSION.get(accession)
        if study is None:
            return None

        raw_text = " ".join(filter(None, [study.title, study.abstract]))
        annotations: List[Dict] = []

        for entity in study.entities:
            search_start = 0
            name_lower = entity.text.lower()
            text_lower = raw_text.lower()
            while True:
                idx = text_lower.find(name_lower, search_start)
                if idx == -1:
                    break
                annotations.append({
                    "start": idx,
                    "end": idx + len(entity.text),
                    "entity_id": entity.id,
                    "entity_type": entity.type,
                    "entity_name": entity.text,
                })
                search_start = idx + 1

        annotations.sort(key=lambda a: a["start"])
        return AnnotatedText(raw_text=raw_text, annotations=annotations)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

pipeline = DataPipeline()
