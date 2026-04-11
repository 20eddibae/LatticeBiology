"""
Celery application instance.

REDIS_URL must be set to enable Celery. When it is not set (or the celery
package is missing), _CELERY_ENABLED stays False and the API falls back to
FastAPI BackgroundTasks automatically — no code changes required.

Production usage:
    REDIS_URL=redis://localhost:6379/0
    celery -A celery_app.celery_app worker --loglevel=info --concurrency=2
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

REDIS_URL: str = os.getenv("REDIS_URL", "")
_CELERY_ENABLED: bool = False
celery_app = None

if REDIS_URL:
    try:
        from celery import Celery  # type: ignore

        celery_app = Celery(
            "biostream",
            broker=REDIS_URL,
            backend=REDIS_URL,
            include=["tasks"],
        )
        celery_app.conf.update(
            task_serializer="json",
            accept_content=["json"],
            result_serializer="json",
            timezone="UTC",
            enable_utc=True,
            task_track_started=True,
            task_acks_late=True,            # re-queue on worker crash mid-task
            worker_prefetch_multiplier=1,   # one task at a time (LLM inference is heavy)
        )
        _CELERY_ENABLED = True
        logger.info("Celery enabled — broker: %s", REDIS_URL)
    except ImportError:
        logger.warning("celery package not installed — falling back to BackgroundTasks")
else:
    logger.info("REDIS_URL not set — Celery disabled, using BackgroundTasks")
