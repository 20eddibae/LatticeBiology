"use client";

import { motion } from "framer-motion";
import { Pill, FlaskConical, Atom } from "lucide-react";
import dynamic from "next/dynamic";
import type { LeadCompound } from "@/lib/api";

const SmilesRenderer = dynamic(() => import("./SmilesRenderer"), {
  ssr: false,
  loading: () => (
    <div className="w-[260px] h-[200px] bg-slate-800/50 rounded-lg animate-pulse" />
  ),
});

interface LeadCompoundsPanelProps {
  compounds: LeadCompound[];
}

export default function LeadCompoundsPanel({ compounds }: LeadCompoundsPanelProps) {
  if (!compounds || compounds.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Pill className="w-4 h-4 text-teal-400" />
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
          Lead Compounds
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {compounds.length} identified
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {compounds.map((comp, i) => (
          <motion.div
            key={comp.chembl_id || comp.name}
            initial={{ opacity: 0, y: 12, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4, type: "spring", stiffness: 80 }}
            whileHover={{ y: -4, boxShadow: "0 20px 25px rgba(0,0,0,0.2)" }}
            className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-100 truncate">
                  {comp.name}
                </h4>
                {comp.chembl_id && (
                  <span className="text-[10px] font-mono text-teal-400/70">
                    {comp.chembl_id}
                  </span>
                )}
              </div>
              <FlaskConical className="w-4 h-4 text-teal-500/60 flex-shrink-0 mt-0.5" />
            </div>

            {/* 2D Structure */}
            {comp.smiles && (
              <div className="flex justify-center bg-slate-800/40 rounded-lg p-2 border border-slate-700/30">
                <SmilesRenderer smiles={comp.smiles} width={220} height={160} />
              </div>
            )}

            {/* Properties */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/50 rounded-md px-2 py-1.5">
                <span className="text-slate-500 block text-[10px]">MW</span>
                <span className="text-slate-200 font-mono">
                  {comp.molecular_weight ? `${comp.molecular_weight.toFixed(1)}` : "N/A"}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-md px-2 py-1.5">
                <span className="text-slate-500 block text-[10px]">LogP</span>
                <span className="text-slate-200 font-mono">
                  {comp.logp != null ? `${comp.logp.toFixed(2)}` : "N/A"}
                </span>
              </div>
            </div>

            {/* Scaffold */}
            {comp.scaffold_description && (
              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 italic">
                {comp.scaffold_description}
              </p>
            )}

            {/* Target */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <Atom className="w-3 h-3 text-violet-400" />
              <span className="text-slate-400">Target:</span>
              <span className="text-slate-200 font-medium">{comp.target_protein}</span>
            </div>

            {/* Bioactivities */}
            {comp.bioactivities && comp.bioactivities.length > 0 && (
              <div className="border-t border-slate-700/40 pt-2 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Bioactivities
                </span>
                {comp.bioactivities.slice(0, 2).map((ba, j) => (
                  <div key={j} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{ba.type}</span>
                    <span className="text-slate-200 font-mono">
                      {ba.value != null ? `${ba.value} ${ba.units}` : "—"}
                      {ba.pchembl != null && (
                        <span className="text-teal-400/70 ml-1">(p={ba.pchembl})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
