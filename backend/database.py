"""
SQLAlchemy async database layer.

DATABASE_URL defaults to a local SQLite file so the app runs with no external services.
For production Postgres, set:
    DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/biostream
"""
from __future__ import annotations

import logging
import os
from typing import Any, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./biostream.db")
_DB_ENABLED: bool = True

try:
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
    AsyncSessionLocal: async_sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
except Exception as _exc:
    logger.error("Failed to create DB engine (%s) — DB layer disabled", _exc)
    _DB_ENABLED = False
    engine = None  # type: ignore[assignment]
    AsyncSessionLocal = None  # type: ignore[assignment]


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables on startup (idempotent). No-op when DB is disabled."""
    if not _DB_ENABLED:
        return
    from . import db_models  # noqa: F401 — registers ORM classes with Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    safe_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    logger.info("Database tables ready (%s)", safe_url)


# ---------------------------------------------------------------------------
# Pydantic → ORM conversion
# ---------------------------------------------------------------------------

def _study_to_row(study: Any) -> Any:
    from . import db_models
    d = study.model_dump(mode="json")
    return db_models.StudyRow(
        accession=d["accession"],
        title=d["title"],
        release_date=d.get("release_date", ""),
        abstract=d.get("abstract"),
        hypothesis=d.get("hypothesis"),
        primary_target=d.get("primary_target"),
        confidence_score=d.get("confidence_score", 0.0),
        s3_key=d.get("s3_key"),
        processing_status=d.get("processing_status", "complete"),
        authors=d.get("authors", []),
        links=d.get("links", []),
        entities=d.get("entities", []),
    )


def _row_to_study(row: Any) -> Any:
    from .models import Study
    return Study(
        accession=row.accession,
        title=row.title,
        release_date=row.release_date or "",
        abstract=row.abstract,
        hypothesis=row.hypothesis,
        primary_target=row.primary_target,
        confidence_score=row.confidence_score or 0.0,
        s3_key=row.s3_key,
        processing_status=row.processing_status or "complete",
        authors=row.authors or [],
        links=row.links or [],
        entities=row.entities or [],
    )


def _row_to_run(row: Any) -> Any:
    from .models import PipelineRun
    return PipelineRun(
        run_id=row.run_id,
        triggered_at=row.triggered_at,
        studies_processed=row.studies_processed or 0,
        duration_seconds=row.duration_seconds or 0.0,
        status=row.status or "pending",
        logs=row.logs,
    )


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------

async def save_study(session: AsyncSession, study: Any) -> None:
    """Upsert a Study — insert on first save, update fields on subsequent saves."""
    from . import db_models
    d = study.model_dump(mode="json")
    row = await session.get(db_models.StudyRow, study.accession)
    if row is None:
        session.add(_study_to_row(study))
    else:
        row.title = d["title"]
        row.release_date = d.get("release_date", "")
        row.abstract = d.get("abstract")
        row.hypothesis = d.get("hypothesis")
        row.primary_target = d.get("primary_target")
        row.confidence_score = d.get("confidence_score", 0.0)
        row.s3_key = d.get("s3_key")
        row.processing_status = d.get("processing_status", "complete")
        row.authors = d.get("authors", [])
        row.links = d.get("links", [])
        row.entities = d.get("entities", [])
    await session.commit()


async def get_study_from_db(session: AsyncSession, accession: str) -> Optional[Any]:
    from . import db_models
    row = await session.get(db_models.StudyRow, accession)
    return _row_to_study(row) if row else None


async def get_all_studies_from_db(session: AsyncSession) -> List[Any]:
    from . import db_models
    result = await session.execute(select(db_models.StudyRow))
    return [_row_to_study(row) for row in result.scalars().all()]


async def save_run(session: AsyncSession, run: Any) -> None:
    """Upsert a PipelineRun."""
    from . import db_models
    d = run.model_dump(mode="json")
    row = await session.get(db_models.PipelineRunRow, run.run_id)
    if row is None:
        session.add(db_models.PipelineRunRow(
            run_id=d["run_id"],
            triggered_at=d["triggered_at"],
            studies_processed=d.get("studies_processed", 0),
            duration_seconds=d.get("duration_seconds", 0.0),
            status=d.get("status", "pending"),
            logs=d.get("logs"),
        ))
    else:
        row.studies_processed = d.get("studies_processed", 0)
        row.duration_seconds = d.get("duration_seconds", 0.0)
        row.status = d.get("status", "pending")
        row.logs = d.get("logs")
    await session.commit()


async def get_run_from_db(session: AsyncSession, run_id: str) -> Optional[Any]:
    from . import db_models
    row = await session.get(db_models.PipelineRunRow, run_id)
    return _row_to_run(row) if row else None


async def get_all_runs_from_db(session: AsyncSession) -> List[Any]:
    from . import db_models
    result = await session.execute(
        select(db_models.PipelineRunRow).order_by(desc(db_models.PipelineRunRow.triggered_at))
    )
    return [_row_to_run(row) for row in result.scalars().all()]
