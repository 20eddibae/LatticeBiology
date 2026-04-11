"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, TrendingUp } from "lucide-react";
import type { ResidueScore } from "@/lib/api";

interface ConfidenceTelemetryProps {
  residues: ResidueScore[];
  proteinName?: string;
  maxHeight?: number;
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-blue-400";
  if (score >= 70) return "text-cyan-400";
  if (score >= 50) return "text-yellow-400";
  return "text-orange-400";
}

function scoreBg(score: number): string {
  if (score >= 90) return "bg-blue-500/20";
  if (score >= 70) return "bg-cyan-500/20";
  if (score >= 50) return "bg-yellow-500/20";
  return "bg-orange-500/20";
}

function tierLabel(score: number): string {
  if (score >= 90) return "VERY HIGH";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export default function ConfidenceTelemetry({
  residues,
  proteinName = "Protein",
  maxHeight = 240,
}: ConfidenceTelemetryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [residues.length]);

  const high = residues.filter((r) => r.plddt_score >= 90).length;
  const med = residues.filter((r) => r.plddt_score >= 70 && r.plddt_score < 90).length;
  const low = residues.filter((r) => r.plddt_score < 70).length;
  const avg =
    residues.length > 0
      ? residues.reduce((s, r) => s + r.plddt_score, 0) / residues.length
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700 bg-slate-900 shadow-card overflow-hidden font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-green-400" />
          <span className="text-[10px] font-semibold text-slate-300">
            pLDDT Confidence — {proteinName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-blue-400">{high} high</span>
          <span className="text-[9px] text-cyan-400">{med} med</span>
          <span className="text-[9px] text-orange-400">{low} low</span>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-3 py-1.5 border-b border-slate-700/40 bg-slate-800/30 flex items-center gap-2">
        <TrendingUp size={10} className="text-slate-500" />
        <span className="text-[9px] text-slate-400">
          {residues.length} residues · avg pLDDT: {avg.toFixed(1)}
        </span>
        <div className="flex-1 h-1.5 rounded bg-slate-700 overflow-hidden flex">
          <div className="bg-blue-500" style={{ width: `${(high / Math.max(residues.length, 1)) * 100}%` }} />
          <div className="bg-cyan-500" style={{ width: `${(med / Math.max(residues.length, 1)) * 100}%` }} />
          <div className="bg-orange-500" style={{ width: `${(low / Math.max(residues.length, 1)) * 100}%` }} />
        </div>
      </div>

      {/* Scrolling log */}
      <div
        ref={scrollRef}
        className="overflow-y-auto text-[10px] leading-relaxed"
        style={{ maxHeight }}
      >
        <AnimatePresence mode="popLayout">
          {residues.map((r, i) => (
            <motion.div
              key={`${r.residue_index}-${r.residue_name}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.005, 0.5) }}
              className={`flex items-center gap-2 px-3 py-0.5 border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors ${
                i % 2 === 0 ? "bg-slate-900" : "bg-slate-900/60"
              }`}
            >
              <span className="text-slate-600 w-8 text-right tabular-nums">
                {r.residue_index}
              </span>
              <span className="text-slate-400 w-8">{r.residue_name}</span>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded ${scoreBg(r.plddt_score)}`}
                    style={{
                      width: `${r.plddt_score}%`,
                      backgroundColor:
                        r.plddt_score >= 90
                          ? "#3b82f6"
                          : r.plddt_score >= 70
                          ? "#06b6d4"
                          : r.plddt_score >= 50
                          ? "#eab308"
                          : "#f97316",
                    }}
                  />
                </div>
                <span className={`w-10 text-right tabular-nums font-medium ${scoreColor(r.plddt_score)}`}>
                  {r.plddt_score.toFixed(1)}
                </span>
                <span className={`text-[8px] w-16 ${scoreColor(r.plddt_score)} opacity-60`}>
                  {tierLabel(r.plddt_score)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
