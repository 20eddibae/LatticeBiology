"use client";

import { motion } from "framer-motion";

interface Entity {
  type: "protein" | "gene" | "compound" | "disease" | "pathway";
  text: string;
  confidence: number;
}

const ENTITY_COLORS: Record<string, string> = {
  gene: "#7C3AED",
  protein: "#0369A1",
  compound: "#15803D",
  disease: "#DC2626",
  pathway: "#B45309",
};

const ENTITY_LABELS: Record<string, string> = {
  gene: "Genes",
  protein: "Proteins",
  compound: "Compounds",
  disease: "Diseases",
  pathway: "Pathways",
};

interface EntityDistributionProps {
  entities: Entity[];
}

export default function EntityDistribution({ entities }: EntityDistributionProps) {
  // Count entities by type
  const distribution = {
    gene: entities.filter((e) => e.type === "gene").length,
    protein: entities.filter((e) => e.type === "protein").length,
    compound: entities.filter((e) => e.type === "compound").length,
    disease: entities.filter((e) => e.type === "disease").length,
    pathway: entities.filter((e) => e.type === "pathway").length,
  };

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const percentages = Object.fromEntries(
    Object.entries(distribution).map(([type, count]) => [
      type,
      total > 0 ? ((count / total) * 100).toFixed(0) : 0,
    ])
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-lg border border-slate-200"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Entity Composition</h3>
        <p className="text-sm text-slate-500">Study distribution across entity types</p>
      </div>

      <div className="space-y-4">
        {(Object.entries(distribution) as Array<[keyof typeof distribution, number]>).map(
          ([type, count], idx) => {
            if (count === 0) return null;
            const percentage = parseFloat(percentages[type] as string);

            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ENTITY_COLORS[type] }}
                    />
                    <span className="text-sm font-medium text-slate-900">
                      {ENTITY_LABELS[type]}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.1 }}
                    style={{ backgroundColor: ENTITY_COLORS[type] }}
                    className="h-full rounded-full"
                  />
                </div>
              </motion.div>
            );
          }
        )}
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Entities</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {Object.values(distribution).filter((c) => c > 0).length}
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-wider">Entity Types</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {(
              (entities.filter((e) => e.confidence > 0.75).length / total) *
              100
            ).toFixed(0)}
            %
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-wider">High Confidence</p>
        </div>
      </div>
    </motion.div>
  );
}
