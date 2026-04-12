"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  Brain,
  Network,
  Atom,
  Lightbulb,
  ShieldCheck,
  Beaker,
  TestTubes,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Zap,
  type LucideProps,
} from "lucide-react";
import clsx from "clsx";
import type { AgentMessage } from "@/lib/api";

// ─── Agent definitions ─────────────────────────────────────────────────────

interface AgentTileDef {
  id: string;
  label: string;
  role: string;
  color: string;
  glow: string;
  Icon: React.ComponentType<LucideProps>;
  shortDesc: string;
}

const AGENTS: AgentTileDef[] = [
  { id: "pi_analyze",  label: "Principal Investigator", role: "PI",  color: "#0F766E", glow: "rgba(15,118,110,0.25)", Icon: Brain,      shortDesc: "Parsing query & entities" },
  { id: "insight",     label: "Knowledge Graph",        role: "KG",  color: "#2563EB", glow: "rgba(37,99,235,0.25)",  Icon: Network,    shortDesc: "Mapping relationships" },
  { id: "alphafold",   label: "Structural Prediction",  role: "AF",  color: "#0891B2", glow: "rgba(8,145,178,0.25)",  Icon: Atom,       shortDesc: "Protein fold analysis" },
  { id: "hypothesis",  label: "Hypothesis Engine",      role: "HYP", color: "#7C3AED", glow: "rgba(124,58,237,0.25)", Icon: Lightbulb,  shortDesc: "Generating hypotheses" },
  { id: "critic",      label: "Peer Review",            role: "CR",  color: "#D97706", glow: "rgba(217,119,6,0.25)",  Icon: ShieldCheck, shortDesc: "Evaluating rigor" },
  { id: "docking",     label: "Molecular Docking",      role: "DOC", color: "#059669", glow: "rgba(5,150,105,0.25)",  Icon: Beaker,     shortDesc: "Binding affinity scoring" },
  { id: "validation",  label: "Validation Design",      role: "VAL", color: "#0D9488", glow: "rgba(13,148,136,0.25)", Icon: TestTubes,  shortDesc: "Protocol planning" },
  { id: "synthesize",  label: "Final Synthesis",        role: "SYN", color: "#6D28D9", glow: "rgba(109,40,217,0.25)", Icon: Sparkles,   shortDesc: "Compiling conclusions" },
];

// ─── Layout positions: agents arrange in a grid pattern ──────────────────

// Idle layout: 2 rows of 4, evenly spaced (percentages of container)
const GRID_POSITIONS = [
  { x: 12, y: 20 }, { x: 37, y: 20 }, { x: 62, y: 20 }, { x: 87, y: 20 },
  { x: 12, y: 70 }, { x: 37, y: 70 }, { x: 62, y: 70 }, { x: 87, y: 70 },
];

// When active, the active tile moves to center stage, done tiles cluster left, pending right
function getActiveLayout(activeIdx: number, count: number) {
  const positions: { x: number; y: number; scale: number; zIndex: number }[] = [];
  const doneIdxs: number[] = [];
  const pendingIdxs: number[] = [];

  for (let i = 0; i < count; i++) {
    if (i < activeIdx) doneIdxs.push(i);
    else if (i > activeIdx) pendingIdxs.push(i);
  }

  // Done tiles: stack in left column
  doneIdxs.forEach((idx, di) => {
    const row = di % 4;
    const col = Math.floor(di / 4);
    positions[idx] = {
      x: 8 + col * 14,
      y: 15 + row * 22,
      scale: 0.75,
      zIndex: 1,
    };
  });

  // Active tile: center stage, enlarged
  positions[activeIdx] = {
    x: 50,
    y: 45,
    scale: 1.15,
    zIndex: 10,
  };

  // Pending tiles: stack in right column
  pendingIdxs.forEach((idx, pi) => {
    const row = pi % 4;
    const col = Math.floor(pi / 4);
    positions[idx] = {
      x: 82 - col * 14,
      y: 15 + row * 22,
      scale: 0.7,
      zIndex: 1,
    };
  });

  return positions;
}

// Completed layout: victory formation - arc around center
function getCompletedLayout(count: number) {
  const positions: { x: number; y: number; scale: number; zIndex: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / (count - 1)) * i - Math.PI / 2;
    const radius = 34;
    positions.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.6,
      scale: 0.85,
      zIndex: 1,
    });
  }
  return positions;
}

// ─── Data flow particle ──────────────────────────────────────────────────

function DataParticle({ fromX, fromY, toX, toY, color, delay }: {
  fromX: number; fromY: number; toX: number; toY: number; color: string; delay: number;
}) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      initial={{ left: `${fromX}%`, top: `${fromY}%`, opacity: 0, scale: 0 }}
      animate={{
        left: [`${fromX}%`, `${(fromX + toX) / 2}%`, `${toX}%`],
        top: [`${fromY}%`, `${(fromY + toY) / 2 - 8}%`, `${toY}%`],
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 1.4,
        delay,
        repeat: Infinity,
        repeatDelay: 2,
        ease: "easeInOut",
      }}
    />
  );
}

// ─── Connection line between tiles ────────────────────────────────────────

function ConnectionLine({ x1, y1, x2, y2, active }: {
  x1: number; y1: number; x2: number; y2: number; active: boolean;
}) {
  return (
    <motion.line
      x1={`${x1}%`} y1={`${y1}%`}
      x2={`${x2}%`} y2={`${y2}%`}
      stroke={active ? "#0F766E" : "#E2E8F0"}
      strokeWidth={active ? 1.5 : 0.75}
      strokeDasharray={active ? "none" : "4 4"}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: active ? 0.6 : 0.25 }}
      transition={{ duration: 0.8 }}
    />
  );
}

// ─── Single Agent Tile ───────────────────────────────────────────────────

function AgentTile({
  agent,
  state,
  x,
  y,
  scale,
  zIndex,
  messageCount,
  latestMessage,
}: {
  agent: AgentTileDef;
  state: "idle" | "active" | "done" | "pending";
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  messageCount: number;
  latestMessage?: string;
}) {
  const Icon = agent.Icon;
  const isActive = state === "active";
  const isDone = state === "done";
  const isPending = state === "pending" || state === "idle";

  return (
    <motion.div
      layout
      className="absolute"
      style={{ zIndex }}
      animate={{
        left: `${x}%`,
        top: `${y}%`,
        scale,
        x: "-50%",
        y: "-50%",
      }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 20,
        mass: 0.8,
      }}
    >
      {/* Glow ring for active agent */}
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: `0 0 30px ${agent.glow}, 0 0 60px ${agent.glow}` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -inset-3 rounded-3xl border-2 border-dashed"
            style={{ borderColor: agent.color + "40" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}

      {/* Tile body */}
      <motion.div
        className={clsx(
          "relative rounded-2xl border-2 backdrop-blur-sm overflow-hidden transition-colors",
          isActive && "bg-white shadow-xl",
          isDone && "bg-white/90 shadow-md",
          isPending && "bg-white/60 shadow-sm",
        )}
        style={{
          borderColor: isDone ? "#059669" : isActive ? agent.color : "#E2E8F0",
          width: isActive ? 200 : 150,
          minHeight: isActive ? 130 : 90,
        }}
        whileHover={{ scale: 1.05, y: -2 }}
        transition={{ duration: 0.15 }}
      >
        {/* Top accent bar */}
        <motion.div
          className="h-1 w-full"
          style={{ backgroundColor: isDone ? "#059669" : isActive ? agent.color : "#E2E8F0" }}
          animate={isActive ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        <div className="p-3">
          {/* Header: icon + role badge */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                isDone && "bg-emerald-50",
                isActive && "bg-opacity-10",
                isPending && "bg-slate-50",
              )}
              style={isActive ? { backgroundColor: agent.color + "15" } : undefined}
            >
              {isDone ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle2 size={16} className="text-emerald-500" />
                </motion.div>
              ) : isActive ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 size={16} style={{ color: agent.color }} />
                </motion.div>
              ) : (
                <Icon size={14} className="text-slate-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={clsx(
                "text-[11px] font-bold truncate",
                isDone && "text-emerald-700",
                isActive && "text-slate-900",
                isPending && "text-slate-400",
              )}>
                {agent.label}
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    backgroundColor: isDone ? "#05966920" : isActive ? agent.color + "15" : "#F1F5F9",
                    color: isDone ? "#059669" : isActive ? agent.color : "#94A3B8",
                  }}
                >
                  {agent.role}
                </span>
                {isActive && (
                  <motion.div
                    className="flex gap-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="inline-block h-1 w-1 rounded-full"
                        style={{ backgroundColor: agent.color }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Status / message preview */}
          {isActive && latestMessage && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-[9px] text-slate-500 leading-relaxed line-clamp-2 mt-1 border-t border-slate-100 pt-2"
            >
              {latestMessage.length > 100 ? latestMessage.slice(0, 100) + "…" : latestMessage}
            </motion.p>
          )}

          {isDone && messageCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 mt-1"
            >
              <Zap size={8} className="text-emerald-500" />
              <span className="text-[9px] text-emerald-600 font-medium">{messageCount} steps complete</span>
            </motion.div>
          )}

          {isPending && (
            <p className="text-[9px] text-slate-400 mt-1">{agent.shortDesc}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Workspace ──────────────────────────────────────────────────────

export default function AgentTilesWorkspace({
  activeNode,
  messages,
  completed,
}: {
  activeNode: string | null;
  messages: AgentMessage[];
  completed: boolean;
}) {
  const activeIdx = activeNode ? AGENTS.findIndex((a) => a.id === activeNode) : -1;
  const [pulse, setPulse] = useState(0);

  // Animate a subtle pulse counter
  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => p + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  // Group messages by pipeline stage (same logic as AgentReasoningCards)
  const stageMessages = useMemo(() => {
    const map: Record<string, AgentMessage[]> = {};
    for (const msg of messages) {
      const nodeMap: Record<string, string> = {
        orchestrator: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "alphafold" : "pi_analyze",
        specialist: "hypothesis",
        critic: "critic",
        analyst: "insight",
        experimentalist: msg.message_type === "tool_call" || msg.message_type === "tool_result" ? "docking" : "validation",
      };
      const stage = msg.message_type === "final" ? "synthesize" : (nodeMap[msg.agent_role] ?? "pi_analyze");
      if (!map[stage]) map[stage] = [];
      map[stage].push(msg);
    }
    return map;
  }, [messages]);

  // Calculate positions
  const positions = useMemo(() => {
    if (completed) return getCompletedLayout(AGENTS.length);
    if (activeIdx >= 0) return getActiveLayout(activeIdx, AGENTS.length);
    // Idle: grid
    return GRID_POSITIONS.map((p) => ({ ...p, scale: 0.9, zIndex: 1 }));
  }, [activeIdx, completed]);

  // Determine which connections to draw (sequential flow)
  const connections = useMemo(() => {
    const lines: { from: number; to: number; active: boolean }[] = [];
    for (let i = 0; i < AGENTS.length - 1; i++) {
      const iDone = completed || (activeIdx >= 0 && i < activeIdx);
      const iActive = !completed && i === activeIdx;
      const nextActive = !completed && i + 1 === activeIdx;
      lines.push({ from: i, to: i + 1, active: iDone || iActive || nextActive });
    }
    return lines;
  }, [activeIdx, completed]);

  return (
    <div className="relative w-full rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden" style={{ height: 380 }}>
      {/* Background grid dots */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between z-20 bg-white/70 backdrop-blur-sm border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {!completed && activeIdx >= 0 && (
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: AGENTS[activeIdx].color }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {completed && <CheckCircle2 size={12} className="text-emerald-500" />}
          </div>
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Agent Workspace
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">
            {completed ? "All agents complete" : activeIdx >= 0 ? `Stage ${activeIdx + 1}/${AGENTS.length}` : "Initializing…"}
          </span>
          {!completed && activeIdx >= 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100">
              {AGENTS.map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: i < activeIdx ? "#059669" : i === activeIdx ? AGENTS[i].color : "#CBD5E1",
                  }}
                  animate={i === activeIdx ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SVG connections layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
        {connections.map(({ from, to, active }) => {
          const p1 = positions[from];
          const p2 = positions[to];
          if (!p1 || !p2) return null;
          return (
            <ConnectionLine
              key={`${from}-${to}`}
              x1={p1.x} y1={p1.y}
              x2={p2.x} y2={p2.y}
              active={active}
            />
          );
        })}
      </svg>

      {/* Data flow particles between active connections */}
      {!completed && activeIdx >= 0 && activeIdx > 0 && (
        <DataParticle
          fromX={positions[activeIdx - 1]?.x ?? 0}
          fromY={positions[activeIdx - 1]?.y ?? 0}
          toX={positions[activeIdx]?.x ?? 0}
          toY={positions[activeIdx]?.y ?? 0}
          color={AGENTS[activeIdx].color}
          delay={0}
        />
      )}

      {/* Agent tiles */}
      <AnimatePresence>
        {AGENTS.map((agent, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const isDone = completed || (activeIdx >= 0 && i < activeIdx);
          const isActive = !completed && i === activeIdx;
          const state: "idle" | "active" | "done" | "pending" = completed ? "done" : isDone ? "done" : isActive ? "active" : activeIdx >= 0 ? "pending" : "idle";
          const msgs = stageMessages[agent.id] || [];
          const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1].content : undefined;

          return (
            <AgentTile
              key={agent.id}
              agent={agent}
              state={state}
              x={pos.x}
              y={pos.y}
              scale={pos.scale}
              zIndex={pos.zIndex}
              messageCount={msgs.length}
              latestMessage={latestMsg}
            />
          );
        })}
      </AnimatePresence>

      {/* Completed celebration overlay */}
      {completed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-4 left-0 right-0 flex justify-center z-20"
        >
          <motion.div
            initial={{ y: 20, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-lg"
          >
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-[12px] font-bold text-emerald-700">All Agents Complete</span>
            <span className="text-[10px] text-emerald-500">{messages.length} total steps</span>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
