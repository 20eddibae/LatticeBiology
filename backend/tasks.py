"""
Celery tasks for BioStream.

Celery workers are synchronous; async pipeline logic is wrapped with asyncio.run().
This is the standard production pattern for FastAPI + Celery stacks.

Start a worker:
    celery -A celery_app.celery_app worker --loglevel=info --concurrency=2
"""
from __future__ import annotations

import asyncio
import logging

from .celery_app import _CELERY_ENABLED, celery_app

logger = logging.getLogger(__name__)


def _register_tasks() -> None:
    """Register Celery tasks only when the broker is configured."""
    if not _CELERY_ENABLED or celery_app is None:
        return

    @celery_app.task(name="tasks.run_ingestion", bind=True, max_retries=2)
    def run_ingestion_task(self, query: str, count: int, run_id: str) -> dict:
        """
        Execute one ingestion pipeline run inside a Celery worker process.
        The run_id links this task back to the pending PipelineRun already
        saved to the database by the API process.
        """
        async def _execute() -> None:
            from pipeline import pipeline  # local import — different worker process
            await pipeline.run_ingestion(query=query, count=count, run_id=run_id)

        try:
            asyncio.run(_execute())
            return {"status": "completed", "run_id": run_id}
        except Exception as exc:
            logger.error("run_ingestion_task failed (run_id=%s): %s", run_id, exc)
            raise self.retry(exc=exc, countdown=10)

    # Attach to module scope so callers can do `from tasks import run_ingestion_task`
    globals()["run_ingestion_task"] = run_ingestion_task


_register_tasks()


def run_ingestion_task(query: str, count: int, run_id: str) -> None:  # type: ignore[misc]
    """
    Stub used when Celery is disabled.
    The real task replaces this via _register_tasks() when REDIS_URL is set.
    """
    raise RuntimeError("Celery is not configured — set REDIS_URL to enable task queue")
