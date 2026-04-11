"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Database,
  Cpu,
  Network,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  type LucideProps,
} from "lucide-react";
import clsx from "clsx";
import { fetchPipelineStatus, type PipelineStatus, type PipelineStage } from "@/lib/api";

// ─── Stage icon map ───────────────────────────────────────────────────────────

const STAGE_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  ingest: Download,
  store: Database,
  process: Cpu,
  index: Network,
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<LucideProps> }
> = {
  active: {
    label: "Active",
    color: "#059669",
    bg: "#F0FDF4",
    border: "#86EFAC",
    Icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    Icon: Clock,
  },
  error: {
    label: "Error",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    Icon: XCircle,
  },
  idle: {
    label: "Idle",
    color: "#94A3B8",
    bg: "#F8FAFC",
    border: "#CBD5E1",
    Icon: AlertTriangle,
  },
};

// ─── Mini bar chart ───────────────────────────────────────────────────────────

interface MiniBarChartProps {
  data: number[];
}

function MiniBarChart({ data }: MiniBarChartProps) {
  const max = Math.max(...data, 1);
  const labels = Array.from({ length: 12 }, (_, i) => {
    const h = new Date();
    h.setHours(h.getHours() - (11 - i));
    return `${h.getHours()}:00`;
  });

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
        Studies Ingested / Hour — Last 12h
      </p>
      <div className="flex items-end gap-[3px] h-16" role="img" aria-label="Bar chart: studies ingested per hour">
        {data.map((val, i) => {
          const pct = (val / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <motion.div
              key={i}
              className="relative flex-1 group"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
              style={{ transformOrigin: "bottom" }}
            >
              <div
                className={clsx(
                  "w-full rounded-t-sm transition-colors duration-150",
                  isLast ? "bg-brand-500" : "bg-slate-200 group-hover:bg-brand-300"
                )}
                style={{ height: `${pct}%`, minHeight: 2 }}
                title={`${labels[i]}: ${val} studies`}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-slate-400">{labels[0]}</span>
        <span className="text-[9px] text-slate-400">{labels[11]}</span>
      </div>
    </div>
  );
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <motion.span
        className="absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ─── Stage card ───────────────────────────────────────────────────────────────

interface StageCardProps {
  stage: PipelineStage;
  index: number;
  isLast: boolean;
}

function StageCard({ stage, index, isLast }: StageCardProps) {
  const cfg = STATUS_CONFIG[stage.status];
  const Icon = STAGE_ICONS[stage.id] ?? Database;

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.08 }}
        className="flex-1 min-w-0 rounded-xl border bg-white p-4"
        style={{ borderColor: cfg.border }}
      >
        {/* Stage header */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: cfg.bg }}
          >
            <Icon size={17} style={{ color: cfg.color }} />
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {stage.status === "active" || stage.status === "processing" ? (
              <PulsingDot color={cfg.color} />
            ) : (
              <cfg.Icon size={9} />
            )}
            {cfg.label}
          </div>
        </div>

        {/* Label */}
        <p className="text-sm font-semibold text-slate-900 mb-0.5">{stage.label}</p>
        <p className="text-[10px] text-slate-500 mb-3">{stage.source}</p>

        {/* Records */}
        <p className="text-lg font-bold data-mono" style={{ color: cfg.color }}>
          {stage.recordsProcessed.toLocaleString()}
        </p>
        <p className="text-[10px] text-slate-400">records processed</p>
      </motion.div>

      {/* Flow arrow */}
      {!isLast && (
        <div className="relative flex flex-col items-center flex-shrink-0">
          <div className="h-[1px] w-6 bg-slate-200 relative overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, transparent, #0F766E, transparent)" }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <ChevronRight size={12} className="text-slate-300 mt-0.5" />
        </div>
      )}
    </div>
  );
}

// ─── PipelineHealth ───────────────────────────────────────────────────────────

interface PipelineHealthProps {
  compact?: boolean;
}

export default function PipelineHealth({ compact = false }: PipelineHealthProps) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchPipelineStatus();
    setStatus(data);
    setLastRefreshed(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading || !status) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="shimmer h-6 w-40 rounded mb-6" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <PulsingDot color={status.isRunning ? "#059669" : "#94A3B8"} />
            <h2 className="text-sm font-semibold text-slate-900">Pipeline Health</h2>
          </div>
          <span className={clsx(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            status.isRunning
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-slate-100 border border-slate-200 text-slate-500"
          )}>
            {status.isRunning ? "Live" : "Paused"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            aria-label="Refresh pipeline status"
          >
            <RefreshCw size={12} className={clsx(refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Stage flow */}
        <div className="flex items-start gap-0 mb-6">
          {status.stages.map((stage, i) => (
            <StageCard
              key={stage.id}
              stage={stage}
              index={i}
              isLast={i === status.stages.length - 1}
            />
          ))}
        </div>

        {/* Bar chart */}
        {!compact && <MiniBarChart data={status.hourlyIngestion} />}
      </div>
    </motion.div>
  );
}
