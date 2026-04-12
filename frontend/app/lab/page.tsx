"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Dna,
  Pill,
  AlertCircle,
  GitBranch,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Atom,
  Wrench,
  Lightbulb,
  ShieldCheck,
  Brain,
  Sparkles,
  Clock,
  Network,
  TestTubes,
  Beaker,
  RotateCcw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Microscope,
  Target,
  Zap,
  type LucideProps,
} from "lucide-react";
import clsx from "clsx";
import {
  startLabSession,
  fetchLabSession,
  streamLabSession,
  type LabSession,
  type AgentMessage,
  type AlphaFoldResult,
  type LabEntity,
  type DockingResult,
  type ValidationPlan,
  type GraphInsights,
  type KGSubgraph,
  type BindingInterface,
  type ResidueScore,
  type LeadCompound,
  type BindingEnergyMatrix,
  fetchKGSubgraph,
  fetchPPINetwork,
} from "@/lib/api";

// Dynamic import Mol* viewer (heavy WebGL — avoid SSR)
const MolstarViewer = dynamic(() => import("@/components/MolstarViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Atom size={20} className="mx-auto text-slate-300 mb-2 animate-pulse" />
        <p className="text-[11px] text-slate-400">Loading 3D viewer…</p>
      </div>
    </div>
  ),
});

// Dynamic import NetworkGraph (depends on cytoscape — avoid SSR)
const NetworkGraph = dynamic(() => import("@/components/NetworkGraph"), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Network size={20} className="mx-auto text-slate-300 mb-2 animate-pulse" />
        <p className="text-[11px] text-slate-400">Loading network graph…</p>
      </div>
    </div>
  ),
});

// Dynamic import ConfidenceTelemetry
const ConfidenceTelemetry = dynamic(() => import("@/components/ConfidenceTelemetry"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <p className="text-[11px] text-slate-400">Loading telemetry...</p>
    </div>
  ),
});

// ResultsDashboard available if needed for future dashboard view
// const ResultsDashboard = dynamic(() => import("@/components/ResultsDashboard"), { ssr: false });

// Dynamic import BindingHeatmap
const BindingHeatmap = dynamic(() => import("@/components/BindingHeatmap"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <p className="text-[11px] text-slate-400">Loading heatmap...</p>
    </div>
  ),
});

// Dynamic import LeadCompoundsPanel
const LeadCompoundsPanel = dynamic(() => import("@/components/LeadCompoundsPanel"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <p className="text-[11px] text-slate-400">Loading compounds...</p>
    </div>
  ),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  "Analyze BRCA1-HIF1α interactions in triple-negative breast cancer hypoxia",
  "Investigate KRAS G12D synthetic lethal interactions in pancreatic cancer",
  "Explore ACE2-Spike RBD binding mechanisms for therapeutic antibody design",
  "Characterize EGFR exon 19 deletion biomarkers in early-stage NSCLC",
];

const AGENT_CONFIG: Record<string, { short: string; Icon: React.ComponentType<LucideProps>; bubble: string }> = {
  orchestrator:    { short: "PI",  Icon: Brain,      bubble: "agent-bubble-orchestrator" },
  specialist:      { short: "HYP", Icon: Lightbulb,  bubble: "agent-bubble-specialist"   },
  critic:          { short: "CR",  Icon: ShieldCheck, bubble: "agent-bubble-critic"       },
  analyst:         { short: "IN",  Icon: Network,    bubble: "agent-bubble-analyst"       },
  experimentalist: { short: "VAL", Icon: TestTubes,  bubble: "agent-bubble-experimentalist" },
};

const ENTITY_STYLE: Record<string, { color: string; bg: string; Icon: React.ComponentType<LucideProps> }> = {
  protein:  { color: "#0369A1", bg: "#F0F9FF", Icon: FlaskConical },
  gene:     { color: "#6D28D9", bg: "#F5F3FF", Icon: Dna          },
  compound: { color: "#15803D", bg: "#F0FDF4", Icon: Pill         },
  disease:  { color: "#B91C1C", bg: "#FEF2F2", Icon: AlertCircle  },
  pathway:  { color: "#B45309", bg: "#FFFBEB", Icon: GitBranch    },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Minimal inline markdown renderer for agent messages. */
function renderContent(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**"))
      return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("*") && seg.endsWith("*"))
      return <em key={i} className="italic">{seg.slice(1, -1)}</em>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-teal-700">{seg.slice(1, -1)}</code>;
    return seg.split("\n").map((line, j) => (
      <span key={`${i}-${j}`}>{line}{j < seg.split("\n").length - 1 && <br />}</span>
    ));
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── AlphaFold card ───────────────────────────────────────────────────────────

function AlphaFoldCard({ result }: { result: AlphaFoldResult }) {
  const conf = result.mean_confidence;
  const tierColor = conf >= 70 ? "#059669" : conf >= 50 ? "#D97706" : "#DC2626";
  const tierLabel = conf >= 70 ? "High confidence" : conf >= 50 ? "Medium confidence" : "Low confidence";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden"
    >
      {/* Header stripe */}
      <div className="h-1 w-full" style={{ backgroundColor: tierColor }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{result.protein_name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{result.uniprot_name}</p>
          </div>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Atom size={16} className="text-brand-700" />
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-mono text-brand-700">
            {result.accession}
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-mono text-slate-500">
            {result.entry_id}
          </span>
        </div>

        {/* Confidence */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Mean pLDDT
            </span>
            <span className="text-xs font-bold" style={{ color: tierColor }}>
              {conf}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: tierColor }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(conf, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-[9px] text-slate-400 mt-1">{tierLabel}</p>
        </div>

        {/* Link */}
        <a
          href={result.alphafold_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-brand-600 hover:text-brand-800 font-medium transition-colors duration-150"
        >
          <ExternalLink size={11} />
          View structure in AlphaFold DB
        </a>
      </div>
    </motion.div>
  );
}

// ─── Agent message bubble ─────────────────────────────────────────────────────

function AgentBubble({ msg }: { msg: AgentMessage }) {
  const roleCfg = AGENT_CONFIG[msg.agent_role] ?? AGENT_CONFIG.orchestrator;
  const isToolCall = msg.message_type === "tool_call";
  const isToolResult = msg.message_type === "tool_result";
  const isFinal = msg.message_type === "final";
  const isError = msg.message_type === "error";

  const bubbleClass = isToolCall || isToolResult
    ? "agent-bubble-tool"
    : isFinal
    ? "agent-bubble-final"
    : isError
    ? "agent-bubble-error"
    : roleCfg.bubble;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm"
          style={{ backgroundColor: msg.agent_color }}
        >
          {roleCfg.short}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-800">{msg.agent_name}</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
            style={{
              backgroundColor: msg.agent_color + "18",
              color: msg.agent_color,
            }}
          >
            {msg.agent_role}
          </span>
          {isToolCall && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
              <Wrench size={8} /> tool call
            </span>
          )}
          {isFinal && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700">
              <Sparkles size={8} /> final
            </span>
          )}
          <span className="ml-auto text-[9px] text-slate-400 flex-shrink-0">
            {formatTime(msg.timestamp)}
          </span>
        </div>

        {/* Content */}
        <div className={clsx("agent-bubble", bubbleClass)}>
          {renderContent(msg.content)}
        </div>

        {/* Embedded AlphaFold result */}
        {isToolResult && msg.tool_data && (
          <div className="mt-2 max-w-xs">
            <AlphaFoldCard result={msg.tool_data as AlphaFoldResult} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LabSession["status"] }) {
  const cfg = {
    pending:   { label: "Pending",   color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", Icon: Clock      },
    running:   { label: "Running",   color: "#0F766E", bg: "#F0FDFA", border: "#5EEAD4", Icon: Loader2     },
    completed: { label: "Completed", color: "#059669", bg: "#F0FDF4", border: "#86EFAC", Icon: CheckCircle2},
    failed:    { label: "Failed",    color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", Icon: XCircle     },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <cfg.Icon size={10} className={status === "running" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

// ─── Entity list ──────────────────────────────────────────────────────────────

function EntityList({ entities }: { entities: LabEntity[] }) {
  if (!entities.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entities.map((e, i) => {
        const cfg = ENTITY_STYLE[e.type] ?? ENTITY_STYLE.protein;
        const Icon = cfg.Icon;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border"
            style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + "40" }}
          >
            <Icon size={9} />
            {e.name}
            {e.priority === "high" && <span className="text-[8px] opacity-60">↑</span>}
          </motion.span>
        );
      })}
    </div>
  );
}

// ─── Agent pipeline graph ────────────────────────────────────────────────────

const PIPELINE_NODES = [
  { id: "pi_analyze",  label: "PI Analysis",   color: "#0F766E", Icon: Brain      },
  { id: "insight",     label: "Graph Insight",  color: "#2563EB", Icon: Network    },
  { id: "alphafold",   label: "AlphaFold",     color: "#0F766E", Icon: Atom       },
  { id: "hypothesis",  label: "Hypothesis",    color: "#7C3AED", Icon: Lightbulb  },
  { id: "critic",      label: "Critic Review", color: "#D97706", Icon: ShieldCheck},
  { id: "docking",     label: "Docking",       color: "#059669", Icon: Beaker     },
  { id: "validation",  label: "Validation",    color: "#059669", Icon: TestTubes  },
  { id: "synthesize",  label: "Synthesis",     color: "#059669", Icon: Sparkles   },
];

function PipelineGraph({ activeNode, completed }: { activeNode: string | null; completed: boolean }) {
  // Determine which nodes are done (everything before activeNode)
  const activeIdx = activeNode ? PIPELINE_NODES.findIndex((n) => n.id === activeNode) : -1;

  return (
    <div className="section-panel p-4 section-accent-teal">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Agent Pipeline
      </p>
      <div className="space-y-0">
        {PIPELINE_NODES.map((node, i) => {
          const isDone = completed || (activeIdx >= 0 && i < activeIdx);
          const isActive = !completed && node.id === activeNode;
          const isPending = !completed && (activeIdx < 0 || i > activeIdx);
          const Icon = node.Icon;

          return (
            <div key={node.id}>
              <div className="flex items-center gap-2.5">
                {/* Node circle */}
                <div
                  className={clsx(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isDone && "border-emerald-500 bg-emerald-50",
                    isActive && "border-current bg-white shadow-sm",
                    isPending && "border-slate-200 bg-slate-50",
                  )}
                  style={isActive ? { borderColor: node.color } : undefined}
                >
                  {isDone ? (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 size={10} style={{ color: node.color }} />
                    </motion.div>
                  ) : (
                    <Icon size={10} className="text-slate-300" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={clsx(
                    "text-[11px] font-medium transition-colors duration-200",
                    isDone && "text-emerald-700",
                    isActive && "text-slate-900 font-semibold",
                    isPending && "text-slate-400",
                  )}
                >
                  {node.label}
                </span>

                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-auto text-[8px] font-medium uppercase tracking-wider"
                    style={{ color: node.color }}
                  >
                    running
                  </motion.span>
                )}
              </div>

              {/* Connector line */}
              {i < PIPELINE_NODES.length - 1 && (
                <div className="ml-[11px] h-3 w-px bg-slate-200" />
              )}
            </div>
          );
        })}
      </div>

      {/* Critic → Hypothesis revision arrow hint */}
      {activeNode === "hypothesis" && !completed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-[9px] text-violet-500 italic pl-8"
        >
          revision loop active
        </motion.p>
      )}
    </div>
  );
}

// ─── Compact agent bubble for side panel ─────────────────────────────────────

function CompactBubble({ msg }: { msg: AgentMessage }) {
  const roleCfg = AGENT_CONFIG[msg.agent_role] ?? AGENT_CONFIG.orchestrator;
  const isToolCall = msg.message_type === "tool_call";
  const isToolResult = msg.message_type === "tool_result";
  const isFinal = msg.message_type === "final";

  // Truncate for compact view
  const preview = msg.content.length > 120 ? msg.content.slice(0, 120) + "…" : msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="flex gap-2 py-1.5"
    >
      <div
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white text-[8px] font-bold mt-0.5"
        style={{ backgroundColor: msg.agent_color }}
      >
        {roleCfg.short}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold text-slate-700">{msg.agent_name}</span>
          {(isToolCall || isToolResult) && (
            <Wrench size={7} className="text-slate-400" />
          )}
          {isFinal && (
            <Sparkles size={7} className="text-emerald-500" />
          )}
          <span className="ml-auto text-[8px] text-slate-400 flex-shrink-0">
            {formatTime(msg.timestamp)}
          </span>
        </div>
        <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">
          {preview}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Decision Node (human-in-the-loop) ──────────────────────────────────────

function DecisionNode({
  critique,
  onApprove,
  onRevise,
}: {
  critique: string;
  onApprove: () => void;
  onRevise: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-50 to-white shadow-lg overflow-hidden"
    >
      <div className="px-4 py-3 bg-amber-100/60 border-b border-amber-200 flex items-center gap-2">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ShieldCheck size={16} className="text-amber-600" />
        </motion.div>
        <div>
          <p className="text-[12px] font-bold text-amber-900">Decision Required</p>
          <p className="text-[9px] text-amber-700">Critic review complete — choose how to proceed</p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[11px] text-slate-700 leading-relaxed mb-4 max-h-32 overflow-y-auto">
          {critique}
        </p>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle2 size={12} />
            Approve &amp; Dock
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRevise}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <RotateCcw size={12} />
            Request Revision
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Agent Reasoning Visualization ───────────────────────────────────────────

const REASONING_STAGES: Record<string, { title: string; description: string; Icon: React.ComponentType<LucideProps>; color: string }> = {
  pi_analyze:  { title: "Principal Investigator",  description: "Parsing your query, identifying key entities and biological context…",     Icon: Brain,      color: "#0F766E" },
  insight:     { title: "Knowledge Graph Analysis", description: "Mapping entity relationships, finding known interactions and pathways…",   Icon: Network,    color: "#2563EB" },
  alphafold:   { title: "Structural Prediction",    description: "Fetching AlphaFold structures, analyzing protein fold confidence…",        Icon: Atom,       color: "#0F766E" },
  hypothesis:  { title: "Hypothesis Generation",    description: "Synthesizing findings into testable hypotheses with mechanistic basis…",   Icon: Lightbulb,  color: "#7C3AED" },
  critic:      { title: "Peer Review",              description: "Evaluating hypothesis rigor, checking for logical gaps and alternatives…", Icon: ShieldCheck, color: "#D97706" },
  docking:     { title: "Molecular Docking",        description: "Screening compounds against targets, scoring binding affinities…",         Icon: Beaker,     color: "#059669" },
  validation:  { title: "Experimental Validation",  description: "Designing wet lab protocols, choosing assay types and model systems…",     Icon: TestTubes,  color: "#059669" },
  synthesize:  { title: "Final Synthesis",          description: "Compiling results into actionable conclusions and next steps…",            Icon: Sparkles,   color: "#059669" },
};

function AgentReasoningCards({
  activeNode,
  messages,
  completed,
}: {
  activeNode: string | null;
  messages: AgentMessage[];
  completed: boolean;
}) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const activeIdx = activeNode ? PIPELINE_NODES.findIndex((n) => n.id === activeNode) : -1;

  // Group messages by pipeline stage
  const stageMessages: Record<string, AgentMessage[]> = {};
  for (const msg of messages) {
    const nodeMap: Record<string, string> = {
      orchestrator: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "alphafold" : "pi_analyze",
      specialist: "hypothesis",
      critic: "critic",
      analyst: "insight",
      experimentalist: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "docking" : "validation",
    };
    const stage = msg.message_type === "final" ? "synthesize" : (nodeMap[msg.agent_role] ?? "pi_analyze");
    if (!stageMessages[stage]) stageMessages[stage] = [];
    stageMessages[stage].push(msg);
  }

  return (
    <div className="space-y-2">
      {PIPELINE_NODES.map((node, i) => {
        const isDone = completed || (activeIdx >= 0 && i < activeIdx);
        const isActive = !completed && node.id === activeNode;
        const isPending = !completed && (activeIdx < 0 || i > activeIdx);
        const stage = REASONING_STAGES[node.id];
        if (!stage || (isPending && !isDone)) return null;

        const msgs = stageMessages[node.id] || [];
        const isExpanded = expandedCard === node.id;
        const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const keyInsight = latestMsg ? (latestMsg.content.length > 150 ? latestMsg.content.slice(0, 150) + "…" : latestMsg.content) : stage.description;
        const Icon = stage.Icon;

        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={clsx(
              "rounded-xl border overflow-hidden transition-all",
              isActive ? "border-l-[3px] shadow-sm" : "border-slate-200",
              isDone && "bg-white",
              isActive && "bg-white",
            )}
            style={isActive ? { borderLeftColor: stage.color } : undefined}
          >
            <button
              onClick={() => setExpandedCard(isExpanded ? null : node.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div
                className={clsx(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all",
                  isDone && "bg-emerald-50",
                  isActive && "bg-opacity-10",
                  isPending && "bg-slate-100",
                )}
                style={isActive ? { backgroundColor: stage.color + "15" } : undefined}
              >
                {isDone ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : isActive ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={14} style={{ color: stage.color }} />
                  </motion.div>
                ) : (
                  <Icon size={14} className="text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={clsx("text-[12px] font-semibold", isDone ? "text-slate-700" : isActive ? "text-slate-900" : "text-slate-500")}>
                    {stage.title}
                  </p>
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ color: stage.color, backgroundColor: stage.color + "12" }}
                    >
                      active
                    </motion.span>
                  )}
                  {isDone && msgs.length > 0 && (
                    <span className="text-[9px] text-slate-400">{msgs.length} steps</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-1 mt-0.5">{keyInsight}</p>
              </div>
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight size={14} className="text-slate-400" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isExpanded && msgs.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 space-y-1.5 max-h-48 overflow-y-auto"
                >
                  {msgs.map((msg) => (
                    <div key={msg.id} className="flex gap-2 py-1">
                      <div
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-white text-[7px] font-bold mt-0.5"
                        style={{ backgroundColor: msg.agent_color }}
                      >
                        {(AGENT_CONFIG[msg.agent_role] ?? AGENT_CONFIG.orchestrator).short}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-slate-600 leading-relaxed line-clamp-3">{msg.content}</p>
                        <span className="text-[8px] text-slate-400">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Experiment Alternatives (post-completion) ──────────────────────────────

function ExperimentAlternatives({
  session,
  onSelectQuery,
}: {
  session: LabSession;
  onSelectQuery: (q: string) => void;
}) {
  // Generate next-step suggestions based on the session results
  const entities = session.entities_found.map((e) => e.name);
  const hasCompounds = session.lead_compounds && session.lead_compounds.length > 0;
  const hasDocking = session.docking_results && session.docking_results.length > 0;

  const alternatives: { title: string; description: string; query: string; Icon: React.ComponentType<LucideProps>; color: string }[] = [];

  // Suggest deeper structural analysis
  if (session.alphafold_results.length > 0) {
    const protein = session.alphafold_results[0].protein_name;
    alternatives.push({
      title: "Mutational Analysis",
      description: `Investigate key mutations in ${protein} and their impact on binding affinity`,
      query: `Analyze common mutations in ${protein} and predict structural impact on drug binding`,
      Icon: Dna,
      color: "#7C3AED",
    });
  }

  // Suggest resistance mechanisms
  if (hasDocking && session.docking_results.length > 0) {
    const target = session.docking_results[0].target;
    alternatives.push({
      title: "Resistance Mechanisms",
      description: `Explore known resistance mechanisms against ${target} inhibitors`,
      query: `Investigate resistance mechanisms and escape mutations for ${target} targeted therapy`,
      Icon: ShieldCheck,
      color: "#D97706",
    });
  }

  // Suggest combination therapy
  if (hasCompounds && session.lead_compounds!.length > 0) {
    alternatives.push({
      title: "Combination Therapy",
      description: "Evaluate synergistic drug combinations for enhanced efficacy",
      query: `Design combination therapy strategy using ${entities.slice(0, 2).join(" and ")} pathway inhibitors`,
      Icon: Zap,
      color: "#2563EB",
    });
  }

  // Suggest biomarker discovery
  alternatives.push({
    title: "Biomarker Discovery",
    description: `Identify predictive biomarkers for ${entities[0] || "target"} response`,
    query: `Discover predictive biomarkers for ${entities[0] || "target"} therapy response in patient populations`,
    Icon: Target,
    color: "#059669",
  });

  // Suggest related pathway exploration
  if (entities.length > 1) {
    alternatives.push({
      title: "Pathway Crosstalk",
      description: `Map interaction networks between ${entities.slice(0, 2).join(" and ")}`,
      query: `Explore pathway crosstalk and feedback loops involving ${entities.slice(0, 3).join(", ")}`,
      Icon: Network,
      color: "#0F766E",
    });
  }

  // Suggest experimental validation design
  alternatives.push({
    title: "Validation Protocol",
    description: "Design a comprehensive wet lab validation workflow",
    query: `Design detailed experimental validation protocol for ${entities[0] || "target"} with CRISPR screening and functional assays`,
    Icon: Microscope,
    color: "#B45309",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 to-white">
        <div className="flex items-center gap-2">
          <ArrowRight size={14} className="text-teal-600" />
          <p className="text-[13px] font-bold text-slate-800">Explore Next</p>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">Click a direction to start a new experiment</p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2.5">
        {alternatives.map((alt) => {
          const Icon = alt.Icon;
          return (
            <motion.button
              key={alt.title}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectQuery(alt.query)}
              className="text-left rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 p-3.5 transition-all group"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: alt.color + "12" }}
                >
                  <Icon size={14} style={{ color: alt.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800 group-hover:text-slate-900">{alt.title}</p>
                  <p className="text-[9px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">{alt.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Virtual Lab page ─────────────────────────────────────────────────────────

export default function LabPage() {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<LabSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [kgData, setKgData] = useState<KGSubgraph | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);

  // Auto-scroll timeline
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [session?.messages.length]);

  // Fetch KG data when entities arrive
  useEffect(() => {
    if (session?.entities_found && session.entities_found.length > 0 && !kgData) {
      const entityNames = session.entities_found.map((e) => e.name).join(",");
      fetchKGSubgraph(entityNames, 2).then((data) => {
        if (data) setKgData(data);
      });
    }
  }, [session?.entities_found?.length, kgData]);

  // SSE streaming
  const stopStream = useCallback(() => {
    if (cleanupStreamRef.current) {
      cleanupStreamRef.current();
      cleanupStreamRef.current = null;
    }
  }, []);

  const startStream = useCallback((sessionId: string) => {
    stopStream();

    cleanupStreamRef.current = streamLabSession(sessionId, {
      onMessage: (msg) => {
        setSession((prev) => {
          if (!prev) return prev;
          const nodeMap: Record<string, string> = {
            orchestrator: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "alphafold" : "pi_analyze",
            specialist: "hypothesis",
            critic: "critic",
            analyst: "insight",
            experimentalist: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "docking" : "validation",
          };
          if (msg.message_type === "final") {
            setActiveNode("synthesize");
          } else {
            setActiveNode(nodeMap[msg.agent_role] ?? "pi_analyze");
          }
          return { ...prev, messages: [...prev.messages, msg] };
        });
      },
      onStatus: (data) => {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status,
            entities_found: data.entities_found,
            alphafold_results: data.alphafold_results,
            per_residue_plddt: data.per_residue_plddt,
            binding_interface: data.binding_interface,
            binding_energy_matrix: data.binding_energy_matrix,
            lead_compounds: data.lead_compounds ?? [],
            graph_insights: data.graph_insights ?? {},
            hypotheses: data.hypotheses,
            critique: data.critique,
            docking_results: data.docking_results ?? [],
            validation_plan: data.validation_plan ?? ({} as ValidationPlan),
            final_summary: data.final_summary,
          };
        });
        // Refetch KG on status updates
        setKgData(null);
      },
      onDone: (fullSession) => {
        setSession(fullSession);
        setActiveNode(null);
      },
      onError: () => {
        fetchLabSession(sessionId).then((s) => {
          if (s) setSession(s);
        });
      },
    });
  }, [stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  const handleRun = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSession(null);
    setActiveNode(null);
    setKgData(null);
    stopStream();

    const result = await startLabSession(query.trim());
    if (!result) {
      setError("Could not reach the backend. Make sure the LatticeBio server is running.");
      setLoading(false);
      return;
    }

    setSession({
      session_id: result.session_id,
      query: query.trim(),
      status: "pending",
      messages: [],
      entities_found: [],
      alphafold_results: [],
      graph_insights: {},
      hypotheses: [],
      critique: "",
      docking_results: [],
      validation_plan: {} as ValidationPlan,
      final_summary: "",
      created_at: new Date().toISOString(),
    });

    setLoading(false);
    setActiveNode("pi_analyze");
    startStream(result.session_id);
  };

  const isRunning = session?.status === "pending" || session?.status === "running";
  const showDecisionNode = session?.critique && activeNode === "critic";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
      {/* ── Compact header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 border border-teal-200">
              <FlaskConical size={14} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Virtual Research Lab</h1>
              <p className="text-[9px] text-slate-400">
                PI → Insight → AlphaFold → Hypothesis → Critic → Docking → Validation → Synthesis
              </p>
            </div>
          </div>

          {/* Query input (inline) */}
          <div className="flex-1 flex gap-2 ml-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isRunning && !loading && handleRun()}
              placeholder="Describe your research question…"
              disabled={isRunning || loading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-colors"
            />
            <motion.button
              onClick={handleRun}
              disabled={!query.trim() || isRunning || loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-teal-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              {loading || isRunning ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
              {isRunning ? "Running…" : "Run"}
            </motion.button>
          </div>

          {session && (
            <div className="flex-shrink-0">
              <StatusBadge status={session.status} />
            </div>
          )}
        </div>

        {/* Example queries (only when no session) */}
        {!session && (
          <div className="mt-2 flex flex-wrap gap-1.5 ml-[52px]">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                disabled={isRunning || loading}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] text-slate-500 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-all disabled:opacity-40"
              >
                {q.length > 60 ? q.slice(0, 60) + "…" : q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-[12px] text-red-700"
          >
            <XCircle size={13} className="flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main workspace ─────────────────────────────────────────── */}
      {!session ? (
        /* Empty state — light theme */
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center max-w-lg">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <motion.div
                  className="absolute -inset-4 rounded-full border border-dashed border-teal-300/60"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200">
                  <Brain size={28} className="text-teal-600" />
                </div>
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Virtual Wet Lab Workbench</h2>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
              Enter a research question to launch the multi-agent pipeline. AI agents will analyze your query,
              predict protein structures, generate hypotheses, and identify drug candidates — all in real time.
            </p>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "PI", desc: "Orchestrator", color: "#0F766E", Icon: Brain },
                { label: "Insight", desc: "Graph Analysis", color: "#2563EB", Icon: Network },
                { label: "Hypothesis", desc: "Generation", color: "#7C3AED", Icon: Lightbulb },
                { label: "Critic", desc: "Peer Review", color: "#D97706", Icon: ShieldCheck },
                { label: "Validation", desc: "Experiments", color: "#059669", Icon: TestTubes },
              ].map(({ label, desc, color, Icon }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
                  <div
                    className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: color }}
                  >
                    <Icon size={14} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-700">{label}</p>
                  <p className="text-[9px] text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── 3-column workspace layout ──────────────────────────────── */
        <div className="flex flex-1 min-h-0">

          {/* ── LEFT: Agent Chat Panel (collapsible) ────────────────── */}
          <motion.div
            animate={{ width: chatOpen ? 280 : 42 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 flex-shrink-0">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
              >
                <motion.div animate={{ rotate: chatOpen ? 0 : 180 }} transition={{ duration: 0.2 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-400">
                    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </motion.div>
              </button>
              {chatOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Agent Chat</span>
                  {session.messages.length > 0 && (
                    <span className="text-[9px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">
                      {session.messages.length}
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            {/* Chat messages */}
            {chatOpen && (
              <div ref={timelineRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
                {/* Query */}
                <div className="rounded-lg border border-teal-200 bg-teal-50/60 px-2.5 py-1.5 mb-2 flex items-center gap-2">
                  <FlaskConical size={10} className="text-teal-600 flex-shrink-0" />
                  <p className="text-[10px] font-medium text-teal-800 line-clamp-2">{session.query}</p>
                </div>

                <AnimatePresence initial={false}>
                  {session.messages.map((msg) => (
                    <CompactBubble key={msg.id} msg={msg} />
                  ))}
                </AnimatePresence>

                {isRunning && session.messages.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-7 py-1 text-[9px] text-slate-400">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="inline-block h-1 w-1 rounded-full bg-slate-300"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                    <span className="ml-0.5">thinking…</span>
                  </div>
                )}

                {isRunning && session.messages.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={16} className="animate-spin text-teal-600" />
                  </div>
                )}
              </div>
            )}

            {/* Collapsed state: vertical text */}
            {!chatOpen && (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[9px] text-slate-400 font-medium tracking-widest [writing-mode:vertical-rl] rotate-180">
                  AGENT CHAT
                </span>
              </div>
            )}
          </motion.div>

          {/* ── CENTER: 3D Workspace ────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50 p-4 space-y-4">

            {/* Agent Reasoning Visualization — shows pipeline progress visually */}
            {(isRunning || session.status === "completed") && session.messages.length > 0 && (
              <AgentReasoningCards
                activeNode={activeNode}
                messages={session.messages}
                completed={session.status === "completed"}
              />
            )}

            {/* 3D Structure Viewer (HERO) */}
            {session.alphafold_results.length > 0 ? (
              <div>
                {session.alphafold_results.map((r) => (
                  <div key={r.accession} className="mb-4">
                    {r.pdb_url ? (
                      <MolstarViewer
                        pdbUrl={r.pdb_url}
                        proteinName={r.protein_name}
                        accession={r.accession}
                        alphafoldUrl={r.alphafold_url}
                        height={420}
                        perResiduePlddt={r.per_residue_plddt}
                        bindingInterface={session.binding_interface}
                      />
                    ) : (
                      <AlphaFoldCard result={r} />
                    )}

                    {/* pLDDT telemetry bar below viewer */}
                    {r.per_residue_plddt && r.per_residue_plddt.length > 0 && (
                      <div className="mt-2">
                        <ConfidenceTelemetry
                          residues={r.per_residue_plddt}
                          proteinName={r.protein_name}
                          maxHeight={160}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Binding Interface Summary — show why/how proteins bind */}
                {session.binding_interface && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-violet-100 bg-violet-50/50 flex items-center gap-2">
                      <Zap size={12} className="text-violet-600" />
                      <span className="text-[12px] font-bold text-violet-800">Binding Interface Analysis</span>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5 text-center">
                          <p className="text-[18px] font-bold text-violet-700">
                            {(session.binding_interface.interface_residues_a?.length || 0) +
                              (session.binding_interface.interface_residues_b?.length || 0)}
                          </p>
                          <p className="text-[9px] text-violet-500 font-medium">Interface Residues</p>
                        </div>
                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
                          <p className="text-[18px] font-bold text-blue-700">
                            {session.binding_interface.hydrogen_bonds?.length || 0}
                          </p>
                          <p className="text-[9px] text-blue-500 font-medium">H-Bonds</p>
                        </div>
                        <div className="rounded-lg bg-teal-50 border border-teal-100 p-2.5 text-center">
                          <p className="text-[18px] font-bold text-teal-700">
                            {session.binding_interface.interface_area_sq_angstrom?.toFixed(0) || "?"}
                          </p>
                          <p className="text-[9px] text-teal-500 font-medium">Area (A²)</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-center">
                          <p className="text-[14px] font-bold text-amber-700 capitalize">
                            {session.binding_interface.binding_type || "—"}
                          </p>
                          <p className="text-[9px] text-amber-500 font-medium">Binding Type</p>
                        </div>
                      </div>
                      {session.binding_interface.description && (
                        <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                          {session.binding_interface.description}
                        </p>
                      )}
                      {session.binding_interface.hydrogen_bonds && session.binding_interface.hydrogen_bonds.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Key Hydrogen Bonds</p>
                          <div className="flex flex-wrap gap-1.5">
                            {session.binding_interface.hydrogen_bonds.slice(0, 8).map((bond, i) => (
                              <span key={i} className="rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-mono text-blue-700">
                                {bond.donor} → {bond.acceptor} ({bond.estimated_distance_angstrom.toFixed(1)}A)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : isRunning ? (
              /* Placeholder while waiting for structures */
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center" style={{ height: 200 }}>
                <div className="text-center">
                  <motion.div className="mx-auto mb-3 relative w-16 h-16">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-dashed border-teal-200"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute inset-3 rounded-full border border-dashed border-blue-200"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    />
                    <Atom size={20} className="absolute inset-0 m-auto text-teal-500" />
                  </motion.div>
                  <p className="text-[12px] text-slate-500 font-medium">Awaiting structural data…</p>
                  <p className="text-[10px] text-slate-400 mt-1">AlphaFold predictions will render here</p>
                </div>
              </div>
            ) : null}

            {/* Decision Node (human-in-the-loop) — shows when critic is active */}
            {showDecisionNode && session.critique && (
              <DecisionNode
                critique={session.critique}
                onApprove={() => {/* Pipeline continues automatically */}}
                onRevise={() => {/* Would trigger revision loop */}}
              />
            )}

            {/* Knowledge Graph */}
            {kgData && kgData.elements && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                  <Network size={12} className="text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-700">Knowledge Graph</span>
                  <span className="text-[9px] text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                    {kgData.elements.nodes?.length || 0} nodes
                  </span>
                </div>
                <NetworkGraph
                  data={kgData}
                  height={300}
                  showLegend={true}
                />
              </div>
            )}

            {/* Binding Energy Heatmap */}
            {session.binding_energy_matrix && session.binding_energy_matrix.rows && session.binding_energy_matrix.rows.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Residue Interaction Energy Map
                </p>
                <BindingHeatmap matrix={session.binding_energy_matrix} />
              </div>
            )}

            {/* Lead Compounds */}
            {session.lead_compounds && session.lead_compounds.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
                <LeadCompoundsPanel compounds={session.lead_compounds} />
              </div>
            )}

            {/* Final Summary */}
            {session.final_summary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-emerald-600" />
                  <p className="text-[12px] font-bold text-emerald-800">Synthesis Complete</p>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{session.final_summary}</p>
              </motion.div>
            )}

            {/* Experiment Alternatives — shown after completion */}
            {session.status === "completed" && (
              <ExperimentAlternatives
                session={session}
                onSelectQuery={(q) => {
                  setQuery(q);
                  // Scroll to top so user sees the query input
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
          </div>

          {/* ── RIGHT: Analysis Panel ───────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto p-3 space-y-3">

            {/* Pipeline Graph */}
            {(isRunning || session.status === "completed") && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Pipeline</p>
                <div className="space-y-0">
                  {PIPELINE_NODES.map((node, i) => {
                    const activeIdx = activeNode ? PIPELINE_NODES.findIndex((n) => n.id === activeNode) : -1;
                    const isDone = session.status === "completed" || (activeIdx >= 0 && i < activeIdx);
                    const isActive = session.status !== "completed" && node.id === activeNode;
                    const isPending = session.status !== "completed" && (activeIdx < 0 || i > activeIdx);
                    const Icon = node.Icon;

                    return (
                      <div key={node.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className={clsx(
                              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
                              isDone && "border-emerald-500 bg-emerald-50",
                              isActive && "border-current bg-white shadow-sm",
                              isPending && "border-slate-200 bg-slate-100",
                            )}
                            style={isActive ? { borderColor: node.color } : undefined}
                          >
                            {isDone ? (
                              <CheckCircle2 size={9} className="text-emerald-500" />
                            ) : isActive ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              >
                                <Loader2 size={8} style={{ color: node.color }} />
                              </motion.div>
                            ) : (
                              <Icon size={8} className="text-slate-400" />
                            )}
                          </div>
                          <span
                            className={clsx(
                              "text-[10px] font-medium transition-colors",
                              isDone && "text-emerald-600",
                              isActive && "text-slate-800 font-semibold",
                              isPending && "text-slate-400",
                            )}
                          >
                            {node.label}
                          </span>
                          {isActive && (
                            <motion.div
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="ml-auto w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: node.color }}
                            />
                          )}
                        </div>
                        {i < PIPELINE_NODES.length - 1 && (
                          <div className={clsx(
                            "ml-[9px] h-2 w-px",
                            isDone ? "bg-emerald-200" : "bg-slate-200",
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Entities */}
            {session.entities_found.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Entities ({session.entities_found.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {session.entities_found.map((e, i) => {
                    const cfg = ENTITY_STYLE[e.type] ?? ENTITY_STYLE.protein;
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium border"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + "30" }}
                      >
                        {e.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AlphaFold summary cards (compact) */}
            {session.alphafold_results.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Structures ({session.alphafold_results.length})
                </p>
                <div className="space-y-1.5">
                  {session.alphafold_results.map((r) => {
                    const conf = r.mean_confidence;
                    const tierColor = conf >= 70 ? "#059669" : conf >= 50 ? "#D97706" : "#DC2626";
                    return (
                      <div key={r.accession} className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-2 py-1.5">
                        <Atom size={10} className="text-teal-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-slate-700 truncate">{r.protein_name}</p>
                          <p className="text-[8px] font-mono text-slate-400">{r.accession}</p>
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: tierColor }}>
                          {conf}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hypotheses */}
            {session.hypotheses.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Hypotheses ({session.hypotheses.length})
                </p>
                <div className="space-y-1.5">
                  {session.hypotheses.map((h, i) => (
                    <div key={i} className="flex gap-1.5">
                      <span className="flex-shrink-0 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-100 text-[7px] font-bold text-violet-600">
                        {i + 1}
                      </span>
                      <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-3">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critic verdict */}
            {session.critique && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 mb-1.5">
                  Critic Review
                </p>
                <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-4">{session.critique}</p>
              </div>
            )}

            {/* Graph Insights */}
            {session.graph_insights?.summary && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Graph Insights
                </p>
                <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-3">{session.graph_insights.summary}</p>
                {session.graph_insights.research_opportunities && session.graph_insights.research_opportunities.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {session.graph_insights.research_opportunities.slice(0, 2).map((opp, i) => (
                      <div key={i} className="rounded bg-blue-50 border border-blue-100 px-2 py-1">
                        <p className="text-[9px] font-semibold text-blue-600">{opp.entity}</p>
                        <p className="text-[8px] text-blue-400">{opp.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Docking Results */}
            {session.docking_results && session.docking_results.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Docking ({session.docking_results.length})
                </p>
                <div className="space-y-1.5">
                  {session.docking_results.map((d, i) => {
                    const scoreColor = d.tier === "favorable" ? "#059669" : d.tier === "moderate" ? "#D97706" : "#DC2626";
                    return (
                      <div key={i} className="rounded-md bg-white border border-slate-200 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-medium text-slate-700 truncate">{d.compound}</p>
                          <span className="text-[9px] font-bold" style={{ color: scoreColor }}>
                            {(d.overall_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${d.overall_score * 100}%`, backgroundColor: scoreColor }}
                          />
                        </div>
                        <p className="text-[8px] mt-1 text-slate-400">→ {d.target}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Validation Plans */}
            {session.validation_plan?.validation_plans && session.validation_plan.validation_plans.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Validation ({session.validation_plan.validation_plans.length})
                </p>
                <div className="space-y-1.5">
                  {session.validation_plan.validation_plans.map((vp, i) => {
                    const feasColor = vp.feasibility === "high" ? "#059669" : vp.feasibility === "medium" ? "#D97706" : "#DC2626";
                    return (
                      <div key={i} className="rounded-md bg-white border border-slate-200 p-2">
                        <p className="text-[10px] font-medium text-slate-700">{vp.experiment_name}</p>
                        <p className="text-[8px] text-slate-400">{vp.assay_type} · {vp.model_system}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="text-[8px] font-medium px-1 py-0.5 rounded"
                            style={{ backgroundColor: feasColor + "18", color: feasColor }}
                          >
                            {vp.feasibility}
                          </span>
                          <span className="text-[8px] text-slate-400">{vp.estimated_timeline}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session info (bottom) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Session</p>
              <p className="text-[8px] font-mono text-slate-500 truncate">{session.session_id}</p>
              <p className="text-[8px] text-slate-400 mt-0.5">{new Date(session.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
