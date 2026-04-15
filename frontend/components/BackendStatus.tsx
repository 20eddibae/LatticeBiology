"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ServerCrash, Wifi } from "lucide-react";

type Status = "checking" | "waking" | "connected" | "unavailable";

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    // Show "waking up" after 3s of no response
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsed(s);
      if (s >= 3 && status === "checking") {
        setStatus("waking");
      }
    }, 500);

    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((res) => {
        if (!cancelled && res.ok) {
          setStatus("connected");
        } else if (!cancelled) {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      })
      .finally(() => {
        if (timer) clearInterval(timer);
      });

    // Hard timeout at 90s
    const timeout = setTimeout(() => {
      controller.abort();
      if (!cancelled) setStatus("unavailable");
    }, 90000);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide the "connected" banner after 2s
  useEffect(() => {
    if (status === "connected") {
      const t = setTimeout(() => setStatus("checking"), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  // Don't render anything in the initial check or after connected fades
  if (status === "checking") return null;

  return (
    <AnimatePresence>
      {status === "waking" && (
        <motion.div
          key="waking"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-teal-700 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            Server is waking up — free tier cold start ({elapsed}s)...
          </span>
        </motion.div>
      )}

      {status === "connected" && (
        <motion.div
          key="connected"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <Wifi className="h-4 w-4" />
          <span>Backend connected</span>
        </motion.div>
      )}

      {status === "unavailable" && (
        <motion.div
          key="unavailable"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <ServerCrash className="h-4 w-4" />
          <span>Could not reach the backend — showing demo data</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
