from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .models import Author, Entity, Link, SLMEntity, SLMExtractionResult, SLMRelationship, Study

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI configuration (primary) + Ollama fallback
# ---------------------------------------------------------------------------

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = os.getenv("OPENAI_NER_MODEL", "gpt-4o-mini")

_openai_client: Optional[Any] = None
if _OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=_OPENAI_API_KEY)
        logger.info("OpenAI client initialised for NER (model=%s)", _OPENAI_MODEL)
    except ImportError:
        logger.warning("openai library not installed — will try Ollama fallback")

# Ollama fallback
_OLLAMA_AVAILABLE = False
if _openai_client is None:
    try:
        import ollama  # type: ignore
        _OLLAMA_AVAILABLE = True
    except ImportError:
        pass

_DEFAULT_MODEL = "llama3.2:3b"
_OLLAMA_HOST = "http://localhost:11434"

_SYSTEM_PROMPT = """\
You are a biomedical Named Entity Recognition (NER) and Relation Extraction expert.
Extract structured information from the biomedical study text provided.

Respond with ONLY valid JSON — no markdown, no code blocks, no explanation.
Use this exact schema:

{
  "entities": [
    {
      "name": "<entity name exactly as it appears in the text>",
      "type": "<exactly one of: Disease, Gene, Protein, Drug, Pathway>",
      "confidence_score": <float 0.0-1.0>
    }
  ],
  "relationships": [
    {
      "source": "<source entity name>",
      "target": "<target entity name>",
      "type": "<exactly one of: activates, inhibits, binds_to, upregulates, downregulates, associated_with>",
      "confidence": <float 0.0-1.0>,
      "evidence_snippet": "<short phrase from the text supporting this relationship>"
    }
  ],
  "hypothesis": "<1-2 sentence summary of the study's primary biological mechanism>",
  "primary_target": "<the main gene or protein investigated in the study>"
}

Rules:
- Only include entities explicitly present in the text.
- Each entity's type MUST be one of: Disease, Gene, Protein, Drug, Pathway.
- confidence_score must be a number between 0.0 and 1.0.
- Deduplicate — do not list the same entity twice.
- For relationships: source and target MUST match entity names listed in the entities array.
- Only include relationships supported by the text — do not infer beyond what is stated.
- Relationship type meanings: activates (increases activity), inhibits (decreases activity/blocks), binds_to (physical binding), upregulates (increases expression), downregulates (decreases expression), associated_with (general association).
- Output raw JSON only. No prose, no markdown fences.\
"""

# SLM entity type -> internal Entity.type Literal
_TYPE_MAP: Dict[str, str] = {
    "disease": "disease",
    "gene": "gene",
    "protein": "protein",
    "drug": "compound",   # maps to existing internal type
    "pathway": "pathway",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_snippet(text: str, name: str, window: int = 80) -> str:
    """Return a text snippet centred on the first occurrence of *name*."""
    idx = text.lower().find(name.lower())
    if idx == -1:
        return text[:window].strip()
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(name) + window // 2)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "\u2026" + snippet
    if end < len(text):
        snippet = snippet + "\u2026"
    return snippet


def _deduplicate_entities(entities: List[Entity]) -> List[Entity]:
    """Merge entities with the same normalised name."""
    seen: Dict[str, Entity] = {}
    for ent in entities:
        key = ent.text.upper()
        if key in seen:
            existing = seen[key]
            existing.mentions += ent.mentions
            if ent.confidence > existing.confidence:
                existing.confidence = ent.confidence
        else:
            seen[key] = ent
    return list(seen.values())


def _extract_json_from_text(raw: str) -> str:
    """
    Best-effort extraction of a JSON object from raw SLM output.
    Handles markdown code fences and leading/trailing prose.
    """
    # Strip markdown fences like ```json ... ```
    raw = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

    # Isolate first '{' … last '}' block
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        return raw[start : end + 1]

    return raw


# ---------------------------------------------------------------------------
# Processor
# ---------------------------------------------------------------------------

class BioStreamProcessor:
    """
    Biomedical NER pipeline backed by OpenAI API (primary) with Ollama fallback.
    Falls back to an empty extraction when neither is available.
    """

    def __init__(self, model: str = _DEFAULT_MODEL) -> None:
        self._model = model
        self._openai = _openai_client
        self._ollama_client: Optional[Any] = None

        if self._openai:
            logger.info(
                "[%s] BioStreamProcessor using OpenAI (model=%s)",
                datetime.utcnow().isoformat(),
                _OPENAI_MODEL,
            )
        elif _OLLAMA_AVAILABLE:
            import ollama
            self._ollama_client = ollama.AsyncClient(host=_OLLAMA_HOST)
            logger.info(
                "[%s] BioStreamProcessor using Ollama fallback (model=%s)",
                datetime.utcnow().isoformat(),
                self._model,
            )
        else:
            logger.warning(
                "[%s] No LLM backend available — extraction will return empty results",
                datetime.utcnow().isoformat(),
            )

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def process_study(self, study_raw: dict) -> Study:
        """Full processing pipeline for one study."""
        accession: str = study_raw.get("accession", f"UNKNOWN-{uuid.uuid4().hex[:6]}")
        logger.info("[%s] Processing study %s", datetime.utcnow().isoformat(), accession)

        # 1. Parse basic metadata
        authors: List[Author] = []
        for a in study_raw.get("author", []):
            try:
                authors.append(
                    Author(name=a.get("name", "Unknown"), affiliation=a.get("affiliation"))
                )
            except Exception:
                pass

        links: List[Link] = []
        for lnk in study_raw.get("links", []):
            try:
                links.append(
                    Link(
                        url=lnk.get("url", ""),
                        type=lnk.get("type", "url"),
                        description=lnk.get("description"),
                    )
                )
            except Exception:
                pass

        title: str = study_raw.get("title", "Untitled")
        abstract: Optional[str] = study_raw.get("abstract") or study_raw.get("content")
        release_date: str = study_raw.get("releaseDate", "") or study_raw.get("release_date", "")

        s3_key = f"raw/studies/{accession}.json"
        corpus = " ".join(filter(None, [title, abstract]))

        # 2. Single LLM call — entities + hypothesis + primary_target in one shot
        extraction = await self._llm_extract(title, abstract or "")

        # 3. Build internal Entity objects (with text-offset snippets)
        entities = self._build_entities(extraction.entities, corpus)

        # 4. Assemble Study
        study = Study(
            accession=accession,
            title=title,
            release_date=release_date,
            authors=authors,
            links=links,
            abstract=abstract,
            hypothesis=extraction.hypothesis,
            primary_target=extraction.primary_target,
            entities=entities,
            s3_key=s3_key,
            processing_status="processing",
        )

        # 5. Validation layer — flag entities absent from title/links
        metadata = {"title": title, "links": [lnk.url for lnk in links]}
        study.entities = self.validate_entities(study.entities, metadata)

        # 6. Overall confidence score
        study.confidence_score = self.calculate_confidence(study)
        study.processing_status = "complete"

        # 7. Ingest entities + relationships into knowledge graph
        self._ingest_to_graph(study, extraction)

        logger.info(
            "[%s] Study %s processed — %d entities, %d relationships, confidence=%.2f",
            datetime.utcnow().isoformat(),
            accession,
            len(study.entities),
            len(extraction.relationships),
            study.confidence_score,
        )
        return study

    # ------------------------------------------------------------------
    # LLM extraction (OpenAI primary, Ollama fallback)
    # ------------------------------------------------------------------

    async def _llm_extract(self, title: str, abstract: str) -> SLMExtractionResult:
        """
        Send title + abstract to OpenAI (primary) or Ollama (fallback).
        Returns a validated SLMExtractionResult. Empty result on any failure.
        """
        user_message = f"Title: {title}\n\nAbstract: {abstract}"
        truncated = user_message[:3000]

        # ── OpenAI path (primary) ──────────────────────────────────────
        if self._openai:
            try:
                response = await self._openai.chat.completions.create(
                    model=_OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": truncated},
                    ],
                    temperature=0,
                    max_tokens=1024,
                )
                raw_content = response.choices[0].message.content or ""
                return self._parse_slm_response(raw_content, title)
            except Exception as exc:
                logger.error(
                    "[%s] OpenAI NER request failed: %s",
                    datetime.utcnow().isoformat(),
                    exc,
                )
                # Fall through to Ollama if available

        # ── Ollama fallback ────────────────────────────────────────────
        if self._ollama_client:
            try:
                response = await self._ollama_client.chat(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": truncated},
                    ],
                    options={"temperature": 0},
                )
                try:
                    raw_content = response.message.content
                except AttributeError:
                    raw_content = response["message"]["content"]
                return self._parse_slm_response(raw_content, title)
            except Exception as exc:
                logger.error(
                    "[%s] Ollama NER request failed: %s",
                    datetime.utcnow().isoformat(),
                    exc,
                )

        logger.warning(
            "[%s] No LLM backend available — returning empty extraction",
            datetime.utcnow().isoformat(),
        )
        return self._empty_extraction(title)

    def _parse_slm_response(self, raw: str, title: str) -> SLMExtractionResult:
        """
        Parse and validate the raw SLM output string.
        Handles hallucinated markdown fences, extra prose, and malformed JSON.
        """
        cleaned = _extract_json_from_text(raw)

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error(
                "[%s] JSON parse error (%s). Raw output (first 300 chars): %.300s",
                datetime.utcnow().isoformat(),
                exc,
                raw,
            )
            return self._empty_extraction(title)

        try:
            return SLMExtractionResult(**data)
        except Exception as exc:
            logger.error(
                "[%s] SLMExtractionResult validation failed (%s) — attempting partial salvage",
                datetime.utcnow().isoformat(),
                exc,
            )
            # Salvage whatever individual entity objects are valid
            salvaged_entities: List[SLMEntity] = []
            for item in data.get("entities", []):
                try:
                    salvaged_entities.append(SLMEntity(**item))
                except Exception:
                    pass

            salvaged_rels: List[SLMRelationship] = []
            for item in data.get("relationships", []):
                try:
                    salvaged_rels.append(SLMRelationship(**item))
                except Exception:
                    pass

            return SLMExtractionResult(
                entities=salvaged_entities,
                relationships=salvaged_rels,
                hypothesis=str(data.get("hypothesis", ""))[:500] or title,
                primary_target=str(data.get("primary_target", "Unknown"))[:200],
            )

    @staticmethod
    def _empty_extraction(title: str) -> SLMExtractionResult:
        return SLMExtractionResult(entities=[], hypothesis=title, primary_target="Unknown")

    # ------------------------------------------------------------------
    # Entity building with text-offset mapping
    # ------------------------------------------------------------------

    def _build_entities(self, slm_entities: List[SLMEntity], corpus: str) -> List[Entity]:
        """
        Convert SLM entity objects into internal Entity objects, mapping each
        back to a source-text snippet for frontend highlighting.
        """
        entities: List[Entity] = []
        for slm_ent in slm_entities:
            internal_type = _TYPE_MAP.get(slm_ent.type.lower(), "gene")
            mentions = max(corpus.lower().count(slm_ent.name.lower()), 1)
            snippet = _find_snippet(corpus, slm_ent.name)
            entities.append(
                Entity(
                    id=f"{internal_type}-{uuid.uuid4().hex[:8]}",
                    text=slm_ent.name,
                    type=internal_type,  # type: ignore[arg-type]
                    confidence=round(max(0.0, min(1.0, slm_ent.confidence_score)), 3),
                    mentions=mentions,
                    source_text=snippet,
                )
            )
        return _deduplicate_entities(entities)

    # ------------------------------------------------------------------
    # Validation layer
    # ------------------------------------------------------------------

    def validate_entities(self, entities: List[Entity], metadata: dict) -> List[Entity]:
        """
        Flag entities whose text does not appear in the study title or link URLs.
        Flagged entities still pass through — the frontend decides how to render them.
        """
        title_lower = (metadata.get("title") or "").lower()
        links_text = " ".join(str(u) for u in (metadata.get("links") or [])).lower()
        reference_text = title_lower + " " + links_text

        for entity in entities:
            if entity.text.lower() not in reference_text:
                entity.flagged = True

        return entities

    # ------------------------------------------------------------------
    # Knowledge Graph ingestion
    # ------------------------------------------------------------------

    def _ingest_to_graph(self, study: Study, extraction: SLMExtractionResult) -> None:
        """Upsert entities and relationships from a processed study into the KG."""
        from knowledge_graph import KGEdge, KGNode, RelationshipType, knowledge_graph

        accession = study.accession

        # Upsert entity nodes
        for ent in study.entities:
            knowledge_graph.add_node(KGNode(
                id=ent.text.upper(),
                entity_type=ent.type,
                aliases=[ent.text],
                source_accessions=[accession],
                metadata={"confidence": ent.confidence},
            ))

        # Build a lookup of entity names -> types for relationship endpoints
        entity_types = {ent.text.upper(): ent.type for ent in study.entities}

        # Upsert relationship edges
        for rel in extraction.relationships:
            try:
                rel_type = RelationshipType(rel.type)
            except ValueError:
                logger.warning("Unknown relationship type %r — skipping", rel.type)
                continue

            # Ensure both endpoint nodes exist (relationships may reference entities
            # that failed validation but are still valid graph nodes)
            for name in (rel.source.upper(), rel.target.upper()):
                if not knowledge_graph.get_node(name):
                    knowledge_graph.add_node(KGNode(
                        id=name,
                        entity_type=entity_types.get(name, "unknown"),
                        source_accessions=[accession],
                    ))

            knowledge_graph.add_edge(KGEdge(
                source=rel.source.upper(),
                target=rel.target.upper(),
                relationship=rel_type,
                confidence=rel.confidence,
                evidence=[f"[{accession}] {rel.evidence_snippet}"],
            ))

        logger.info(
            "KG updated from %s — nodes=%d, edges=%d",
            accession,
            knowledge_graph.node_count,
            knowledge_graph.edge_count,
        )

    # ------------------------------------------------------------------
    # Confidence scoring
    # ------------------------------------------------------------------

    def calculate_confidence(self, study: Study) -> float:
        """
        Overall pipeline confidence (0.0–1.0):
        - Entity count contribution : up to 0.40
        - Flagged entity penalty    : up to -0.30
        - Metadata completeness     : up to 0.30
        """
        score = 0.0

        entity_count = len(study.entities)
        score += min(entity_count / 10, 1.0) * 0.40

        if entity_count > 0:
            flagged_ratio = sum(1 for e in study.entities if e.flagged) / entity_count
            score -= flagged_ratio * 0.30

        if study.title and study.title != "Untitled":
            score += 0.10
        if study.abstract:
            score += 0.10
        if study.authors:
            score += 0.05
        if study.links:
            score += 0.05

        return round(max(0.0, min(1.0, score)), 3)
