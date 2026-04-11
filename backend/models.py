from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class Author(CamelModel):
    name: str
    affiliation: Optional[str] = None


class Link(CamelModel):
    url: str
    type: str
    description: Optional[str] = None


class Entity(CamelModel):
    id: str
    text: str
    type: Literal["protein", "gene", "compound", "disease", "pathway"]
    confidence: float
    mentions: int
    source_text: str = ""
    source: Optional[str] = None
    description: Optional[str] = None
    flagged: bool = False
    metadata: Dict[str, Any] = {}


class Study(CamelModel):
    accession: str
    title: str
    release_date: str
    authors: List[Author] = []
    links: List[Link] = []
    abstract: Optional[str] = None
    hypothesis: Optional[str] = None
    primary_target: Optional[str] = None
    entities: List[Entity] = []
    confidence_score: float = 0.0
    s3_key: Optional[str] = None
    processing_status: Literal["pending", "processing", "complete", "error"] = "pending"


class PipelineStage(CamelModel):
    id: str
    label: str
    source: str
    status: Literal["active", "processing", "idle", "error"]
    records_processed: int
    last_updated: str


class PipelineStatus(CamelModel):
    stages: List[PipelineStage]
    hourly_ingestion: List[int]
    last_run_at: str
    is_running: bool


class PipelineRun(CamelModel):
    run_id: str
    triggered_at: str
    studies_processed: int
    duration_seconds: float
    status: Literal["pending", "running", "completed", "failed"]
    logs: Optional[str] = None


class AnnotatedText(CamelModel):
    raw_text: str
    annotations: List[Dict]


# ---------------------------------------------------------------------------
# SLM (Ollama) response schema
# ---------------------------------------------------------------------------

class SLMEntity(BaseModel):
    """Single entity returned by the local SLM."""
    name: str
    type: Literal["Disease", "Gene", "Protein", "Drug", "Pathway"]
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)


class SLMExtractionResult(BaseModel):
    """Full JSON structure expected from the local SLM."""
    entities: List[SLMEntity]
    hypothesis: str
    primary_target: str
