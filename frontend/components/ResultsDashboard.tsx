"use client";

import { motion } from "framer-motion";
import { Atom, Flame, FlaskConical, Activity } from "lucide-react";
import dynamic from "next/dynamic";
import type { AlphaFoldResult, BindingInterface, LeadCompound, ResidueScore } from "@/lib/api";
import type { BindingEnergyMatrix } from "./BindingHeatmap";

const MolstarViewer = dynamic(() => import("./MolstarViewer"), {
  ssr: false,
  loading: () => <QuadrantPlaceholder icon="molecule" label="Loading 3D viewer..." />,
});

const BindingHeatmap = dynamic(() => import("./BindingHeatmap"), {
  ssr: false,
  loading: () => <QuadrantPlaceholder icon="heatmap" label="Loading heatmap..." />,
});

const SmilesRenderer = dynamic(() => import("./SmilesRenderer"), {
  ssr: false,
  loading: () => <QuadrantPlaceholder icon="compound" label="Loading structures..." />,
});

const ConfidenceTelemetry = dynamic(() => import("./ConfidenceTelemetry"), {
  ssr: false,
  loading: () => <QuadrantPlaceholder icon="telemetry" label="Loading telemetry..." />,
});

function QuadrantPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="h-full min-h-[280px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 mx-auto text-slate-300 mb-2 animate-pulse" />
        <p className="text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

interface ResultsDashboardProps {
  alphafoldResults: AlphaFoldResult[];
  perResiduePlddt: Record<string, ResidueScore[]>;
  bindingInterface?: BindingInterface;
  bindingEnergyMatrix?: BindingEnergyMatrix;
  leadCompounds: LeadCompound[];
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const quadrant = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function ResultsDashboard({
  alphafoldResults,
  perResiduePlddt,
  bindingInterface,
  bindingEnergyMatrix,
  leadCompounds,
}: ResultsDashboardProps) {
  const firstResult = alphafoldResults[0];
  const firstAccession = firstResult?.accession;
  const pdbUrl = firstResult?.pdb_url;
  const residues = firstAccession ? perResiduePlddt[firstAccession] : undefined;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      {/* Q1: Molecule Viewer (top-left) */}
      <motion.div variants={quadrant} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-transparent flex items-center gap-2">
          <Atom className="w-4 h-4 text-teal-600" />
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Molecular Structure
          </h3>
        </div>
        <div className="p-3 h-[300px]">
          {pdbUrl && firstResult ? (
            <MolstarViewer
              pdbUrl={pdbUrl}
              proteinName={firstResult.protein_name}
              accession={firstResult.accession}
              alphafoldUrl={firstResult.alphafold_url}
              height={280}
              perResiduePlddt={residues}
              bindingInterface={bindingInterface}
            />
          ) : (
            <QuadrantPlaceholder icon="molecule" label="No structure available" />
          )}
        </div>
      </motion.div>

      {/* Q2: Binding Heatmap (top-right) */}
      <motion.div variants={quadrant} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-transparent flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500" />
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Binding Energy Map
          </h3>
        </div>
        <div className="p-3 overflow-auto max-h-[320px]">
          {bindingEnergyMatrix && bindingEnergyMatrix.rows?.length > 0 ? (
            <BindingHeatmap matrix={bindingEnergyMatrix} />
          ) : (
            <QuadrantPlaceholder icon="heatmap" label="No energy data available" />
          )}
        </div>
      </motion.div>

      {/* Q3: SMILES Compounds (bottom-left) */}
      <motion.div variants={quadrant} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-transparent flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-violet-500" />
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Lead Compounds
          </h3>
          <span className="text-[10px] text-slate-400 ml-auto">{leadCompounds.length} found</span>
        </div>
        <div className="p-3 overflow-x-auto">
          {leadCompounds.length > 0 ? (
            <div className="flex gap-4">
              {leadCompounds.map((comp, i) => (
                <div key={comp.chembl_id || comp.name} className="flex-shrink-0 w-[200px] space-y-2">
                  {comp.smiles && (
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 flex justify-center">
                      <SmilesRenderer smiles={comp.smiles} width={180} height={140} />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{comp.name}</p>
                    <p className="text-[9px] text-slate-400 font-mono">{comp.chembl_id}</p>
                    <div className="flex justify-center gap-3 mt-1 text-[9px]">
                      <span className="text-slate-500">
                        MW: <span className="text-slate-700">{comp.molecular_weight?.toFixed(0) ?? "?"}</span>
                      </span>
                      <span className="text-slate-500">
                        LogP: <span className="text-slate-700">{comp.logp?.toFixed(1) ?? "?"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <QuadrantPlaceholder icon="compound" label="No compounds identified" />
          )}
        </div>
      </motion.div>

      {/* Q4: Confidence Telemetry (bottom-right) */}
      <motion.div variants={quadrant} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Confidence Telemetry
          </h3>
        </div>
        <div className="p-3 max-h-[320px] overflow-auto">
          {residues && residues.length > 0 ? (
            <ConfidenceTelemetry residues={residues} />
          ) : (
            <QuadrantPlaceholder icon="telemetry" label="No pLDDT data available" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
