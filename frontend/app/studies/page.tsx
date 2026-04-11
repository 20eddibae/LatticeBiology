"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, FlaskConical, Dna, Pill, AlertCircle, GitBranch, type LucideProps } from "lucide-react";
import StudyCard from "@/components/StudyCard";
import { fetchStudies, type Study, type Entity } from "@/lib/api";
import clsx from "clsx";

// ─── Entity filter config ─────────────────────────────────────────────────────

const ENTITY_FILTERS: {
  key: Entity["type"] | "all";
  label: string;
  Icon: React.ComponentType<LucideProps>;
  color: string;
  bg: string;
  border: string;
}[] = [
  { key: "all",      label: "All Studies", Icon: BookOpen,    color: "#0F766E", bg: "#F0FDFA", border: "#5EEAD4" },
  { key: "protein",  label: "Proteins",    Icon: FlaskConical, color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  { key: "gene",     label: "Genes",       Icon: Dna,          color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  { key: "compound", label: "Compounds",   Icon: Pill,         color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
  { key: "disease",  label: "Diseases",    Icon: AlertCircle,  color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  { key: "pathway",  label: "Pathways",    Icon: GitBranch,    color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
];

const ENTITY_COUNT_KEY: Record<string, keyof Study["entityCounts"]> = {
  protein: "proteins",
  gene: "genes",
  compound: "compounds",
};

export default function StudiesPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<Entity["type"] | "all">("all");

  useEffect(() => {
    fetchStudies().then((data) => {
      setStudies(data);
      setLoading(false);
    });
  }, []);

  const filtered = studies.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.accession.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (entityFilter === "all") return true;

    const countKey = ENTITY_COUNT_KEY[entityFilter];
    if (countKey) return (s.entityCounts[countKey] ?? 0) > 0;

    return true;
  });

  const counts = {
    all: studies.length,
    protein: studies.filter((s) => s.entityCounts.proteins > 0).length,
    gene: studies.filter((s) => s.entityCounts.genes > 0).length,
    compound: studies.filter((s) => s.entityCounts.compounds > 0).length,
    disease: studies.length,
    pathway: studies.length,
  };

  return (
    <div className="p-6 lg:p-8 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <BookOpen size={20} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-900">Studies</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">
          Browse all indexed BioStudies entries
        </p>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by accession or title…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200 transition-colors duration-150 shadow-card"
          />
        </div>

        {/* Entity type filters */}
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_FILTERS.map(({ key, label, Icon, color, bg, border }) => {
            const isActive = entityFilter === key;
            const count = counts[key as keyof typeof counts] ?? 0;
            return (
              <button
                key={key}
                onClick={() => setEntityFilter(key)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium border transition-all duration-150"
                )}
                style={
                  isActive
                    ? { backgroundColor: bg, color, borderColor: border }
                    : { backgroundColor: "#FFFFFF", color: "#64748B", borderColor: "#E2E8F0" }
                }
              >
                <Icon size={10} />
                {label}
                <span
                  className="rounded-full px-1 py-0.5 text-[9px] font-bold leading-none"
                  style={isActive ? { backgroundColor: color + "20" } : { backgroundColor: "#F1F5F9" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results header */}
      {!loading && (
        <p className="text-xs text-slate-400 mb-4">
          Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of {studies.length} studies
          {entityFilter !== "all" && (
            <> with <span className="font-semibold text-slate-600">{ENTITY_FILTERS.find(f => f.key === entityFilter)?.label}</span></>
          )}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="shimmer h-40 rounded-xl" />
            ))
          : filtered.map((study, i) => (
              <motion.div
                key={study.accession}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <StudyCard study={study} />
              </motion.div>
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={32} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No studies match your filters</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search or entity type filter</p>
        </div>
      )}
    </div>
  );
}
