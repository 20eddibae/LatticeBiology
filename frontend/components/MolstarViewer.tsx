"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Atom, AlertCircle, ExternalLink, RotateCcw } from "lucide-react";

interface MolstarViewerProps {
  pdbUrl: string;
  proteinName: string;
  accession: string;
  alphafoldUrl: string;
  height?: number;
}

/**
 * Mol* (Molstar) 3D protein structure viewer.
 * Uses the pre-built molstar Viewer class for reliable WebGL init.
 * Dynamically imported to avoid SSR (Next.js).
 */
export default function MolstarViewer({
  pdbUrl,
  proteinName,
  accession,
  alphafoldUrl,
  height = 280,
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !pdbUrl) return;

    try {
      setStatus("loading");

      // Import Mol* dynamically
      const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
      const { DefaultPluginUISpec } = await import("molstar/lib/mol-plugin-ui/spec");

      // Mol* CSS is loaded via globals.css link tag instead of SCSS import

      if (!containerRef.current) return;

      // Dispose previous instance
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = "";

      // React 18 render function for Mol* UI components
      const { createRoot } = await import("react-dom/client");
      const renderFn = (component: any, container: Element) => {
        const root = createRoot(container);
        root.render(component);
        return root;
      };

      // Create plugin with minimal UI — hide all panels
      const plugin = await createPluginUI({
        target: containerRef.current,
        render: renderFn,
        spec: {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              controlsDisplay: "reactive" as const,
            },
          },
        },
      });

      pluginRef.current = plugin;

      // Load structure from URL
      const isCif = pdbUrl.endsWith(".cif") || pdbUrl.endsWith(".bcif") || pdbUrl.includes("model-cif");
      const data = await plugin.builders.data.download(
        { url: pdbUrl, isBinary: pdbUrl.endsWith(".bcif") },
        { state: { isGhost: true } }
      );

      const trajectory = await plugin.builders.structure.parseTrajectory(
        data,
        isCif ? "mmcif" : "pdb"
      );

      await plugin.builders.structure.hierarchy.applyPreset(
        trajectory,
        "default",
        { representationPreset: "auto" }
      );

      // Reset camera to focus on structure
      plugin.canvas3d?.requestCameraReset();

      setStatus("ready");
    } catch (err) {
      console.error("Mol* init error:", err);
      setStatus("error");
    }
  }, [pdbUrl]);

  useEffect(() => {
    initViewer();

    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
        } catch {}
        pluginRef.current = null;
      }
    };
  }, [initViewer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-brand-50">
            <Atom size={10} className="text-brand-700" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">{proteinName}</p>
            <p className="text-[8px] font-mono text-slate-400">{accession}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {status === "error" && (
            <button
              onClick={initViewer}
              className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-brand-600 transition-colors"
            >
              <RotateCcw size={8} />
              Retry
            </button>
          )}
          <a
            href={alphafoldUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] text-brand-600 hover:text-brand-800 font-medium transition-colors"
          >
            <ExternalLink size={8} />
            AlphaFold
          </a>
        </div>
      </div>

      {/* Viewer container */}
      <div className="relative" style={{ height }}>
        {/* Loading state — bio-themed skeleton */}
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="mx-auto mb-3 relative w-14 h-14">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-dashed border-brand-200"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full border border-dashed border-teal-200"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
                <Atom size={16} className="absolute inset-0 m-auto text-brand-400" />
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Rendering structure…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-50/30">
            <div className="text-center">
              <AlertCircle size={18} className="mx-auto text-red-300 mb-2" />
              <p className="text-[10px] text-red-500 font-medium">3D rendering unavailable</p>
              <a
                href={alphafoldUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-brand-600 hover:text-brand-800"
              >
                <ExternalLink size={8} />
                View on AlphaFold DB
              </a>
            </div>
          </div>
        )}

        {/* Mol* renders into this div */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{
            opacity: status === "ready" ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </motion.div>
  );
}
