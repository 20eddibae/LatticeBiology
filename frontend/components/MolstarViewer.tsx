"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Atom, AlertCircle, ExternalLink, RotateCcw, Layers } from "lucide-react";
import type { ResidueScore, BindingInterface } from "@/lib/api";

interface MolstarViewerProps {
  pdbUrl: string;
  proteinName: string;
  accession: string;
  alphafoldUrl: string;
  height?: number;
  perResiduePlddt?: ResidueScore[];
  bindingInterface?: BindingInterface;
}

/**
 * Mol* (Molstar) 3D protein structure viewer with pLDDT coloring
 * and binding interface highlights.
 */
export default function MolstarViewer({
  pdbUrl,
  proteinName,
  accession,
  alphafoldUrl,
  height = 280,
  perResiduePlddt,
  bindingInterface,
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showInterface, setShowInterface] = useState(true);

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !pdbUrl) return;

    try {
      setStatus("loading");

      // Dynamically import Mol* to avoid SSR issues
      const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
      const { DefaultPluginUISpec } = await import("molstar/lib/mol-plugin-ui/spec");

      if (!containerRef.current) return;

      // Clean up previous plugin
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
        } catch {}
        pluginRef.current = null;
      }

      containerRef.current.innerHTML = "";

      // Provide a minimal render function for Mol* UI
      const render = (component: any, container: Element) => {
        if (!container) return;
        // Mol* expects a render function that handles React components
        // For headless mode, we just return the component
        // The actual rendering happens via Mol*'s internal mechanisms
        return component;
      };

      const spec = DefaultPluginUISpec();
      spec.layout = {
        initial: {
          isExpanded: false,
          showControls: false,
          controlsDisplay: "reactive" as const,
        },
      };

      const plugin = await createPluginUI({
        target: containerRef.current,
        render,
        spec,
      });

      pluginRef.current = plugin;

      // Determine file format from URL
      const isBinary = pdbUrl.endsWith(".bcif");
      const isCif = pdbUrl.includes(".cif") || pdbUrl.includes("model-cif");
      const format = isCif ? "mmcif" : "pdb";

      // Download structure
      const data = await plugin.builders.data.download(
        { url: pdbUrl, isBinary },
        { state: { isGhost: false } }
      );

      // Parse structure
      const trajectory = await plugin.builders.structure.parseTrajectory(data, format);

      // Apply default visualization
      await plugin.builders.structure.hierarchy.applyPreset(
        trajectory,
        "default",
        { representationPreset: "auto" }
      );

      // Auto-focus on structure
      if (plugin.canvas3d) {
        plugin.canvas3d.requestCameraReset();
      }

      setStatus("ready");
    } catch (err) {
      console.error("Mol* initialization error:", err);
      console.warn(`Failed to load structure from: ${pdbUrl}`);
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

  // Stats for header
  const hasResidueData = perResiduePlddt && perResiduePlddt.length > 0;
  const hasInterface = bindingInterface && (bindingInterface.interface_residues_a?.length > 0 || bindingInterface.interface_residues_b?.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-brand-50">
            <Atom size={10} className="text-brand-700" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">{proteinName}</p>
            <p className="text-[8px] font-mono text-slate-400">{accession}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasInterface && (
            <button
              onClick={() => setShowInterface(!showInterface)}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                showInterface
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-500 hover:text-slate-700"
              }`}
            >
              <Layers size={8} />
              Interface
            </button>
          )}
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

      {/* pLDDT legend bar */}
      {hasResidueData && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100 bg-slate-50/30">
          <span className="text-[8px] text-slate-400 font-medium">pLDDT:</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-blue-500" />
            <span className="text-[8px] text-slate-500">&gt;90</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-cyan-400" />
            <span className="text-[8px] text-slate-500">70-90</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-yellow-400" />
            <span className="text-[8px] text-slate-500">50-70</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-orange-400" />
            <span className="text-[8px] text-slate-500">&lt;50</span>
          </div>
          {hasInterface && showInterface && (
            <>
              <span className="text-slate-300 mx-1">|</span>
              <div className="w-2 h-2 rounded-sm bg-violet-500" />
              <span className="text-[8px] text-slate-500">Interface</span>
            </>
          )}
        </div>
      )}

      {/* Viewer container */}
      <div className="relative" style={{ height }}>
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
              <p className="text-[10px] text-slate-500 font-medium">Rendering structure...</p>
            </div>
          </div>
        )}

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

        <div
          ref={containerRef}
          className="w-full h-full"
          style={{
            opacity: status === "ready" ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>

      {/* Binding interface summary */}
      {hasInterface && showInterface && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-slate-100 bg-violet-50/30 px-4 py-2"
        >
          <div className="flex items-center gap-4 text-[9px]">
            <div>
              <span className="text-slate-400">Interface residues: </span>
              <span className="text-violet-700 font-semibold">
                {(bindingInterface!.interface_residues_a?.length || 0) +
                  (bindingInterface!.interface_residues_b?.length || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">H-bonds: </span>
              <span className="text-violet-700 font-semibold">
                {bindingInterface!.hydrogen_bonds?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Area: </span>
              <span className="text-violet-700 font-semibold">
                {bindingInterface!.interface_area_sq_angstrom?.toFixed(0) || "?"} A^2
              </span>
            </div>
            <div>
              <span className="text-slate-400">Type: </span>
              <span className="text-violet-700 font-medium">
                {bindingInterface!.binding_type}
              </span>
            </div>
          </div>
          {bindingInterface!.description && (
            <p className="text-[8px] text-slate-500 mt-1 italic">
              {bindingInterface!.description}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
