"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

interface ResearchLoadingAnimationProps {
  status?: "initializing" | "extracting" | "predicting" | "analyzing" | "synthesizing";
  message?: string;
}

const STAGES = [
  { id: "initializing", label: "Initializing Research Framework", desc: "Parsing query, identifying key entities and biological context" },
  { id: "extracting", label: "Extracting Entities & Relationships", desc: "Named entity recognition, finding proteins, genes, pathways" },
  { id: "predicting", label: "Predicting Protein Structures", desc: "AlphaFold structural predictions, analyzing confidence" },
  { id: "analyzing", label: "Analyzing Mechanistic Hypotheses", desc: "Synthesizing findings into testable hypotheses" },
  { id: "synthesizing", label: "Synthesizing Final Report", desc: "Compiling results and preparing actionable conclusions" },
];

export default function ResearchLoadingAnimation({
  status = "initializing",
  message,
}: ResearchLoadingAnimationProps) {
  const currentStageIndex = STAGES.findIndex((s) => s.id === status);
  const currentStage = STAGES[currentStageIndex] || STAGES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Research in Progress</h2>
          <p className="text-slate-600">Multi-agent AI pipeline analyzing your biological query</p>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-700">Pipeline Progress</span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(((currentStageIndex + 1) / STAGES.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStageIndex + 1) / STAGES.length) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Stage Timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            const isCompleted = idx < currentStageIndex;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
                className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                  isActive
                    ? "border-blue-500 bg-blue-50"
                    : isCompleted
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-6 h-6 text-blue-600" />
                    </motion.div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center">
                      <span className="text-xs font-semibold text-slate-400">{idx + 1}</span>
                    </div>
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold ${
                      isActive ? "text-blue-900" : isCompleted ? "text-green-900" : "text-slate-900"
                    }`}>
                      {stage.label}
                    </h3>
                    {isActive && (
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="inline-block ml-2 px-2 py-1 rounded-full bg-blue-200 text-xs font-semibold text-blue-700"
                      >
                        Active
                      </motion.span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {stage.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Current Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-4 rounded-lg border border-blue-200 bg-blue-50"
          >
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Current Activity</p>
                <p className="text-sm text-blue-900 leading-relaxed">{message}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-slate-500">
            Typical research takes 30-60 seconds • Do not close this window
          </p>
        </motion.div>
      </div>
    </div>
  );
}
