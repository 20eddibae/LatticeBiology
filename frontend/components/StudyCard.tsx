"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Users, FlaskConical, Dna, Pill, Target, ExternalLink, type LucideProps } from "lucide-react";
import clsx from "clsx";
import type { Study } from "@/lib/api";

// ─── Confidence ring ──────────────────────────────────────────────────────────

function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const size = 40;
  const sw = 3;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring" aria-hidden>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold" style={{ color }} aria-label={`${value}%`}>
        {value}%
      </span>
    </div>
  );
}

// ─── Entity pill ──────────────────────────────────────────────────────────────

function EntityPill({
  count, label, icon: Icon, textColor, bgColor,
}: {
  count: number;
  label: string;
  icon: React.ComponentType<LucideProps>;
  textColor: string;
  bgColor: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <Icon size={9} />
      {count} {label}
    </span>
  );
}

// ─── StudyCard ────────────────────────────────────────────────────────────────

interface StudyCardProps {
  study: Study;
  isSelected?: boolean;
}

export default function StudyCard({ study, isSelected = false }: StudyCardProps) {
  const router = useRouter();

  const date = new Date(study.releaseDate).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  const confColor =
    study.confidenceScore >= 90 ? "#059669" :
    study.confidenceScore >= 75 ? "#0F766E" : "#D97706";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.18 }}
      onClick={() => router.push(`/explorer?study=${study.accession}`)}
      className={clsx(
        "relative cursor-pointer rounded-xl border bg-white p-4 transition-all duration-150",
        isSelected
          ? "border-brand-300 shadow-card-ring ring-1 ring-brand-200"
          : "border-slate-200 shadow-card hover:border-slate-300"
      )}
      role="button"
      tabIndex={0}
      aria-label={`Open study ${study.accession}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/explorer?study=${study.accession}`);
        }
      }}
    >
      {/* Selected top stripe */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-brand-600" />
      )}

      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-brand-700 tracking-wider">
          {study.accession}
        </span>
        <ConfidenceRing value={study.confidenceScore} color={confColor} />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-sm font-semibold text-slate-900 leading-snug line-clamp-2" title={study.title}>
        {study.title}
      </h3>

      {/* Primary target badge */}
      {study.primaryTarget && (
        <div className="mb-2 flex items-center gap-1">
          <Target size={10} className="text-brand-600 flex-shrink-0" />
          <span className="text-[11px] text-brand-700 font-medium truncate">{study.primaryTarget}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Calendar size={10} />{date}</span>
        <span className="flex items-center gap-1"><Users size={10} />{study.authorCount} authors</span>
      </div>

      {/* Entity pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {study.entityCounts.proteins > 0 && (
          <EntityPill count={study.entityCounts.proteins} label="proteins"
            icon={FlaskConical} textColor="#0369A1" bgColor="#F0F9FF" />
        )}
        {study.entityCounts.genes > 0 && (
          <EntityPill count={study.entityCounts.genes} label="genes"
            icon={Dna} textColor="#6D28D9" bgColor="#F5F3FF" />
        )}
        {study.entityCounts.compounds > 0 && (
          <EntityPill count={study.entityCounts.compounds} label="drugs"
            icon={Pill} textColor="#15803D" bgColor="#F0FDF4" />
        )}
      </div>

      {/* Paper links */}
      {(study.sourceUrl || study.pmid) && (
        <div className="border-t border-slate-100 pt-3 flex gap-2">
          {study.sourceUrl && (
            <motion.a
              href={study.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              whileHover={{ scale: 1.02 }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors"
            >
              <span>BioStudies</span>
              <ExternalLink size={10} />
            </motion.a>
          )}
          {study.pmid && (
            <motion.a
              href={`https://pubmed.ncbi.nlm.nih.gov/${study.pmid}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              whileHover={{ scale: 1.02 }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors"
            >
              <span>PubMed</span>
              <ExternalLink size={10} />
            </motion.a>
          )}
        </div>
      )}
    </motion.article>
  );
}
