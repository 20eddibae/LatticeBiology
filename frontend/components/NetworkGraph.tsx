"use client";

import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { KGSubgraph } from "@/lib/api";

const ENTITY_COLORS: Record<string, string> = {
  gene: "#7C3AED",
  protein: "#0369A1",
  compound: "#15803D",
  disease: "#DC2626",
  pathway: "#B45309",
  unknown: "#64748B",
};

const REL_COLORS: Record<string, string> = {
  activates: "#059669",
  inhibits: "#DC2626",
  binds_to: "#2563EB",
  upregulates: "#16A34A",
  downregulates: "#EA580C",
  associated_with: "#64748B",
};

interface Props {
  data: KGSubgraph;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export default function NetworkGraph({ data, height = 320, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.elements) return;

    const elements: cytoscape.ElementDefinition[] = [];

    for (const n of data.elements.nodes) {
      elements.push({
        data: {
          id: n.data.id,
          label: n.data.label || n.data.id,
          entityType: n.data.entity_type || "unknown",
          sourceCount: n.data.source_count || 0,
        },
      });
    }

    for (const e of data.elements.edges) {
      elements.push({
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          relationship: e.data.relationship,
          confidence: e.data.confidence,
        },
      });
    }

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "background-color": (ele: any) => ENTITY_COLORS[ele.data("entityType")] || "#64748B",
            width: (ele: any) => Math.max(20, 12 + (ele.data("sourceCount") || 0) * 4),
            height: (ele: any) => Math.max(20, 12 + (ele.data("sourceCount") || 0) * 4),
            "border-width": 2,
            "border-color": "#fff",
            "text-outline-width": 2,
            "text-outline-color": "#fff",
            color: "#1E293B",
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            width: (ele: any) => Math.max(1, (ele.data("confidence") || 0.5) * 3),
            "line-color": (ele: any) => REL_COLORS[ele.data("relationship")] || "#94A3B8",
            "target-arrow-color": (ele: any) => REL_COLORS[ele.data("relationship")] || "#94A3B8",
            label: "data(relationship)",
            "font-size": "8px",
            "text-rotation": "autorotate",
            "text-outline-width": 1.5,
            "text-outline-color": "#fff",
            color: "#64748B",
            opacity: 0.8,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#0F766E",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.25,
        padding: 20,
      } as any,
      minZoom: 0.3,
      maxZoom: 3,
    });

    if (onNodeClick) {
      cy.on("tap", "node", (evt) => {
        onNodeClick(evt.target.id());
      });
    }

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data, onNodeClick]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-xl border border-slate-200 bg-white"
    />
  );
}
