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
  fetchKGSubgraph,
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
      return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">{seg.slice(1, -1)}</code>;
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

// ─── Virtual Lab page ─────────────────────────────────────────────────────────

export default function LabPage() {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<LabSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cleanupStreamRef = useRef<(() => void) | null>(null);

  // Auto-scroll timeline
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [session?.messages.length]);

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
          // Detect active pipeline node from agent role + message type
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
            graph_insights: data.graph_insights ?? {},
            hypotheses: data.hypotheses,
            critique: data.critique,
            docking_results: data.docking_results ?? [],
            validation_plan: data.validation_plan ?? ({} as ValidationPlan),
            final_summary: data.final_summary,
          };
        });
      },
      onDone: (fullSession) => {
        setSession(fullSession);
        setActiveNode(null);
      },
      onError: () => {
        // Fallback to single fetch on SSE error
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
    stopStream();

    const result = await startLabSession(query.trim());
    if (!result) {
      setError("Could not reach the backend. Make sure the BioStream server is running.");
      setLoading(false);
      return;
    }

    // Bootstrap the session UI immediately
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-300 bg-white px-6 py-5 section-panel" style={{ borderRadius: 0, boxShadow: "none" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                <FlaskConical size={14} className="text-brand-700" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Virtual Research Lab</h1>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 tracking-wide">
                AI AGENTS
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Multi-agent pipeline: PI → Insight → AlphaFold → Hypothesis → Critic → Docking → Validation → Synthesis
            </p>
          </div>
          {session && <StatusBadge status={session.status} />}
        </div>

        {/* Query input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isRunning && !loading && handleRun()}
            placeholder="Describe your research question…"
            disabled={isRunning || loading}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200 disabled:opacity-50 transition-colors duration-150"
          />
          <motion.button
            onClick={handleRun}
            disabled={!query.trim() || isRunning || loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
          >
            {loading || isRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {isRunning ? "Running…" : "Run Lab"}
          </motion.button>
        </div>

        {/* Example queries */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              disabled={isRunning || loading}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-all duration-150 disabled:opacity-40"
            >
              {q.length > 55 ? q.slice(0, 55) + "…" : q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <XCircle size={15} className="flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ────────────────────────────────────────────────── */}
      {!session ? (
        /* Empty state */
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200">
                <Brain size={28} className="text-brand-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Ready to run your virtual lab</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Enter a research question above. The PI agent will parse it, dispatch specialist agents,
              fetch AlphaFold structural predictions, generate hypotheses, and run adversarial peer review.
            </p>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {[
                { label: "PI Orchestrator", color: "#0F766E", Icon: Brain },
                { label: "Insight Agent", color: "#2563EB", Icon: Network },
                { label: "Hypothesis Agent", color: "#7C3AED", Icon: Lightbulb },
                { label: "Critic Agent", color: "#D97706", Icon: ShieldCheck },
                { label: "Validation Agent", color: "#059669", Icon: TestTubes },
              ].map(({ label, color, Icon }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-card">
                  <div
                    className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: color }}
                  >
                    <Icon size={14} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-700">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-0">
          {/* ── Agent timeline (left) ──────────────────────────────────── */}
          <div
            ref={timelineRef}
            className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4 border-r border-slate-200 bg-white"
          >
            {/* Query banner */}
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex items-center gap-3">
              <FlaskConical size={14} className="text-brand-600 flex-shrink-0" />
              <p className="text-sm font-medium text-brand-800">"{session.query}"</p>
            </div>

            {/* Messages */}
            <AnimatePresence initial={false}>
              {session.messages.map((msg) => (
                <AgentBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>

            {/* Running indicator */}
            {isRunning && session.messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 pl-10 text-[11px] text-slate-400"
              >
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </span>
                Agent thinking…
              </motion.div>
            )}

            {/* Empty running state */}
            {isRunning && session.messages.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 size={24} className="animate-spin text-brand-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Initializing agents…</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel ────────────────────────────────────────────── */}
          <div className="w-80 flex-shrink-0 overflow-y-auto bg-slate-50 p-4 space-y-4 border-l border-slate-200">
            {/* Session info */}
            <div className="section-panel p-4 section-accent-teal">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Session</p>
              <p className="text-[11px] font-mono text-slate-500 mb-2">{session.session_id}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{new Date(session.created_at).toLocaleTimeString()}</span>
                <StatusBadge status={session.status} />
              </div>
              {session.messages.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-2">{session.messages.length} agent messages</p>
              )}
            </div>

            {/* Agent Pipeline Graph */}
            {(isRunning || session.status === "completed") && (
              <PipelineGraph
                activeNode={activeNode}
                completed={session.status === "completed"}
              />
            )}

            {/* Entities */}
            {session.entities_found.length > 0 && (
              <div className="section-panel p-4 section-accent-blue">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Identified Entities ({session.entities_found.length})
                </p>
                <EntityList entities={session.entities_found} />
              </div>
            )}

            {/* AlphaFold 3D structures (Mol* viewer) */}
            {session.alphafold_results.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3 px-1">
                  3D Structures ({session.alphafold_results.length})
                </p>
                {session.alphafold_results.map((r) => (
                  <div key={r.accession} className="mb-3">
                    {r.pdb_url ? (
                      <MolstarViewer
                        pdbUrl={r.pdb_url}
                        proteinName={r.protein_name}
                        accession={r.accession}
                        alphafoldUrl={r.alphafold_url}
                        height={260}
                      />
                    ) : (
                      <AlphaFoldCard result={r} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Hypotheses summary */}
            {session.hypotheses.length > 0 && (
              <div className="section-panel p-4 section-accent-violet">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Hypotheses ({session.hypotheses.length})
                </p>
                <div className="space-y-2">
                  {session.hypotheses.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="flex-shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
                        {i + 1}
                      </span>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critic verdict */}
            {session.critique && (
              <div className="section-panel p-4 section-accent-amber">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Critic Verdict
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed">{session.critique}</p>
              </div>
            )}

            {/* Graph Insights */}
            {session.graph_insights?.summary && (
              <div className="section-panel p-4 section-accent-blue">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Graph Insights
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed mb-2">{session.graph_insights.summary}</p>
                {session.graph_insights.research_opportunities && session.graph_insights.research_opportunities.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {session.graph_insights.research_opportunities.slice(0, 3).map((opp, i) => (
                      <div key={i} className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold text-blue-800">{opp.entity}</p>
                        <p className="text-[10px] text-blue-600">{opp.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Docking Results */}
            {session.docking_results && session.docking_results.length > 0 && (
              <div className="section-panel p-4 section-accent-teal">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Docking Predictions ({session.docking_results.length})
                </p>
                <div className="space-y-2">
                  {session.docking_results.map((d, i) => {
                    const scoreColor = d.tier === "favorable" ? "#059669" : d.tier === "moderate" ? "#D97706" : "#DC2626";
                    return (
                      <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-semibold text-slate-800">{d.compound}</p>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: scoreColor + "18", color: scoreColor }}
                          >
                            {(d.overall_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">→ {d.target}</p>
                        <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${d.overall_score * 100}%`, backgroundColor: scoreColor }}
                          />
                        </div>
                        <p className="text-[9px] mt-1" style={{ color: scoreColor }}>
                          {d.tier.toUpperCase()}
                          {d.smiles && ` · MW ${d.molecular_weight ?? "?"}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Validation Plans */}
            {session.validation_plan?.validation_plans && session.validation_plan.validation_plans.length > 0 && (
              <div className="section-panel p-4 section-accent-teal">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Validation Plans ({session.validation_plan.validation_plans.length})
                </p>
                <div className="space-y-2">
                  {session.validation_plan.validation_plans.map((vp, i) => {
                    const feasColor = vp.feasibility === "high" ? "#059669" : vp.feasibility === "medium" ? "#D97706" : "#DC2626";
                    return (
                      <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="text-[11px] font-semibold text-slate-800 mb-1">{vp.experiment_name}</p>
                        <p className="text-[10px] text-slate-500">{vp.assay_type} · {vp.model_system}</p>
                        <p className="text-[10px] text-slate-600 mt-1 italic">{vp.expected_outcome}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: feasColor + "18", color: feasColor }}
                          >
                            {vp.feasibility} feasibility
                          </span>
                          <span className="text-[9px] text-slate-400">{vp.estimated_timeline}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {session.validation_plan.overall_feasibility && (
                  <p className="text-[10px] text-slate-600 mt-2 italic">{session.validation_plan.overall_feasibility}</p>
                )}
              </div>
            )}

            {/* Agent legend */}
            <div className="section-panel p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Agent Legend</p>
              <div className="space-y-2">
                {[
                  { name: "PI Agent",         role: "Orchestrator",    color: "#0F766E", short: "PI",  Icon: Brain      },
                  { name: "Insight Agent",    role: "Graph analyst",   color: "#2563EB", short: "IN",  Icon: Network    },
                  { name: "Hypothesis Agent", role: "Specialist",      color: "#7C3AED", short: "HYP", Icon: Lightbulb  },
                  { name: "Critic Agent",     role: "Peer reviewer",   color: "#D97706", short: "CR",  Icon: ShieldCheck},
                  { name: "Validation Agent", role: "Experimentalist", color: "#059669", short: "VAL", Icon: TestTubes  },
                ].map(({ name, role, color, short, Icon }) => (
                  <div key={name} className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white text-[9px] font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {short}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-800">{name}</p>
                      <p className="text-[9px] text-slate-400">{role}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <Atom size={11} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-800">AlphaFold Tool</p>
                    <p className="text-[9px] text-slate-400">EBI structural prediction API</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
