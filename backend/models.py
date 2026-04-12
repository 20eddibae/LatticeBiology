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


class Relationship(CamelModel):
    """A relationship between two entities in a study."""
    source_entity: str  # Entity name (e.g., "EGFR")
    target_entity: str  # Entity name (e.g., "HER2")
    relationship_type: Literal[
        "activates", "inhibits", "binds_to",
        "upregulates", "downregulates", "associated_with",
    ]
    confidence: float = 0.5
    evidence_snippet: str = ""
    source_count: int = 1


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
    relationships: List[Relationship] = []
    confidence_score: float = 0.0
    s3_key: Optional[str] = None
    processing_status: Literal["pending", "processing", "complete", "error"] = "pending"
    # Deep linking to original sources
    source_url: Optional[str] = None  # EBI BioStudies URL
    pmid: Optional[str] = None  # PubMed ID, if available


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


class SLMRelationship(BaseModel):
    """A directional relationship between two entities extracted by the SLM."""
    source: str
    target: str
    type: Literal[
        "activates", "inhibits", "binds_to",
        "upregulates", "downregulates", "associated_with",
    ]
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    evidence_snippet: str = ""


class SLMExtractionResult(BaseModel):
    """Full JSON structure expected from the local SLM."""
    entities: List[SLMEntity]
    relationships: List[SLMRelationship] = []
    hypothesis: str
    primary_target: str
