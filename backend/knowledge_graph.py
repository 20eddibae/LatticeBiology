"""
NetworkX-based Knowledge Graph for biological entity relationships.

Stores entities as nodes and directional relationships (activates, inhibits,
binds_to, upregulates, downregulates) as edges. Provides contradiction
detection, underexplored pathway flagging, and Cytoscape.js export.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

logger = logging.getLogger(__name__)


class RelationshipType(str, Enum):
    ACTIVATES = "activates"
    INHIBITS = "inhibits"
    BINDS_TO = "binds_to"
    UPREGULATES = "upregulates"
    DOWNREGULATES = "downregulates"
    ASSOCIATED_WITH = "associated_with"


# Opposing relationship pairs for contradiction detection
_OPPOSING: Dict[str, str] = {
    "activates": "inhibits",
    "inhibits": "activates",
    "upregulates": "downregulates",
    "downregulates": "upregulates",
}


@dataclass
class KGNode:
    id: str
    entity_type: str  # gene, protein, compound, disease, pathway
    aliases: List[str] = field(default_factory=list)
    source_accessions: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KGEdge:
    source: str
    target: str
    relationship: RelationshipType
    confidence: float = 0.5
    evidence: List[str] = field(default_factory=list)


class KnowledgeGraph:
    """In-memory knowledge graph backed by NetworkX DiGraph."""

    def __init__(self) -> None:
        self._graph = nx.DiGraph()

    # ── Mutation ─────────────────────────────────────────────────

    def add_node(self, node: KGNode) -> None:
        """Add or update a node. Merges source_accessions and aliases."""
        if self._graph.has_node(node.id):
            data = self._graph.nodes[node.id]
            existing_sources = set(data.get("source_accessions", []))
            existing_sources.update(node.source_accessions)
            data["source_accessions"] = list(existing_sources)
            existing_aliases = set(data.get("aliases", []))
            existing_aliases.update(node.aliases)
            data["aliases"] = list(existing_aliases)
            data["metadata"].update(node.metadata)
        else:
            self._graph.add_node(
                node.id,
                entity_type=node.entity_type,
                aliases=node.aliases,
                source_accessions=node.source_accessions,
                metadata=node.metadata,
            )

    def add_edge(self, edge: KGEdge) -> None:
        """Add or update a directed edge. Merges evidence."""
        key = (edge.source, edge.target, edge.relationship.value)
        existing = None
        for _, _, d in self._graph.edges(data=True):
            if (d.get("_key") == key):
                existing = d
                break

        if existing:
            ev = set(existing.get("evidence", []))
            ev.update(edge.evidence)
            existing["evidence"] = list(ev)
            existing["confidence"] = max(existing.get("confidence", 0), edge.confidence)
        else:
            self._graph.add_edge(
                edge.source,
                edge.target,
                relationship=edge.relationship.value,
                confidence=edge.confidence,
                evidence=edge.evidence,
                _key=key,
            )

    # ── Queries ──────────────────────────────────────────────────

    def get_node(self, node_id: str) -> Optional[KGNode]:
        if not self._graph.has_node(node_id):
            return None
        d = self._graph.nodes[node_id]
        return KGNode(
            id=node_id,
            entity_type=d.get("entity_type", ""),
            aliases=d.get("aliases", []),
            source_accessions=d.get("source_accessions", []),
            metadata=d.get("metadata", {}),
        )

    def get_neighbors(
        self, node_id: str, rel_type: Optional[RelationshipType] = None
    ) -> List[KGNode]:
        if not self._graph.has_node(node_id):
            return []
        result = []
        for _, target, d in self._graph.out_edges(node_id, data=True):
            if rel_type and d.get("relationship") != rel_type.value:
                continue
            n = self.get_node(target)
            if n:
                result.append(n)
        return result

    @property
    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    @property
    def edge_count(self) -> int:
        return self._graph.number_of_edges()

    # ── Analysis ─────────────────────────────────────────────────

    def find_contradictions(self) -> List[Tuple[dict, dict]]:
        """Find edge pairs with opposing relationships between the same nodes."""
        contradictions = []
        edges_by_pair: Dict[Tuple[str, str], List[dict]] = {}

        for u, v, d in self._graph.edges(data=True):
            pair = (min(u, v), max(u, v))
            edges_by_pair.setdefault(pair, []).append({
                "source": u, "target": v, **d
            })

        for pair, edge_list in edges_by_pair.items():
            rel_types = {e["relationship"] for e in edge_list}
            for rel in rel_types:
                opposite = _OPPOSING.get(rel)
                if opposite and opposite in rel_types:
                    edge_a = next(e for e in edge_list if e["relationship"] == rel)
                    edge_b = next(e for e in edge_list if e["relationship"] == opposite)
                    contradictions.append((edge_a, edge_b))
                    break  # one contradiction per pair

        return contradictions

    def find_underexplored(self, min_sources: int = 2, max_degree: int = 3) -> List[KGNode]:
        """Nodes mentioned in multiple studies but with few connections."""
        result = []
        for node_id, data in self._graph.nodes(data=True):
            degree = self._graph.degree(node_id)
            sources = len(data.get("source_accessions", []))
            if sources >= min_sources and degree <= max_degree:
                result.append(KGNode(
                    id=node_id,
                    entity_type=data.get("entity_type", ""),
                    aliases=data.get("aliases", []),
                    source_accessions=data.get("source_accessions", []),
                    metadata={**data.get("metadata", {}), "degree": degree},
                ))
        result.sort(key=lambda n: len(n.source_accessions), reverse=True)
        return result

    # ── Export ────────────────────────────────────────────────────

    def to_cytoscape_json(self) -> dict:
        """Export as Cytoscape.js-compatible elements dict."""
        nodes = []
        for node_id, data in self._graph.nodes(data=True):
            nodes.append({
                "data": {
                    "id": node_id,
                    "label": node_id,
                    "entity_type": data.get("entity_type", ""),
                    "source_count": len(data.get("source_accessions", [])),
                }
            })

        edges = []
        for i, (u, v, data) in enumerate(self._graph.edges(data=True)):
            edges.append({
                "data": {
                    "id": f"e{i}",
                    "source": u,
                    "target": v,
                    "relationship": data.get("relationship", ""),
                    "confidence": data.get("confidence", 0),
                }
            })

        return {"nodes": nodes, "edges": edges}

    def subgraph(self, node_ids: List[str], depth: int = 1) -> "KnowledgeGraph":
        """Extract a subgraph around given nodes up to `depth` hops."""
        all_nodes = set()
        frontier = set(n for n in node_ids if self._graph.has_node(n))
        for _ in range(depth + 1):
            all_nodes.update(frontier)
            next_frontier = set()
            for n in frontier:
                next_frontier.update(self._graph.successors(n))
                next_frontier.update(self._graph.predecessors(n))
            frontier = next_frontier - all_nodes

        sub = KnowledgeGraph()
        for node_id in all_nodes:
            n = self.get_node(node_id)
            if n:
                sub.add_node(n)
        for u, v, d in self._graph.edges(data=True):
            if u in all_nodes and v in all_nodes:
                sub.add_edge(KGEdge(
                    source=u, target=v,
                    relationship=RelationshipType(d["relationship"]),
                    confidence=d.get("confidence", 0.5),
                    evidence=d.get("evidence", []),
                ))
        return sub


# Module-level singleton
knowledge_graph = KnowledgeGraph()
