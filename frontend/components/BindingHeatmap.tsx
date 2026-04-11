"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export interface BindingEnergyMatrix {
  rows: string[];
  cols: string[];
  values: number[][];
  unit: string;
}

interface BindingHeatmapProps {
  matrix: BindingEnergyMatrix;
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  row: string;
  col: string;
  value: number;
}

function energyToColor(val: number): string {
  // Attractive (negative) = blue, neutral (0) = white, repulsive (positive) = red
  if (val <= -5) return "#1e40af";   // deep blue
  if (val <= -3) return "#2563eb";   // blue
  if (val <= -1.5) return "#60a5fa"; // light blue
  if (val <= -0.5) return "#93c5fd"; // very light blue
  if (val < 0.5) return "#f1f5f9";  // near-white/slate
  if (val < 1.5) return "#fca5a5";  // light red
  if (val < 3) return "#ef4444";    // red
  return "#b91c1c";                  // deep red
}

function energyLabel(val: number): string {
  if (val <= -3) return "Strong attraction";
  if (val <= -1) return "Moderate attraction";
  if (val < -0.1) return "Weak attraction";
  if (val <= 0.1) return "No interaction";
  if (val <= 1) return "Weak repulsion";
  if (val <= 3) return "Moderate repulsion";
  return "Strong repulsion";
}

export default function BindingHeatmap({ matrix, className = "" }: BindingHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, row: "", col: "", value: 0,
  });

  if (!matrix) return null;

  const { rows, cols, values, unit } = matrix;
  if (!rows?.length || !cols?.length || !values?.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-400 text-[11px]">
        No energy data available
      </div>
    );
  }

  const cellSize = 44;
  const labelWidth = 70;
  const labelHeight = 60;
  const svgWidth = labelWidth + cols.length * cellSize + 20;
  const svgHeight = labelHeight + rows.length * cellSize + 20;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`relative ${className}`}
    >
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="font-mono"
          onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
        >
          {/* Column headers (rotated) */}
          {cols.map((col, j) => (
            <text
              key={`col-${j}`}
              x={labelWidth + j * cellSize + cellSize / 2}
              y={labelHeight - 6}
              textAnchor="start"
              className="text-[9px] fill-slate-500"
              transform={`rotate(-45, ${labelWidth + j * cellSize + cellSize / 2}, ${labelHeight - 6})`}
            >
              {col}
            </text>
          ))}

          {/* Row headers */}
          {rows.map((row, i) => (
            <text
              key={`row-${i}`}
              x={labelWidth - 6}
              y={labelHeight + i * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              className="text-[9px] fill-slate-500"
            >
              {row}
            </text>
          ))}

          {/* Heatmap cells */}
          {values.map((rowVals, i) =>
            rowVals.map((val, j) => (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={labelWidth + j * cellSize}
                  y={labelHeight + i * cellSize}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  rx={3}
                  fill={energyToColor(val)}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  className="cursor-pointer transition-all hover:stroke-slate-700 hover:stroke-width-2 drop-shadow-sm hover:drop-shadow-md"
                  style={{
                    filter: `drop-shadow(0 0 4px rgba(0,0,0,0)) transition(filter 0.2s)`,
                  }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    const parent = (e.target as SVGRectElement).closest(".relative")?.getBoundingClientRect();
                    setTooltip({
                      visible: true,
                      x: rect.left - (parent?.left || 0) + rect.width / 2,
                      y: rect.top - (parent?.top || 0) - 8,
                      row: rows[i],
                      col: cols[j],
                      value: val,
                    });
                  }}
                  onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
                />
                <text
                  x={labelWidth + j * cellSize + (cellSize - 2) / 2}
                  y={labelHeight + i * cellSize + (cellSize - 2) / 2 + 3}
                  textAnchor="middle"
                  className="text-[8px] pointer-events-none"
                  fill={Math.abs(val) > 2 ? "#fff" : "#475569"}
                >
                  {val.toFixed(1)}
                </text>
              </g>
            ))
          )}
        </svg>
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-500">
        <span>Repulsive</span>
        <div className="flex h-3 rounded-sm overflow-hidden">
          {["#b91c1c", "#ef4444", "#fca5a5", "#f1f5f9", "#93c5fd", "#60a5fa", "#2563eb", "#1e40af"].map((c) => (
            <div key={c} className="w-5" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>Attractive</span>
        <span className="text-slate-400 ml-2">({unit})</span>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="absolute z-30 pointer-events-none bg-slate-900/95 text-white rounded-lg px-3 py-2 text-[11px] shadow-lg border border-slate-700/50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">{tooltip.row} ↔ {tooltip.col}</p>
          <p className="font-mono text-teal-400">{tooltip.value.toFixed(2)} {unit}</p>
          <p className="text-slate-400 text-[10px]">{energyLabel(tooltip.value)}</p>
        </div>
      )}
    </motion.div>
  );
}
