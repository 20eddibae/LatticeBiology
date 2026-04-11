"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SmilesRendererProps {
  smiles: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function SmilesRenderer({
  smiles,
  width = 260,
  height = 200,
  className = "",
}: SmilesRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!smiles || !canvasRef.current) {
      setLoaded(true); // Mark as loaded even if no SMILES so layout doesn't break
      return;
    }

    setError(false);
    setLoaded(false);

    let cancelled = false;

    (async () => {
      try {
        // smiles-drawer is a CJS module — dynamic import for Next.js SSR safety
        const SmilesDrawer = (await import("smiles-drawer")).default;
        if (cancelled) return;

        const drawer = new SmilesDrawer.Drawer({
          width,
          height,
          bondThickness: 1.5,
          bondLength: 15,
          shortBondLength: 0.85,
          fontSizeLarge: 6,
          fontSizeSmall: 4,
          padding: 16,
          themes: {
            dark: {
              C: "#94a3b8",   // slate-400
              O: "#f87171",   // red-400
              N: "#60a5fa",   // blue-400
              S: "#fbbf24",   // amber-400
              F: "#34d399",   // emerald-400
              Cl: "#34d399",
              Br: "#a78bfa",  // violet-400
              I: "#c084fc",
              P: "#fb923c",   // orange-400
              H: "#64748b",
              BACKGROUND: "#0f172a00", // transparent
            },
          },
        });

        SmilesDrawer.parse(smiles, (tree: any) => {
          if (cancelled) return;
          drawer.draw(tree, canvasRef.current!, "dark");
          setLoaded(true);
        }, () => {
          if (!cancelled) setError(true);
        });
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [smiles, width, height]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 rounded-lg border border-slate-700/50 ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-slate-500 font-mono">Invalid SMILES</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0.3 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg"
      />
    </motion.div>
  );
}
