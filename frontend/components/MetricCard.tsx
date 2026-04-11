"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";
import type { LucideProps } from "lucide-react";

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

function Sparkline({ data, color, width = 72, height = 28 }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const toY = (v: number) => height - ((v - min) / range) * (height - 4) - 2;
  const points = data.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");
  const area = [
    `0,${height}`,
    ...data.map((v, i) => `${i * stepX},${toY(v)}`),
    `${width},${height}`,
  ].join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <polygon points={area} fill={color} fillOpacity={0.1} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) * stepX}
        cy={toY(data[data.length - 1])}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

export interface MetricCardProps {
  title: string;
  value: string;
  delta?: string;
  icon: React.ComponentType<LucideProps>;
  color?: "teal" | "blue" | "violet" | "emerald";
  sparklineData?: number[];
  loading?: boolean;
}

const PALETTE = {
  teal:    { hex: "#0F766E", text: "text-brand-700",   icon: "bg-brand-50"   },
  blue:    { hex: "#2563EB", text: "text-blue-700",    icon: "bg-blue-50"    },
  violet:  { hex: "#7C3AED", text: "text-violet-700",  icon: "bg-violet-50"  },
  emerald: { hex: "#059669", text: "text-emerald-700", icon: "bg-emerald-50" },
};

function parseDelta(delta?: string) {
  if (!delta) return { sign: "neutral" as const, value: "—" };
  if (delta.startsWith("+")) return { sign: "up"      as const, value: delta };
  if (delta.startsWith("-")) return { sign: "down"    as const, value: delta };
  return { sign: "neutral" as const, value: delta };
}

export default function MetricCard({
  title, value, delta, icon: Icon, color = "teal",
  sparklineData = [40, 55, 48, 62, 58, 71, 68, 75, 70, 82, 79, 88],
  loading = false,
}: MetricCardProps) {
  const p = PALETTE[color];
  const { sign, value: deltaVal } = parseDelta(delta);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="shimmer h-4 w-24 rounded mb-4" />
        <div className="shimmer h-8 w-28 rounded mb-2" />
        <div className="shimmer h-3 w-16 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-card cursor-default"
      role="region"
      aria-label={`${title}: ${value}`}
    >
      {/* Top color stripe */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${p.hex}30, ${p.hex}90, ${p.hex}30)` }}
      />

      <div className="flex items-start justify-between">
        <div className={clsx("flex h-9 w-9 items-center justify-center rounded-lg", p.icon)}>
          <Icon size={17} className={p.text} />
        </div>
        <Sparkline data={sparklineData} color={p.hex} />
      </div>

      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-slate-900 data-mono">{value}</p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      </div>

      {delta && (
        <div className="mt-3 flex items-center gap-1.5">
          {sign === "up"      && <TrendingUp  size={12} className="text-emerald-600" />}
          {sign === "down"    && <TrendingDown size={12} className="text-red-500"    />}
          {sign === "neutral" && <Minus        size={12} className="text-slate-400"  />}
          <span className={clsx(
            "text-xs font-semibold",
            sign === "up"      && "text-emerald-700",
            sign === "down"    && "text-red-600",
            sign === "neutral" && "text-slate-500",
          )}>
            {deltaVal}
          </span>
          <span className="text-xs text-slate-400">vs last week</span>
        </div>
      )}
    </motion.div>
  );
}
