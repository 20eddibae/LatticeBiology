"use client";

import { useEffect, useRef, useState } from "react";
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

// Subtype → Cytoscape shape mapping
const SUBTYPE_SHAPES: Record<string, string> = {
  transcription_factor: "diamond",
  tumor_suppressor: "hexagon",
  hypoxia_inducible_factor: "triangle",
  kinase: "round-rectangle",
  receptor: "octagon",
  enzyme: "barrel",
  signaling: "vee",
  structural: "rectangle",
  unknown: "ellipse",
};

const SUBTYPE_LABELS: Record<string, string> = {
  transcription_factor: "Transcription Factor",
  tumor_suppressor: "Tumor Suppressor",
  hypoxia_inducible_factor: "HIF",
  kinase: "Kinase",
  receptor: "Receptor",
  enzyme: "Enzyme",
  signaling: "Signaling",
  structural: "Structural",
};

interface Props {
  data: KGSubgraph;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  showLegend?: boolean;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: { label: string; type: string; subtype?: string; kd?: string; relationship?: string };
}

export default function NetworkGraph({ data, height = 320, onNodeClick, showLegend = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const isMountedRef = useRef(true);
  const [isReady, setIsReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, content: { label: "", type: "" },
  });

  // Collect subtypes present in data for legend
  const subtypesPresent = new Set<string>();
  for (const n of data?.elements?.nodes ?? []) {
    const st = (n.data as any).subtype;
    if (st && st !== "unknown") subtypesPresent.add(st);
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current || !containerRef.current || !data?.elements) return;

    // Guard against empty data
    const nodes = data.elements.nodes ?? [];
    const edges = data.elements.edges ?? [];
    if (nodes.length === 0 || !containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];

    for (const n of nodes) {
      const nd = n.data as any;
      elements.push({
        data: {
          id: nd.id,
          label: nd.label || nd.id,
          entityType: nd.entity_type || "unknown",
          subtype: nd.subtype || "",
          sourceCount: nd.source_count || 0,
        },
      });
    }

    for (const e of edges) {
      const ed = e.data as any;
      const kdVal = ed.kd_value;
      const kdLabel = kdVal != null ? `Kd: ${kdVal >= 1000 ? `${(kdVal / 1000).toFixed(1)} μM` : `${kdVal.toFixed(1)} nM`}` : "";
      const edgeLabel = kdLabel ? `${ed.relationship} (${kdLabel})` : ed.relationship;

      elements.push({
        data: {
          id: ed.id,
          source: ed.source,
          target: ed.target,
          relationship: ed.relationship,
          confidence: ed.confidence,
          kd_value: kdVal ?? null,
          edgeLabel,
          kdLabel,
        },
      });
    }

    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
      cyRef.current = null;
    }

    // Wrap initialization in try-catch to handle any Cytoscape errors
    let cy: cytoscape.Core;
    try {
      cy = cytoscape({
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
            shape: (ele: any) => {
              const st = ele.data("subtype");
              return (st && SUBTYPE_SHAPES[st]) || "ellipse";
            },
            width: (ele: any) => Math.max(24, 14 + (ele.data("sourceCount") || 0) * 4),
            height: (ele: any) => Math.max(24, 14 + (ele.data("sourceCount") || 0) * 4),
            "border-width": 2,
            "border-color": "#fff",
            "text-outline-width": 2,
            "text-outline-color": "#fff",
            color: "#1E293B",
          } as any,
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            width: (ele: any) => {
              const kd = ele.data("kd_value");
              if (kd != null && kd > 0) {
                // Width proportional to -log(Kd): stronger binding = thicker
                return Math.min(6, Math.max(1.5, -Math.log10(kd / 1e9) * 0.8));
              }
              return Math.max(1, (ele.data("confidence") || 0.5) * 3);
            },
            "line-color": (ele: any) => REL_COLORS[ele.data("relationship")] || "#94A3B8",
            "target-arrow-color": (ele: any) => REL_COLORS[ele.data("relationship")] || "#94A3B8",
            label: "data(edgeLabel)",
            "font-size": "7px",
            "text-rotation": "autorotate",
            "text-outline-width": 1.5,
            "text-outline-color": "#fff",
            color: "#64748B",
            opacity: 0.8,
          } as any,
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
        animate: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.25,
        padding: 20,
      } as any,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.1,
    });
    } catch (e) {
      console.error("Error initializing Cytoscape:", e);
      return;
    }

    // Defer event listener setup to avoid race conditions
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current || !cyRef.current) return;

      try {
        // Hover tooltips
        const handleNodeHover = (evt: any) => {
          if (!isMountedRef.current || !cyRef.current) return;
          try {
            const node = evt.target;
            const pos = node.renderedPosition();
            setTooltip({
              visible: true,
              x: pos.x,
              y: pos.y - 30,
              content: {
                label: node.data("label"),
                type: node.data("entityType"),
                subtype: node.data("subtype") || undefined,
              },
            });
          } catch (e) {
            // Ignore hover errors
          }
        };

        const handleEdgeHover = (evt: any) => {
          if (!isMountedRef.current || !cyRef.current) return;
          try {
            const edge = evt.target;
            const mid = edge.renderedMidpoint();
            setTooltip({
              visible: true,
              x: mid.x,
              y: mid.y - 20,
              content: {
                label: `${edge.data("source")} → ${edge.data("target")}`,
                type: edge.data("relationship"),
                kd: edge.data("kdLabel") || undefined,
                relationship: edge.data("relationship"),
              },
            });
          } catch (e) {
            // Ignore hover errors
          }
        };

        const handleOut = () => {
          if (!isMountedRef.current || !cyRef.current) return;
          setTooltip((prev) => ({ ...prev, visible: false }));
        };

        const handleNodeClick = (evt: any) => {
          if (!isMountedRef.current || !cyRef.current || !onNodeClick) return;
          try {
            onNodeClick(evt.target.id());
          } catch (e) {
            // Ignore click errors
          }
        };

        cy.on("mouseover", "node", handleNodeHover);
        cy.on("mouseover", "edge", handleEdgeHover);
        cy.on("mouseout", "node, edge", handleOut);
        if (onNodeClick) {
          cy.on("tap", "node", handleNodeClick);
        }
      } catch (e) {
        console.error("Error setting up event listeners:", e);
      }
    }, 100);

    cyRef.current = cy;
    setIsReady(true);

    return () => {
      setIsReady(false);
      clearTimeout(timeoutId);
      try {
        // Disable pointer events to prevent any further interactions
        if (containerRef.current) {
          containerRef.current.style.pointerEvents = "none";
        }
        // Remove all event listeners before destroying
        try {
          cy.removeAllListeners();
        } catch (e) {
          // Ignore removal errors
        }
        // Wait a tick before destroying to avoid race conditions
        setTimeout(() => {
          try {
            if (cyRef.current) {
              cyRef.current.destroy();
              cyRef.current = null;
            }
          } catch (e) {
            // Ignore destroy errors
          }
        }, 0);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [data, onNodeClick]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ height, width: "100%", pointerEvents: isReady ? "auto" : "none" }}
        className="rounded-xl border border-slate-200 bg-white"
      />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 text-white rounded-lg px-3 py-2 text-[11px] shadow-lg border border-slate-700/50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">{tooltip.content.label}</p>
          <p className="text-slate-400 text-[10px]">{tooltip.content.type}</p>
          {tooltip.content.subtype && (
            <p className="text-teal-400 text-[10px]">{SUBTYPE_LABELS[tooltip.content.subtype] || tooltip.content.subtype}</p>
          )}
          {tooltip.content.kd && (
            <p className="text-blue-400 text-[10px] font-mono">{tooltip.content.kd}</p>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && subtypesPresent.size > 0 && (
        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-2 text-[9px] space-y-1 shadow-sm">
          <p className="font-semibold text-slate-600 uppercase tracking-wider mb-1">Shapes</p>
          {Array.from(subtypesPresent).map((st) => (
            <div key={st} className="flex items-center gap-1.5 text-slate-500">
              <span className="inline-block w-3 h-3 border border-slate-300 rounded-sm" style={{
                borderRadius: st === "kinase" ? "3px" : st === "transcription_factor" ? "0" : "50%",
                transform: st === "transcription_factor" ? "rotate(45deg) scale(0.8)" : st === "hypoxia_inducible_factor" ? "rotate(0)" : undefined,
                clipPath: st === "hypoxia_inducible_factor" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                backgroundColor: ENTITY_COLORS.protein + "40",
              }} />
              <span>{SUBTYPE_LABELS[st] || st}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-1 mt-1">
            <p className="font-semibold text-slate-600 uppercase tracking-wider mb-1">Edge Width</p>
            <p className="text-slate-400">Proportional to binding affinity</p>
          </div>
        </div>
      )}
    </div>
  );
}
