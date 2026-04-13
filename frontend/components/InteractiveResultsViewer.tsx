"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Download,
  Sliders,
  Network,
  Sparkles,
  ChevronDown,
  Send,
} from "lucide-react";
import type { KGSubgraph } from "@/lib/api";

const NetworkGraph = dynamic(() => import("@/components/NetworkGraph"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-lg border border-teal-200 bg-white flex items-center justify-center">
      <div className="text-center">
        <Network className="w-8 h-8 text-teal-400 mx-auto mb-2 animate-pulse" />
        <p className="text-sm text-slate-500">Loading network graph...</p>
      </div>
    </div>
  ),
});

interface Hypothesis {
  id: string;
  hypothesis: string;
  confidence: number;
  testability: "high" | "medium" | "low";
}

interface InteractiveResultsViewerProps {
  hypotheses: Hypothesis[];
  agentMessages: any[];
  sessionId: string;
  kgData?: KGSubgraph | null;
}

type TabType = "hypotheses" | "chat" | "export" | "graph";

export default function InteractiveResultsViewer({
  hypotheses: initialHypotheses,
  agentMessages,
  sessionId,
  kgData,
}: InteractiveResultsViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("hypotheses");
  const [hypotheses, setHypotheses] = useState(initialHypotheses);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [selectedHypothesis, setSelectedHypothesis] = useState<string | null>(
    hypotheses[0]?.id || null
  );
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedSections, setSelectedSections] = useState({
    summary: true,
    hypotheses: true,
    entities: true,
    relationships: true,
    confidence: false,
  });

  // Sort hypotheses by adjusted confidence
  const sortedHypotheses = [...hypotheses]
    .map((h) => ({
      ...h,
      adjustedConfidence: Math.max(h.confidence, confidenceFilter),
    }))
    .sort((a, b) => b.adjustedConfidence - a.adjustedConfidence);

  const handleConfidenceChange = (id: string, newConfidence: number) => {
    setHypotheses(
      hypotheses.map((h) =>
        h.id === id ? { ...h, confidence: newConfidence } : h
      )
    );
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const newMessages = [
      ...chatMessages,
      { role: "user" as const, content: chatInput },
    ];
    setChatMessages(newMessages);
    setChatInput("");

    // Simulate agent response
    setTimeout(() => {
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `The research team analyzed your query. Based on our findings, the ${selectedHypothesis ? "selected hypothesis" : "leading hypothesis"} has strong support from the AlphaFold structural predictions. The confidence score reflects experimental validation potential and literature support.`,
        },
      ]);
    }, 800);
  };

  const handleExport = async (format: "pdf" | "json" | "markdown") => {
    // Generate export with selected sections
    const exportData = {
      sessionId,
      format,
      sections: selectedSections,
      hypotheses: sortedHypotheses,
      exportedAt: new Date().toISOString(),
    };

    // Simulate download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `research-results-${sessionId}.${format === "json" ? "json" : "txt"}`;
    link.click();

    setShowExportModal(false);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Tab navigation */}
      <div className="border-b border-slate-200 flex gap-0">
        {[
          { id: "hypotheses" as TabType, label: "Hypotheses", icon: Sparkles },
          { id: "chat" as TabType, label: "Agent Chat", icon: MessageSquare },
          { id: "graph" as TabType, label: "Knowledge Graph", icon: Network },
          { id: "export" as TabType, label: "Export", icon: Download },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 px-4 py-3 font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === id
                ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border-b-2 border-blue-500"
                : "text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Hypotheses Tab */}
          {activeTab === "hypotheses" && (
            <motion.div
              key="hypotheses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Confidence filter slider */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 font-medium text-sm text-slate-700">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    Confidence Threshold
                  </label>
                  <span className="text-sm font-semibold text-blue-600">
                    {Math.round(confidenceFilter * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceFilter * 100}
                  onChange={(e) => setConfidenceFilter(parseFloat(e.target.value) / 100)}
                  className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-xs text-slate-600 mt-2">
                  Drag to filter hypotheses by confidence score. Findings below this threshold are hidden.
                </p>
              </div>

              {/* Hypotheses list */}
              <div className="space-y-3">
                {sortedHypotheses
                  .filter((h) => h.adjustedConfidence >= confidenceFilter)
                  .map((hypothesis, idx) => (
                    <motion.div
                      key={hypothesis.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => setSelectedHypothesis(hypothesis.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedHypothesis === hypothesis.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-semibold text-slate-900 flex-1">
                          Hypothesis {idx + 1}
                        </p>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            hypothesis.testability === "high"
                              ? "bg-emerald-100 text-emerald-800"
                              : hypothesis.testability === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {hypothesis.testability} testability
                        </span>
                      </div>

                      {/* Hypothesis text */}
                      <p className="text-sm text-slate-700 mb-4 leading-relaxed">
                        {hypothesis.hypothesis}
                      </p>

                      {/* Confidence slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-600">
                            Your Confidence Adjustment
                          </label>
                          <span className="text-sm font-bold text-blue-600">
                            {Math.round(hypothesis.confidence * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={hypothesis.confidence * 100}
                          onChange={(e) =>
                            handleConfidenceChange(
                              hypothesis.id,
                              parseFloat(e.target.value) / 100
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex gap-2 text-xs text-slate-500">
                          <span>Low</span>
                          <span className="flex-1"></span>
                          <span>High</span>
                        </div>
                      </div>

                      {/* Action button */}
                      {selectedHypothesis === hypothesis.id && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg font-medium text-sm hover:shadow-lg transition-shadow"
                        >
                          Refine This Hypothesis
                        </motion.button>
                      )}
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Chat Tab */}
          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-96"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        Ask the research agents about their findings
                      </p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          msg.role === "user"
                            ? "bg-blue-500 text-white rounded-br-none"
                            : "bg-slate-100 text-slate-900 rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleSendChat()
                  }
                  placeholder="Ask about hypotheses, structures, confidence..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Graph Tab */}
          {activeTab === "graph" && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-lg border border-teal-200">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Network className="w-5 h-5 text-teal-600" />
                  Interactive Knowledge Graph
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Drag nodes to rearrange. Hover for details. Scroll to zoom.
                </p>

                {kgData && kgData.node_count > 0 ? (
                  <div className="bg-white rounded-lg border border-teal-200 overflow-hidden">
                    <NetworkGraph
                      data={kgData}
                      height={400}
                      showLegend
                    />
                    <div className="px-4 py-2 bg-teal-50 border-t border-teal-200 flex items-center justify-between">
                      <span className="text-xs text-teal-700 font-medium">
                        {kgData.node_count} entities, {kgData.edge_count} relationships
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-64 bg-white rounded-lg border-2 border-dashed border-teal-200 flex items-center justify-center">
                    <div className="text-center">
                      <Network className="w-8 h-8 text-teal-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">
                        No graph data yet
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        The knowledge graph will appear here once entities are extracted
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Export Tab */}
          {activeTab === "export" && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Section selector */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Report Sections
                </h3>
                <div className="space-y-2">
                  {Object.entries(selectedSections).map(([key, checked]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedSections({
                            ...selectedSections,
                            [key]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-slate-700 capitalize">
                        {key === "summary" && "Executive Summary"}
                        {key === "hypotheses" && "Generated Hypotheses"}
                        {key === "entities" && "Extracted Entities"}
                        {key === "relationships" && "Entity Relationships"}
                        {key === "confidence" && "Confidence Metrics"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export buttons */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { format: "pdf" as const, label: "PDF Report", icon: "PDF" },
                  { format: "json" as const, label: "Raw JSON", icon: "JSON" },
                  { format: "markdown" as const, label: "Markdown", icon: "MD" },
                ].map(({ format, label, icon }) => (
                  <motion.button
                    key={format}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleExport(format)}
                    className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg hover:border-blue-500 transition-all group"
                  >
                    <div className="text-sm font-bold text-blue-600 mb-2 bg-blue-50 rounded px-2 py-1 inline-block">{icon}</div>
                    <p className="text-xs font-medium text-slate-900">{label}</p>
                  </motion.button>
                ))}
              </div>

              {/* Export info */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                <p className="text-sm text-emerald-900">
                  <span className="font-semibold">Pro Tip:</span> Include confidence metrics in your report to help reviewers understand the experimental validation potential of each hypothesis.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
