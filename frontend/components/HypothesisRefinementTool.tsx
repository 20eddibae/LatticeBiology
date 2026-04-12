"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, Plus, Trash2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface Hypothesis {
  id: string;
  hypothesis: string;
  confidence: number;
  mechanism: string;
  experimentalApproach: string;
  validation: {
    required: string[];
    optional: string[];
  };
}

interface HypothesisRefinementToolProps {
  initialHypothesis: Hypothesis;
  onSave?: (refined: Hypothesis) => void;
}

export default function HypothesisRefinementTool({
  initialHypothesis,
  onSave,
}: HypothesisRefinementToolProps) {
  const [hypothesis, setHypothesis] = useState(initialHypothesis);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedValidation, setSelectedValidation] = useState<string[]>([]);
  const [showAIRefinement, setShowAIRefinement] = useState(false);
  const [refinementLoading, setRefinementLoading] = useState(false);

  const handleAddValidation = (item: string) => {
    if (!selectedValidation.includes(item)) {
      setSelectedValidation([...selectedValidation, item]);
    }
  };

  const handleRemoveValidation = (item: string) => {
    setSelectedValidation(selectedValidation.filter((v) => v !== item));
  };

  const handleAIRefinement = async () => {
    setRefinementLoading(true);
    // Simulate AI refinement
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const refinedHypothesis = {
      ...hypothesis,
      hypothesis: `${hypothesis.hypothesis} This refined version incorporates additional mechanistic detail about pathway crosstalk and temporal dynamics.`,
      confidence: Math.min(hypothesis.confidence + 0.1, 1),
      experimentalApproach: `${hypothesis.experimentalApproach} Recommend temporal phosphoproteomics to capture signaling dynamics.`,
    };

    setHypothesis(refinedHypothesis);
    setRefinementLoading(false);
    setShowAIRefinement(false);
  };

  return (
    <div className="space-y-4">
      {/* Main hypothesis card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border-2 border-purple-200"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Refined Hypothesis
            </h3>
            <p className="text-xs text-slate-600 mt-1">Edit and validate your research direction</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-purple-600">
              {Math.round(hypothesis.confidence * 100)}%
            </span>
            <span className="text-xs text-slate-600">confidence</span>
          </div>
        </div>

        {/* Hypothesis statement */}
        {isEditing ? (
          <textarea
            value={hypothesis.hypothesis}
            onChange={(e) =>
              setHypothesis({ ...hypothesis, hypothesis: e.target.value })
            }
            className="w-full p-3 border border-purple-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 min-h-[100px]"
          />
        ) : (
          <p className="text-sm font-medium text-slate-900 mb-4 leading-relaxed">
            {hypothesis.hypothesis}
          </p>
        )}

        {/* Confidence slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700">
              Your Confidence Assessment
            </label>
            <span className="text-xs font-bold text-purple-600">
              {Math.round(hypothesis.confidence * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={hypothesis.confidence * 100}
            onChange={(e) =>
              setHypothesis({
                ...hypothesis,
                confidence: parseFloat(e.target.value) / 100,
              })
            }
            className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>Low confidence</span>
            <span>High confidence</span>
          </div>
        </div>

        {/* Mechanism section */}
        <motion.div layout className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Proposed Mechanism
            </label>
            {isEditing ? (
              <textarea
                value={hypothesis.mechanism}
                onChange={(e) =>
                  setHypothesis({ ...hypothesis, mechanism: e.target.value })
                }
                className="w-full p-2 border border-purple-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
              />
            ) : (
              <p className="text-sm text-slate-700 bg-white/50 p-2 rounded border border-purple-100">
                {hypothesis.mechanism}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Experimental Approach
            </label>
            {isEditing ? (
              <textarea
                value={hypothesis.experimentalApproach}
                onChange={(e) =>
                  setHypothesis({
                    ...hypothesis,
                    experimentalApproach: e.target.value,
                  })
                }
                className="w-full p-2 border border-purple-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
              />
            ) : (
              <p className="text-sm text-slate-700 bg-white/50 p-2 rounded border border-purple-100">
                {hypothesis.experimentalApproach}
              </p>
            )}
          </div>
        </motion.div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsEditing(!isEditing)}
            className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
              isEditing
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-purple-500 text-white hover:bg-purple-600"
            }`}
          >
            {isEditing ? "Save Changes" : "Edit Hypothesis"}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAIRefinement(true)}
            className="flex-1 px-3 py-2 bg-white border-2 border-purple-500 text-purple-600 rounded-lg font-medium text-sm hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Refinement
          </motion.button>
        </div>
      </motion.div>

      {/* Validation checklist */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-6 rounded-lg border border-slate-200"
      >
        <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          Validation Requirements
        </h4>

        <div className="space-y-4">
          {/* Required validations */}
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle size={14} className="flex-shrink-0" />
              Required for Publication
            </p>
            <div className="space-y-2">
              {hypothesis.validation.required.map((req, idx) => (
                <motion.div
                  key={idx}
                  layout
                  className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-all ${
                    selectedValidation.includes(req)
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-slate-50 border-slate-200 hover:border-red-300"
                  }`}
                  onClick={() =>
                    selectedValidation.includes(req)
                      ? handleRemoveValidation(req)
                      : handleAddValidation(req)
                  }
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      selectedValidation.includes(req)
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-slate-300"
                    }`}
                  >
                    {selectedValidation.includes(req) && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span className="text-sm text-slate-700">{req}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Optional validations */}
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="flex-shrink-0" />
              Recommended (Strengthens Argument)
            </p>
            <div className="space-y-2">
              {hypothesis.validation.optional.map((opt, idx) => (
                <motion.div
                  key={idx}
                  layout
                  className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-all ${
                    selectedValidation.includes(opt)
                      ? "bg-blue-50 border-blue-300"
                      : "bg-slate-50 border-slate-200 hover:border-blue-300"
                  }`}
                  onClick={() =>
                    selectedValidation.includes(opt)
                      ? handleRemoveValidation(opt)
                      : handleAddValidation(opt)
                  }
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      selectedValidation.includes(opt)
                        ? "bg-blue-500 border-blue-500"
                        : "border-slate-300"
                    }`}
                  >
                    {selectedValidation.includes(opt) && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <span className="text-sm text-slate-700">{opt}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Validation progress */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-700">Validation Progress</p>
            <span className="text-xs font-bold text-blue-600">
              {selectedValidation.length} / {hypothesis.validation.required.length + hypothesis.validation.optional.length}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${
                  (selectedValidation.length /
                    (hypothesis.validation.required.length +
                      hypothesis.validation.optional.length)) *
                  100
                }%`,
              }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            />
          </div>
        </div>
      </motion.div>

      {/* AI Refinement modal */}
      <AnimatePresence>
        {showAIRefinement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAIRefinement(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-4">AI-Powered Refinement</h3>

              {refinementLoading ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    The research team is refining your hypothesis based on structural predictions and literature analysis...
                  </p>
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                        className="h-2 bg-gradient-to-r from-purple-300 to-blue-300 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm text-emerald-900 flex items-center gap-2">
                      <CheckCircle size={16} className="flex-shrink-0 text-emerald-600" />
                      <span className="font-semibold">Refinement Complete!</span>
                    </p>
                    <p className="text-xs text-emerald-800 mt-1">
                      Your hypothesis has been enhanced with additional mechanistic insights. Confidence increased to {Math.round((hypothesis.confidence + 0.1) * 100)}%.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAIRefinement(false)}
                      className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-medium text-sm hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onSave?.(hypothesis);
                        setShowAIRefinement(false);
                      }}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
                    >
                      Accept & Save
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
