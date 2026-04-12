"use client";

import { motion } from "framer-motion";

interface Relationship {
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string;
  confidence: number;
  evidenceSnippet?: string;
  sourceCount?: number;
}

const RELATIONSHIP_LABELS: Record<string, { label: string; color: string }> = {
  activates: { label: "→ Activates", color: "bg-green-100 text-green-900" },
  inhibits: { label: "⊣ Inhibits", color: "bg-red-100 text-red-900" },
  binds_to: { label: "⟷ Binds", color: "bg-blue-100 text-blue-900" },
  upregulates: { label: "⬆ Upregulates", color: "bg-emerald-100 text-emerald-900" },
  downregulates: { label: "⬇ Downregulates", color: "bg-orange-100 text-orange-900" },
  associated_with: { label: "~ Associated", color: "bg-slate-100 text-slate-900" },
};

interface RelationshipTableProps {
  relationships: Relationship[];
  title?: string;
}

export default function RelationshipTable({
  relationships,
  title = "Mechanistic Insights",
}: RelationshipTableProps) {
  if (!relationships || relationships.length === 0) {
    return (
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">No relationships identified in this study.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-500">
          {relationships.length} relationship{relationships.length !== 1 ? "s" : ""} extracted from the study
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Subject</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-700">Relationship</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Object</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-700">Confidence</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {relationships.map((rel, idx) => {
              const relInfo =
                RELATIONSHIP_LABELS[rel.relationshipType] ||
                RELATIONSHIP_LABELS.associated_with;
              const confPercent = Math.round(rel.confidence * 100);

              return (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded text-xs">
                      {rel.sourceEntity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${relInfo.color}`}>
                      {relInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded text-xs">
                      {rel.targetEntity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                          style={{ width: `${confPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 font-medium w-8 text-right">
                        {confPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {rel.evidenceSnippet ? (
                      <div className="max-w-xs">
                        <p className="text-xs text-slate-600 line-clamp-2 italic">
                          "{rel.evidenceSnippet}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No evidence text</p>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
