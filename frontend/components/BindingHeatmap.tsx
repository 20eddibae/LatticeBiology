"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut } from "lucide-react";

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
  if (val <= -5) return "#0c4a6e";   // slate-900 blue
  if (val <= -3) return "#0369a1";   // cyan-700
  if (val <= -1.5) return "#0ea5e9"; // sky-400
  if (val <= -0.5) return "#38bdf8"; // sky-300
  if (val < 0.5) return "#f8fafc";  // slate-50
  if (val < 1.5) return "#fed7aa";  // amber-200
  if (val < 3) return "#fb923c";    // amber-500
  return "#b91c1c";                  // red-800
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
  const [zoom, setZoom] = useState(1);

  if (!matrix) return null;

  const { rows, cols, values, unit } = matrix;
  if (!rows?.length || !cols?.length || !values?.length) {
    return (
      <div className="flex items-center justify-center h-[240px] text-slate-400 text-[11px] rounded-lg border border-slate-200 bg-slate-50">
        No energy data available
      </div>
    );
  }

  const baseSize = 40;
  const cellSize = baseSize * zoom;
  const labelWidth = 70;
  const labelHeight = 60;
  const padding = 12;
  const svgWidth = labelWidth + cols.length * cellSize + padding * 2;
  const svgHeight = labelHeight + rows.length * cellSize + padding * 2;

  // Calculate the min/max for better color scaling context
  const flatValues = values.flat();
  const minVal = Math.min(...flatValues);
  const maxVal = Math.max(...flatValues);
  const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
    >
      {/* Header with title and zoom controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50">
        <div>
          <p className="text-sm font-semibold text-slate-900">Binding Energy Landscape</p>
          <p className="text-[10px] text-slate-500 mt-1">Per-residue interaction strength map</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(Math.max(0.7, zoom - 0.1))}
            disabled={zoom <= 0.7}
            className="p-1.5 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} className="text-slate-600" />
          </button>
          <div className="text-[10px] text-slate-500 font-mono w-8 text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            disabled={zoom >= 2}
            className="p-1.5 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Heatmap container with scroll */}
      <div className="overflow-auto p-4" style={{ maxHeight: "400px" }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          className="font-mono mx-auto"
          onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
          style={{ minWidth: "100%", height: "auto" }}
        >
          {/* Column headers (rotated) */}
          {cols.map((col, j) => (
            <text
              key={`col-${j}`}
              x={labelWidth + padding + j * cellSize + cellSize / 2}
              y={labelHeight - 10}
              textAnchor="end"
              className="text-[9px] fill-slate-600 font-medium"
              transform={`rotate(-45, ${labelWidth + padding + j * cellSize + cellSize / 2}, ${labelHeight - 10})`}
            >
              {col}
            </text>
          ))}

          {/* Row headers */}
          {rows.map((row, i) => (
            <text
              key={`row-${i}`}
              x={labelWidth - 8}
              y={labelHeight + padding + i * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              className="text-[9px] fill-slate-600 font-medium"
            >
              {row}
            </text>
          ))}

          {/* Heatmap cells */}
          {values.map((rowVals, i) =>
            rowVals.map((val, j) => (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={labelWidth + padding + j * cellSize}
                  y={labelHeight + padding + i * cellSize}
                  width={Math.max(cellSize - 1, 2)}
                  height={Math.max(cellSize - 1, 2)}
                  rx={2}
                  fill={energyToColor(val)}
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                  className="cursor-pointer hover:stroke-slate-400 hover:stroke-[2] transition-all"
                  style={{
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.05))",
                  }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    const parent = (e.target as SVGRectElement).closest(".overflow-auto")?.getBoundingClientRect();
                    if (parent) {
                      setTooltip({
                        visible: true,
                        x: rect.left - parent.left + rect.width / 2,
                        y: rect.top - parent.top - 8,
                        row: rows[i],
                        col: cols[j],
                        value: val,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
                />
                {cellSize > 20 && (
                  <text
                    x={labelWidth + padding + j * cellSize + cellSize / 2}
                    y={labelHeight + padding + i * cellSize + cellSize / 2 + 2}
                    textAnchor="middle"
                    className="text-[7px] pointer-events-none font-semibold"
                    fill={Math.abs(val) > absMax * 0.6 ? "#fff" : "#475569"}
                  >
                    {val.toFixed(1)}
                  </text>
                )}
              </g>
            ))
          )}
        </svg>
      </div>

      {/* Color scale legend */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-medium text-slate-600 uppercase tracking-wide">Energy scale</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-slate-500 whitespace-nowrap">Attractive</span>
          <div className="flex h-3 rounded-sm overflow-hidden flex-1">
            {["#0c4a6e", "#0369a1", "#0ea5e9", "#38bdf8", "#f8fafc", "#fed7aa", "#fb923c", "#b91c1c"].map((c) => (
              <div key={c} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="text-[8px] text-slate-500 whitespace-nowrap">Repulsive</span>
        </div>
        <div className="flex items-center justify-between text-[8px] text-slate-500">
          <span>{minVal.toFixed(1)} {unit}</span>
          <span className="font-semibold">{energyLabel(0)}</span>
          <span>{maxVal.toFixed(1)} {unit}</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-50 pointer-events-none bg-slate-900/95 text-white rounded-lg px-3 py-2 text-[11px] shadow-lg border border-slate-700/50 backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-100">{tooltip.row}</span>
            <span className="text-slate-400">↔</span>
            <span className="font-semibold text-slate-100">{tooltip.col}</span>
          </div>
          <div className="font-mono text-teal-300 font-bold">{tooltip.value.toFixed(2)} {unit}</div>
          <div className="text-slate-300 text-[10px]">{energyLabel(tooltip.value)}</div>
        </motion.div>
      )}
    </motion.div>
  );
}
