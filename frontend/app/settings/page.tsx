"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Server, Sliders, CheckCircle2, type LucideProps } from "lucide-react";
import clsx from "clsx";

interface SettingRow {
  label: string;
  description: string;
  value: string;
  type?: "text" | "toggle";
}

const SETTINGS_SECTIONS: {
  title: string;
  description: string;
  icon: React.ComponentType<LucideProps>;
  rows: SettingRow[];
}[] = [
  {
    title: "API Configuration",
    description: "Backend and external service endpoints",
    icon: Server,
    rows: [
      { label: "Backend URL", description: "Base URL for the BioStream API", value: "http://localhost:8000", type: "text" },
      { label: "BioStudies Endpoint", description: "EBI BioStudies API endpoint", value: "https://www.ebi.ac.uk/biostudies/api/v1", type: "text" },
      { label: "Ollama Host", description: "Local Ollama inference server URL", value: "http://localhost:11434", type: "text" },
    ],
  },
  {
    title: "Pipeline Settings",
    description: "Ingestion and processing parameters",
    icon: Sliders,
    rows: [
      { label: "Batch Size", description: "Studies processed per pipeline run", value: "50", type: "text" },
      { label: "Auto-run Interval", description: "Minutes between automatic ingestion runs", value: "60", type: "text" },
      { label: "Confidence Threshold", description: "Minimum NER confidence score to index", value: "0.75", type: "text" },
      { label: "Default Model", description: "Ollama model used for entity extraction", value: "llama3.2:3b", type: "text" },
    ],
  },
];

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-6 lg:p-8 min-h-full max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <Settings size={20} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Configure your BioStream instance</p>
      </motion.div>

      <div className="space-y-5">
        {SETTINGS_SECTIONS.map((section, si) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.08 }}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-card"
            >
              {/* Section header */}
              <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <Icon size={15} className="text-brand-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-50">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-6 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{row.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.description}</p>
                    </div>
                    <input
                      defaultValue={row.value}
                      className="w-52 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 font-mono focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-200 transition-all duration-150 flex-shrink-0"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Save button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSave}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
            saved
              ? "bg-emerald-600 text-white"
              : "bg-brand-700 text-white hover:bg-brand-800 shadow-sm"
          )}
        >
          {saved && <CheckCircle2 size={15} />}
          {saved ? "Saved!" : "Save Changes"}
        </motion.button>
      </div>
    </div>
  );
}
