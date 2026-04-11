"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import PipelineHealth from "@/components/PipelineHealth";
import {
  fetchPipelineRuns,
  fetchJobQueue,
  runIngestion,
  type PipelineRun,
  type JobQueueItem,
} from "@/lib/api";

// ─── Status config ────────────────────────────────────────────────────────────

const RUN_STATUS_CONFIG = {
  completed: {
    label: "Completed",
    color: "#059669",
    bg: "#F0FDF4",
    border: "#86EFAC",
    Icon: CheckCircle2,
  },
  running: {
    label: "Running",
    color: "#0F766E",
    bg: "#F0FDFA",
    border: "#5EEAD4",
    Icon: Loader2,
  },
  failed: {
    label: "Failed",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    Icon: XCircle,
  },
  pending: {
    label: "Pending",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    Icon: Clock,
  },
};

const JOB_STATUS_CONFIG = {
  running: { label: "Running", color: "#0F766E", bg: "#F0FDFA" },
  pending: { label: "Pending", color: "#D97706", bg: "#FFFBEB" },
  completed: { label: "Completed", color: "#059669", bg: "#F0FDF4" },
  failed: { label: "Failed", color: "#DC2626", bg: "#FEF2F2" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Log drawer ───────────────────────────────────────────────────────────────

function LogDrawer({ logs, runId }: { logs: string; runId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-700 transition-colors duration-150"
        aria-expanded={open}
        aria-controls={`logs-${runId}`}
      >
        <Terminal size={11} />
        {open ? "Hide" : "View"} Logs
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.pre
            id={`logs-${runId}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden rounded-lg bg-slate-900 border border-slate-200 p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-5"
            style={{ maxHeight: 120, overflowY: "auto" }}
          >
            {logs}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pipeline page ────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = useCallback(async () => {
    const [runsData, jobsData] = await Promise.all([fetchPipelineRuns(), fetchJobQueue()]);
    setRuns(runsData);
    setJobs(jobsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleRun = async () => {
    setTriggering(true);
    const result = await runIngestion();
    setToast({ message: result.message, type: result.success ? "success" : "error" });
    setTriggering(false);
    setTimeout(loadData, 1000);
  };

  const jobCounts = {
    running: jobs.filter((j) => j.status === "running").length,
    pending: jobs.filter((j) => j.status === "pending").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  };

  return (
    <div className="p-6 lg:p-8 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline Monitor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track ingestion runs, job queue, and pipeline stage health
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-card"
            aria-label="Refresh pipeline data"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <motion.button
            onClick={handleRun}
            disabled={triggering}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {triggering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            {triggering ? "Starting…" : "Run Now"}
          </motion.button>
        </div>
      </motion.div>

      {/* Pipeline Health widget */}
      <div className="mb-6">
        <PipelineHealth />
      </div>

      {/* Job Queue + Runs layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        {/* Job Queue */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-card"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Job Queue</h2>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5">
                {jobCounts.running} running
              </span>
              <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">
                {jobCounts.pending} pending
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="shimmer h-4 w-full rounded" />
                  </div>
                ))
              : jobs.map((job, i) => {
                  const cfg = JOB_STATUS_CONFIG[job.status];
                  return (
                    <motion.div
                      key={job.jobId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors duration-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-slate-500">{job.jobId}</span>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-mono text-slate-500">{job.type}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(job.createdAt)}</span>
                        </div>
                      </div>

                      {job.status === "running" && (
                        <Loader2 size={12} className="animate-spin text-brand-600 flex-shrink-0" />
                      )}
                    </motion.div>
                  );
                })}
          </div>
        </motion.div>

        {/* Pipeline runs table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="xl:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-card"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Recent Runs</h2>
            <span className="text-[10px] text-slate-400">{runs.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="grid">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Run ID", "Triggered", "Studies", "Duration", "Status", "Logs"].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      scope="col"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="shimmer h-3 rounded w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : runs.map((run, i) => {
                      const cfg = RUN_STATUS_CONFIG[run.status];
                      return (
                        <motion.tr
                          key={run.runId}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-slate-500">{run.runId}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatRelativeTime(run.triggeredAt)}
                          </td>
                          <td className="px-4 py-3 data-mono text-slate-800 font-medium">
                            {run.studiesProcessed.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 data-mono text-slate-500">
                            {run.durationSeconds > 0 ? formatDuration(run.durationSeconds) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                              <cfg.Icon
                                size={9}
                                className={run.status === "running" ? "animate-spin" : ""}
                              />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {run.logs ? (
                              <LogDrawer logs={run.logs} runId={run.runId} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={clsx("toast", toast.type === "success" ? "toast-success" : "toast-error")}
            role="alert"
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <CheckCircle2 size={14} className="text-emerald-600" />
              ) : (
                <XCircle size={14} className="text-red-500" />
              )}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
