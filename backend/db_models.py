"""
SQLAlchemy ORM table definitions for BioStream.

Authors, links, and entities are stored as JSON columns inside the study row.
This matches the document-like nature of the data and avoids complex joins.
"""
from __future__ import annotations

from sqlalchemy import Column, Float, Integer, String, Text
from sqlalchemy import JSON

from database import Base


class StudyRow(Base):
    __tablename__ = "studies"

    accession = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    release_date = Column(String, default="")
    abstract = Column(Text, nullable=True)
    hypothesis = Column(Text, nullable=True)
    primary_target = Column(String, nullable=True)
    confidence_score = Column(Float, default=0.0)
    s3_key = Column(String, nullable=True)
    processing_status = Column(String, default="pending")
    # Deep linking
    source_url = Column(String, nullable=True)  # EBI BioStudies or PubMed URL
    pmid = Column(String, nullable=True)  # PubMed ID
    # Nested objects stored as JSON — avoids extra join tables for a document-oriented model
    authors = Column(JSON, default=list)
    links = Column(JSON, default=list)
    entities = Column(JSON, default=list)
    relationships = Column(JSON, default=list)  # Relationship objects


class PipelineRunRow(Base):
    __tablename__ = "pipeline_runs"

    run_id = Column(String, primary_key=True, index=True)
    triggered_at = Column(String, nullable=False, index=True)
    studies_processed = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    status = Column(String, default="pending")
    logs = Column(Text, nullable=True)
