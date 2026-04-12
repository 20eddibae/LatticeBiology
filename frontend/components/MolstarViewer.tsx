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
 * Mol* (Molstar) 3D protein structure viewer.
 *
 * Fix notes (blank viewer bug):
 * - Container MUST be position:relative with explicit dimensions so Molstar's
 *   internal position:absolute layout can anchor to it.
 * - The globals.css no longer overrides .msp-plugin position/sizing, which was
 *   collapsing the internal canvas to 0 height.
 */
export default function MolstarViewer({
  pdbUrl,
  proteinName,
  accession,
  alphafoldUrl,
  height = 400,
  perResiduePlddt,
  bindingInterface,
}: MolstarViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showInterface, setShowInterface] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !pdbUrl) return;

    try {
      setStatus("loading");
      setErrorMsg("");

      // Dynamically import Mol* to avoid SSR issues
      console.log("MolstarViewer: Importing Mol* libraries...");
      const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
      const { DefaultPluginUISpec } = await import("molstar/lib/mol-plugin-ui/spec");
      const { renderReact18 } = await import("molstar/lib/mol-plugin-ui/react18");

      if (!containerRef.current) {
        console.warn("MolstarViewer: Container ref lost during import");
        return;
      }

      // Clean up previous plugin
      if (pluginRef.current) {
        try { pluginRef.current.dispose(); } catch {}
        pluginRef.current = null;
      }
      containerRef.current.innerHTML = "";

      const plugin = await createPluginUI({
        target: containerRef.current,
        render: renderReact18,
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

      // Dark background for molecular visualization
      if (plugin.canvas3d) {
        plugin.canvas3d.setProps({
          renderer: {
            backgroundColor: 0x0f172a as any, // slate-900
          },
        });
      }

      // Determine file format from URL
      const isCif = pdbUrl.includes(".cif");
      const isBinary = pdbUrl.endsWith(".bcif");
      const format = isCif ? "mmcif" : "pdb";

      // Download structure
      const data = await plugin.builders.data.download(
        { url: pdbUrl, isBinary },
        { state: { isGhost: false } }
      );

      // Parse trajectory
      const trajectory = await plugin.builders.structure.parseTrajectory(data, format);

      // Apply preset — "auto" detects AlphaFold and applies pLDDT coloring
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
    } catch (err: any) {
      console.error("Mol* initialization error:", err);
      setErrorMsg(err?.message || "Could not render 3D structure");
      setStatus("error");
    }
  }, [pdbUrl]);

  useEffect(() => {
    initViewer();

    return () => {
      if (pluginRef.current) {
        try { pluginRef.current.dispose(); } catch {}
        pluginRef.current = null;
      }
    };
  }, [initViewer]);

  // Stats for header
  const hasResidueData = perResiduePlddt && perResiduePlddt.length > 0;
  const hasInterface =
    bindingInterface &&
    (bindingInterface.interface_residues_a?.length > 0 ||
      bindingInterface.interface_residues_b?.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 border border-teal-200">
            <Atom size={12} className="text-teal-600" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-800">{proteinName}</p>
            <p className="text-[9px] font-mono text-slate-400">{accession}</p>
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
              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-teal-600 transition-colors"
            >
              <RotateCcw size={8} />
              Retry
            </button>
          )}
          <a
            href={alphafoldUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] text-teal-600 hover:text-teal-800 font-medium transition-colors"
          >
            <ExternalLink size={8} />
            AlphaFold
          </a>
        </div>
      </div>

      {/* pLDDT legend bar */}
      {hasResidueData && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">pLDDT</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span className="text-[9px] text-slate-500">&gt;90</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span className="text-[9px] text-slate-500">70-90</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
              <span className="text-[9px] text-slate-500">50-70</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <span className="text-[9px] text-slate-500">&lt;50</span>
            </div>
          </div>
          {hasInterface && showInterface && (
            <>
              <span className="text-slate-300 mx-0.5">|</span>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                <span className="text-[9px] text-slate-500">Binding interface</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Viewer container — position:relative is REQUIRED for Molstar's
          internal position:absolute layout to work correctly */}
      <div style={{ height, position: "relative", overflow: "hidden" }}>
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="mx-auto mb-3 relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-dashed border-teal-300"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full border border-dashed border-blue-300"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
                <Atom size={18} className="absolute inset-0 m-auto text-teal-600" />
              </div>
              <p className="text-[11px] text-slate-600 font-medium">Rendering {proteinName}...</p>
              <p className="text-[9px] text-slate-400 mt-1 font-mono">{accession}</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95">
            <div className="text-center max-w-xs">
              <AlertCircle size={22} className="mx-auto text-red-400 mb-2" />
              <p className="text-[11px] text-red-600 font-medium mb-1">3D rendering failed</p>
              {errorMsg && <p className="text-[9px] text-slate-500 mb-2">{errorMsg}</p>}
              <a
                href={alphafoldUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800"
              >
                <ExternalLink size={9} />
                View on AlphaFold DB
              </a>
            </div>
          </div>
        )}

        {/* Mol* renders into this div — it creates an internal .msp-plugin
            child with position:absolute;inset:0 that fills this container */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            opacity: status === "ready" ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        />
      </div>

      {/* Binding interface summary */}
      {hasInterface && showInterface && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-violet-100 bg-violet-50/50 px-4 py-2"
        >
          <div className="flex items-center gap-4 text-[9px]">
            <div>
              <span className="text-slate-500">Interface residues: </span>
              <span className="text-violet-700 font-semibold">
                {(bindingInterface!.interface_residues_a?.length || 0) +
                  (bindingInterface!.interface_residues_b?.length || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">H-bonds: </span>
              <span className="text-violet-700 font-semibold">
                {bindingInterface!.hydrogen_bonds?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Area: </span>
              <span className="text-violet-700 font-semibold">
                {bindingInterface!.interface_area_sq_angstrom?.toFixed(0) || "?"} A&sup2;
              </span>
            </div>
            <div>
              <span className="text-slate-500">Type: </span>
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
