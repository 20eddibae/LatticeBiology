"use client";

import { Suspense } from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  FlaskConical,
  Dna,
  Pill,
  AlertCircle,
  Search,
  Loader2,
  ExternalLink,
  GitBranch,
  type LucideProps,
} from "lucide-react";
import clsx from "clsx";
import { fetchStudies, fetchEntities, type Study, type Entity, type StudyWithEntities } from "@/lib/api";

// ─── Entity type config ───────────────────────────────────────────────────────

type EntityConfigEntry = {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<LucideProps>;
};

const ENTITY_CONFIG: Record<Entity["type"], EntityConfigEntry> = {
  protein:  { label: "Protein",  color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", Icon: FlaskConical },
  gene:     { label: "Gene",     color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", Icon: Dna },
  compound: { label: "Compound", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", Icon: Pill },
  disease:  { label: "Disease",  color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", Icon: AlertCircle },
  pathway:  { label: "Pathway",  color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", Icon: GitBranch },
};

// ─── Annotated text ───────────────────────────────────────────────────────────

function AnnotatedText({ text, entities }: { text: string; entities: Entity[] }) {
  const sorted = [...entities]
    .filter((e) => e.text)
    .sort((a, b) => b.text.length - a.text.length);

  if (!sorted.length) {
    return <p className="text-sm text-slate-700 leading-8 whitespace-pre-wrap">{text}</p>;
  }

  const escaped = sorted.map((e) => e.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <p className="text-sm text-slate-700 leading-8 whitespace-pre-wrap">
      {parts.map((part, i) => {
        const entity = sorted.find((e) => e.text.toLowerCase() === part.toLowerCase());
        if (!entity) return part;
        const cfg = ENTITY_CONFIG[entity.type];
        return (
          <span
            key={i}
            className={`entity-${entity.type}`}
            title={`${cfg.label}: ${entity.text} — ${(entity.confidence * 100).toFixed(0)}% confidence`}
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}

// ─── Sort control ─────────────────────────────────────────────────────────────

type SortKey = "text" | "type" | "confidence" | "mentions";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-brand-600" />
    : <ChevronDown size={12} className="text-brand-600" />;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(entities: Entity[], accession: string) {
  const header = "Entity,Type,Confidence,Mentions,Source\n";
  const rows = entities
    .map((e) =>
      [
        `"${e.text.replace(/"/g, '""')}"`,
        e.type,
        `${(e.confidence * 100).toFixed(1)}%`,
        e.mentions,
        e.source ?? "",
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${accession}_entities.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Explorer page ────────────────────────────────────────────────────────────

function ExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studyParam = searchParams.get("study");

  const [studies, setStudies] = useState<Study[]>([]);
  const [studyData, setStudyData] = useState<StudyWithEntities | null>(null);
  const [selectedAccession, setSelectedAccession] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [entityLoading, setEntityLoading] = useState(false);
  const [filter, setFilter] = useState<Entity["type"] | "all">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchStudies().then((data) => {
      setStudies(data);
      const initial = studyParam ?? data[0]?.accession ?? "";
      setSelectedAccession(initial);
      setLoading(false);
    });
  }, [studyParam]);

  const loadEntities = useCallback(async (accession: string) => {
    if (!accession) return;
    setEntityLoading(true);
    const data = await fetchEntities(accession);
    setStudyData(data);
    setEntityLoading(false);
  }, []);

  useEffect(() => {
    if (selectedAccession) {
      router.replace(`/explorer?study=${selectedAccession}`, { scroll: false });
      loadEntities(selectedAccession);
    }
  }, [selectedAccession, loadEntities, router]);

  const processedEntities = useMemo(() => {
    if (!studyData) return [];
    let list = studyData.entities;
    if (filter !== "all") list = list.filter((e) => e.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.text.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          (e.source ?? "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortKey === "text") { av = a.text; bv = b.text; }
      else if (sortKey === "type") { av = a.type; bv = b.type; }
      else if (sortKey === "confidence") { av = a.confidence; bv = b.confidence; }
      else if (sortKey === "mentions") { av = a.mentions; bv = b.mentions; }

      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [studyData, filter, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const entityCounts = useMemo(() =>
    studyData?.entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [studyData]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  const selectedStudy = studies.find((s) => s.accession === selectedAccession);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Entity Explorer</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Explore biomedical entities extracted from study texts
            </p>
          </div>

          {/* Study selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:border-slate-300 shadow-card transition-colors duration-150 min-w-[240px] max-w-[360px]"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <span className="text-[10px] font-mono text-brand-700 flex-shrink-0">
                {selectedAccession}
              </span>
              <span className="flex-1 text-xs text-slate-500 truncate text-left">
                {selectedStudy?.title ?? "Select study…"}
              </span>
              <ChevronsUpDown size={13} className="text-slate-400 flex-shrink-0" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                  role="listbox"
                  aria-label="Study selector"
                >
                  {studies.map((study) => (
                    <li
                      key={study.accession}
                      role="option"
                      aria-selected={study.accession === selectedAccession}
                      onClick={() => {
                        setSelectedAccession(study.accession);
                        setDropdownOpen(false);
                      }}
                      className={clsx(
                        "flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors duration-100 hover:bg-slate-50",
                        study.accession === selectedAccession && "bg-brand-50"
                      )}
                    >
                      <span className="text-[10px] font-mono text-brand-700 flex-shrink-0 mt-0.5">
                        {study.accession}
                      </span>
                      <span className="text-xs text-slate-700 line-clamp-2 leading-snug">
                        {study.title}
                      </span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left — annotated text */}
        <div className="flex-1 overflow-y-auto border-r border-slate-100 p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Annotated Study Text
            </h2>
            {selectedStudy && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{selectedStudy.releaseDate}</span>
                <span>·</span>
                <span>{selectedStudy.authorCount} authors</span>
              </div>
            )}
          </div>

          {selectedStudy && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-2">
                {selectedStudy.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ENTITY_CONFIG) as Entity["type"][]).map((type) => {
                  const cnt = entityCounts?.[type] ?? 0;
                  if (!cnt) return null;
                  const cfg = ENTITY_CONFIG[type];
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      <cfg.Icon size={9} />
                      {cnt} {cfg.label.toLowerCase()}s
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {entityLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-brand-600" />
            </div>
          ) : studyData ? (
            <AnnotatedText text={studyData.rawText} entities={studyData.entities} />
          ) : null}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            {(Object.keys(ENTITY_CONFIG) as Entity["type"][]).map((type) => {
              const cfg = ENTITY_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`entity-${type} text-xs`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — entity table */}
        <div className="w-[480px] flex-shrink-0 flex flex-col overflow-hidden bg-white">
          {/* Table toolbar */}
          <div className="flex-shrink-0 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search entities…"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200 transition-colors duration-150"
                  aria-label="Search entities"
                />
              </div>

              {/* Export */}
              <button
                onClick={() => studyData && exportCSV(processedEntities, studyData.accession)}
                disabled={!studyData}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-brand-500"
                aria-label="Export entities as CSV"
              >
                <Download size={12} />
                CSV
              </button>
            </div>

            {/* Type filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilter("all")}
                className={clsx(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-150",
                  filter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900"
                )}
              >
                All ({studyData?.entities.length ?? 0})
              </button>
              {(Object.keys(ENTITY_CONFIG) as Entity["type"][]).map((type) => {
                const cfg = ENTITY_CONFIG[type];
                const count = entityCounts?.[type] ?? 0;
                if (!count) return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-all duration-150"
                    style={
                      filter === type
                        ? { backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }
                        : { backgroundColor: "#F8FAFC", color: "#64748B", borderColor: "#E2E8F0" }
                    }
                  >
                    <cfg.Icon size={9} />
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs" role="grid">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                <tr>
                  {(
                    [
                      { key: "text", label: "Entity" },
                      { key: "type", label: "Type" },
                      { key: "confidence", label: "Confidence" },
                      { key: "mentions", label: "Mentions" },
                    ] as { key: SortKey; label: string }[]
                  ).map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 transition-colors duration-100 select-none"
                      scope="col"
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === "asc" ? "ascending" : "descending"
                          : "none"
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {entityLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {[...Array(5)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="shimmer h-3 rounded w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : processedEntities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        No entities match your filters.
                      </td>
                    </tr>
                  ) : (
                    processedEntities.map((entity, i) => {
                      const cfg = ENTITY_CONFIG[entity.type];
                      return (
                        <motion.tr
                          key={entity.id}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ delay: i * 0.02, duration: 0.15 }}
                          className="border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {entity.text}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}
                            >
                              <cfg.Icon size={8} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${entity.confidence * 100}%`, backgroundColor: cfg.color }}
                                />
                              </div>
                              <span className="data-mono text-slate-500">
                                {(entity.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 data-mono text-slate-500">
                            {entity.mentions}
                          </td>
                          <td className="px-4 py-3">
                            {entity.source && (
                              <button
                                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-600 transition-colors duration-150"
                                aria-label={`View source for ${entity.text}`}
                                title={entity.source}
                              >
                                <ExternalLink size={11} />
                                Source
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Suspense wrapper (required by Next.js 14 for useSearchParams) ─────────────

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-8">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        </div>
      }
    >
      <ExplorerContent />
    </Suspense>
  );
}
