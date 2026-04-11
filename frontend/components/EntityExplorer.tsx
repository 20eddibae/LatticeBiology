"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Dna, Pill, AlertCircle, GitBranch, Loader2, type LucideProps } from "lucide-react";
import clsx from "clsx";
import { fetchEntities, type Entity, type StudyWithEntities } from "@/lib/api";

// ─── Entity type config ───────────────────────────────────────────────────────

type EntityConfig = {
  label: string;
  color: string;
  bg: string;
  border: string;
  className: string;
  Icon: React.ComponentType<LucideProps>;
};

const ENTITY_CONFIG: Record<Entity["type"], EntityConfig> = {
  protein: {
    label: "Protein",
    color: "#0369A1",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    className: "entity-protein",
    Icon: FlaskConical,
  },
  gene: {
    label: "Gene",
    color: "#6D28D9",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    className: "entity-gene",
    Icon: Dna,
  },
  compound: {
    label: "Compound",
    color: "#15803D",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    className: "entity-compound",
    Icon: Pill,
  },
  disease: {
    label: "Disease",
    color: "#B91C1C",
    bg: "#FEF2F2",
    border: "#FECACA",
    className: "entity-disease",
    Icon: AlertCircle,
  },
  pathway: {
    label: "Pathway",
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#FDE68A",
    className: "entity-pathway",
    Icon: GitBranch,
  },
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  entity: Entity;
  x: number;
  y: number;
}

function EntityTooltip({ entity, x, y }: TooltipProps) {
  const cfg = ENTITY_CONFIG[entity.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50 w-64 rounded-lg border bg-white p-3 shadow-xl pointer-events-none"
      style={{
        left: Math.min(x, window.innerWidth - 280),
        top: y - 8,
        transform: "translateY(-100%)",
        borderColor: cfg.border,
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: cfg.bg }}
        >
          <cfg.Icon size={12} style={{ color: cfg.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate">{entity.text}</p>
          <p className="text-[10px]" style={{ color: cfg.color }}>{cfg.label}</p>
        </div>
      </div>
      {entity.description && (
        <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">{entity.description}</p>
      )}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-slate-50 border border-slate-100 px-2 py-1">
          <p className="text-slate-400">Confidence</p>
          <p className="text-slate-800 font-semibold">{(entity.confidence * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded bg-slate-50 border border-slate-100 px-2 py-1">
          <p className="text-slate-400">Mentions</p>
          <p className="text-slate-800 font-semibold">{entity.mentions}</p>
        </div>
        {entity.source && (
          <div className="col-span-2 rounded bg-slate-50 border border-slate-100 px-2 py-1">
            <p className="text-slate-400">Source</p>
            <p className="text-slate-700 font-semibold truncate">{entity.source}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Annotated text ───────────────────────────────────────────────────────────

interface AnnotatedTextProps {
  text: string;
  entities: Entity[];
  onEntityHover: (entity: Entity | null, x: number, y: number) => void;
}

function AnnotatedText({ text, entities, onEntityHover }: AnnotatedTextProps) {
  const sorted = [...entities]
    .filter((e) => e.text)
    .sort((a, b) => b.text.length - a.text.length);

  const escaped = sorted.map((e) =>
    e.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  if (escaped.length === 0) {
    return <p className="text-[13px] text-slate-700 leading-7 whitespace-pre-wrap">{text}</p>;
  }

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <p className="text-[13px] text-slate-700 leading-7 whitespace-pre-wrap">
      {parts.map((part, i) => {
        const entity = sorted.find(
          (e) => e.text.toLowerCase() === part.toLowerCase()
        );
        if (!entity) return part;

        const cfg = ENTITY_CONFIG[entity.type];
        return (
          <motion.span
            key={i}
            className={cfg.className}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            onMouseEnter={(ev) => {
              const rect = (ev.target as HTMLElement).getBoundingClientRect();
              onEntityHover(entity, rect.left, rect.top);
            }}
            onMouseLeave={() => onEntityHover(null, 0, 0)}
          >
            {part}
          </motion.span>
        );
      })}
    </p>
  );
}

// ─── Entity card ──────────────────────────────────────────────────────────────

interface EntityCardProps {
  entity: Entity;
}

function EntityCard({ entity }: EntityCardProps) {
  const cfg = ENTITY_CONFIG[entity.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all duration-150"
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md mt-0.5"
        style={{ backgroundColor: cfg.bg }}
      >
        <cfg.Icon size={13} style={{ color: cfg.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-900 truncate">{entity.text}</span>
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        {entity.description && (
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
            {entity.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${entity.confidence * 100}%`, backgroundColor: cfg.color }}
            />
          </div>
          <span className="text-[10px] text-slate-500 flex-shrink-0 data-mono">
            {(entity.confidence * 100).toFixed(0)}%
          </span>
          <span className="text-[10px] text-slate-400">
            {entity.mentions}x
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── EntityExplorer ───────────────────────────────────────────────────────────

interface EntityExplorerProps {
  accession: string;
  compact?: boolean;
}

export default function EntityExplorer({ accession, compact = false }: EntityExplorerProps) {
  const [data, setData] = useState<StudyWithEntities | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ entity: Entity; x: number; y: number } | null>(null);
  const [filter, setFilter] = useState<Entity["type"] | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchEntities(accession);
    setData(result);
    setLoading(false);
  }, [accession]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEntityHover = (entity: Entity | null, x: number, y: number) => {
    if (entity) setTooltip({ entity, x, y });
    else setTooltip(null);
  };

  const filteredEntities =
    data?.entities.filter((e) => filter === "all" || e.type === filter) ?? [];

  const counts = data?.entities.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="shimmer h-5 w-40 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="shimmer h-48 rounded" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="shimmer h-12 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Entity Explorer</h2>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-brand-700">
              {data.accession}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{data.title}</p>
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-brand-600" />}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-shrink-0 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={clsx(
            "rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-150",
            filter === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
          )}
        >
          All ({data.entities.length})
        </button>
        {(Object.keys(ENTITY_CONFIG) as Entity["type"][]).map((type) => {
          const cfg = ENTITY_CONFIG[type];
          const count = counts?.[type] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all duration-150"
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

      {/* Content */}
      <div className={clsx("flex gap-0 flex-1 min-h-0", compact ? "flex-col" : "")}>
        {/* Raw annotated text */}
        <div
          className={clsx(
            "overflow-y-auto p-5",
            compact ? "max-h-48" : "flex-1 border-r border-slate-100"
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">
            Annotated Abstract
          </p>
          <AnnotatedText
            text={data.rawText}
            entities={data.entities}
            onEntityHover={handleEntityHover}
          />
        </div>

        {/* Entity list */}
        <div
          className={clsx(
            "overflow-y-auto p-4",
            compact ? "" : "w-72 flex-shrink-0"
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-3">
            Extracted Entities ({filteredEntities.length})
          </p>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredEntities.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tooltip portal */}
      <AnimatePresence>
        {tooltip && (
          <EntityTooltip
            entity={tooltip.entity}
            x={tooltip.x}
            y={tooltip.y}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
