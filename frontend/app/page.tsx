"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked,
  Braces,
  Activity,
  BarChart2,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  FlaskConical,
  Dna,
  Pill,
  AlertCircle,
  GitBranch,
  TrendingUp,
  type LucideProps,
} from "lucide-react";
import MetricCard from "@/components/MetricCard";
import PipelineHealth from "@/components/PipelineHealth";
import StudyCard from "@/components/StudyCard";
import EntityExplorer from "@/components/EntityExplorer";
import {
  fetchStudies,
  runIngestion,
  fetchDashboardMetrics,
  fetchTrendingEntities,
  type Study,
  type DashboardMetrics,
  type TrendingEntity,
} from "@/lib/api";
import clsx from "clsx";

// ─── Toast notification ───────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}

function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className={clsx("toast", type === "success" ? "toast-success" : "toast-error")}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {type === "success" ? (
          <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
        ) : (
          <XCircle size={15} className="text-red-500 flex-shrink-0" />
        )}
        {message}
      </div>
    </motion.div>
  );
}

// ─── Trending entities widget ──────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  gene: Dna,
  protein: FlaskConical,
  compound: Pill,
  disease: AlertCircle,
  pathway: GitBranch,
};

const ENTITY_STYLES: Record<string, { color: string; bg: string }> = {
  gene:     { color: "#6D28D9", bg: "#F5F3FF" },
  protein:  { color: "#0369A1", bg: "#F0F9FF" },
  compound: { color: "#15803D", bg: "#F0FDF4" },
  disease:  { color: "#B91C1C", bg: "#FEF2F2" },
  pathway:  { color: "#B45309", bg: "#FFFBEB" },
};

function TrendingEntities({ entities }: { entities: TrendingEntity[] }) {
  const maxCount = entities.length > 0 ? entities[0].count : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Trending Entities</h2>
        </div>
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">All studies</span>
      </div>

      {entities.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs text-slate-400">No entities extracted yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {entities.map((item, i) => {
            const Icon = ENTITY_ICONS[item.type] ?? FlaskConical;
            const style = ENTITY_STYLES[item.type] ?? ENTITY_STYLES.protein;
            const pct = (item.count / maxCount) * 100;

            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors duration-100"
              >
                <span className="text-[11px] text-slate-400 w-4 flex-shrink-0 text-right font-mono">
                  {i + 1}
                </span>
                <div
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: style.bg }}
                >
                  <Icon size={11} style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-800 truncate">{item.name}</span>
                    <span className="text-[10px] font-bold text-slate-700 data-mono flex-shrink-0 ml-2">{item.count}</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: style.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.04 + 0.2, duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccession, setSelectedAccession] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trending, setTrending] = useState<TrendingEntity[]>([]);

  const loadStudies = useCallback(async () => {
    setLoading(true);
    const data = await fetchStudies();
    setStudies(data);
    if (data.length > 0 && !selectedAccession) {
      setSelectedAccession(data[0].accession);
    }
    setLoading(false);
  }, [selectedAccession]);

  useEffect(() => {
    loadStudies();
    fetchDashboardMetrics().then((m) => { if (m) setMetrics(m); });
    fetchTrendingEntities().then(setTrending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunIngestion = async () => {
    setRunning(true);
    try {
      const result = await runIngestion();
      setToast({
        message: result.message ?? "Ingestion started successfully",
        type: result.success ? "success" : "error",
      });
    } catch {
      setToast({ message: "Failed to trigger ingestion", type: "error" });
    } finally {
      setRunning(false);
    }
  };

  function fmtCount(n: number): string {
    if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }

  const s = metrics;
  const METRIC_CARDS = [
    {
      title: "Studies Indexed",
      value: s ? fmtCount(s.studies_indexed) : "—",
      delta: "",
      icon: BookMarked,
      color: "teal" as const,
      sparklineData: s ? [s.studies_indexed] : [],
    },
    {
      title: "Entities Extracted",
      value: s ? fmtCount(s.entities_extracted) : "—",
      delta: "",
      icon: Braces,
      color: "blue" as const,
      sparklineData: s ? [s.entities_extracted] : [],
    },
    {
      title: "Pipeline Uptime",
      value: s ? `${s.pipeline_uptime}%` : "—",
      delta: "",
      icon: Activity,
      color: "emerald" as const,
      sparklineData: s ? [s.pipeline_uptime] : [],
    },
    {
      title: "Avg Confidence",
      value: s ? `${s.avg_confidence}%` : "—",
      delta: "",
      icon: BarChart2,
      color: "violet" as const,
      sparklineData: s ? [s.avg_confidence] : [],
    },
  ];

  return (
    <div className="min-h-full p-6 lg:p-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Data Intelligence Platform
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time biomedical study ingestion and entity extraction
          </p>
        </div>

        <motion.button
          onClick={handleRunIngestion}
          disabled={running}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          aria-label="Run ingestion pipeline"
        >
          {running ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {running ? "Triggering…" : "Run Ingestion"}
        </motion.button>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {METRIC_CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <MetricCard {...card} loading={loading} />
          </motion.div>
        ))}
      </div>

      {/* Pipeline Health — full width */}
      <div className="mb-6 section-panel section-accent-teal rounded-xl">
        <PipelineHealth />
      </div>

      {/* Bottom row: Study grid + Trending + Entity Explorer */}
      <div className="flex flex-col xl:flex-row gap-5 min-h-0">
        {/* Studies grid — ~50% */}
        <div className="xl:flex-[3] min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Studies</h2>
            <span className="text-xs text-slate-400">
              {studies.length} studies loaded
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shimmer h-40 rounded-xl" />
                ))
              : studies.map((study) => (
                  <div
                    key={study.accession}
                    onClick={() => setSelectedAccession(study.accession)}
                  >
                    <StudyCard
                      study={study}
                      isSelected={study.accession === selectedAccession}
                    />
                  </div>
                ))}
          </div>
        </div>

        {/* Right column: Trending + Entity Explorer */}
        <div className="xl:flex-[2] min-w-0 flex flex-col gap-5">
          <TrendingEntities entities={trending} />

          {selectedAccession ? (
            <div className="flex-1 min-h-[400px] section-panel section-accent-blue rounded-xl">
              <EntityExplorer accession={selectedAccession} compact />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-slate-300 bg-white shadow-sm">
              <p className="text-sm text-slate-400">Select a study to explore entities</p>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
