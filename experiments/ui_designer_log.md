# UI Designer Log — LatticeBio Virtual Wet Lab

> Frontend sprints, design decisions, component states. One entry per cycle.

---

## Cycle 4 — FRONTEND — SSE Streaming + Agent Pipeline Graph
**Date:** 2026-04-11
**Verdict:** APPROVE

### What Was Tested
Replaced 2-second polling (`setInterval` + `fetchLabSession`) with Server-Sent Events for real-time agent message streaming. Added visual agent pipeline graph showing LangGraph node progression in the right sidebar.

### Results
- **Backend**: New SSE endpoint `/api/lab/session/{id}/stream` using `sse-starlette.EventSourceResponse`
  - 3 event types: `message` (agent messages), `status` (session state changes), `done` (completion)
  - 0.5s internal poll of shared session dict; yields only new/changed data
- **Frontend**: `streamLabSession()` in api.ts wraps `EventSource` with typed callbacks
  - Lab page uses `useRef` cleanup pattern for SSE lifecycle
  - Fallback to single `fetchLabSession` on SSE connection error
- **Pipeline Graph**: 5-node vertical timeline (PI Analysis → AlphaFold → Hypothesis → Critic → Synthesis)
  - Active node shows spinning loader + "running" badge
  - Completed nodes show green checkmarks
  - Pending nodes show grey icons
  - Revision loop indicator when hypothesis node re-activates
- **End-to-end SSE test**: 16 events streamed for `TP53 apoptosis regulation` query — 13 agent messages, 2 status changes, 1 done event
- Frontend compiles cleanly (`next build` passes)

### Key Findings
- `sse-starlette` requires `import json` explicitly — uvicorn reload masked the NameError until runtime
- React's `useState` functional updater (`setSession(prev => ...)`) is essential for SSE callbacks to avoid stale closures
- `request.is_disconnected()` check prevents orphan generators when clients disconnect

### Failed Approaches
- Missing `import json` in main.py caused SSE generator to crash silently (peer closed connection without complete message body)

### Next Steps
- Test WebSocket transport for bidirectional communication
- Add per-message latency tracking in the pipeline graph

---

## Cycle 2 — FRONTEND — Mol* 3D Molecular Viewer Integration
**Date:** 2026-04-11
**Verdict:** APPROVE

### What Was Tested
Integrated Mol* (Molstar) 3D protein structure viewer into the Virtual Lab page. When LangGraph returns AlphaFold results with a `pdb_url`, the viewer renders the 3D structure interactively.

### Results
- `MolstarViewer.tsx` component created with dynamic import (ssr: false)
- Bio-themed skeleton loader: double rotating orbit + Atom icon
- Error state with retry button and AlphaFold DB fallback link
- Mol* CSS loaded via CDN `<link>` in layout.tsx (avoids SCSS build issues)
- Lab page compiles (200 OK), PDB URL for p53 verified: `AF-P04637-F1-model_v6.pdb`
- Installed: `molstar`, `sass`

### Key Findings
- Mol* SCSS imports (`@use 'base/base'`) don't work in Next.js CSS pipeline — CDN CSS is the pragmatic solution
- `createPluginUI` is the correct API for embedding Mol* in React — simpler than raw PluginContext
- Hidden Mol* controls (`showControls: false`) keeps the viewer clean for our layout

### Failed Approaches
- Direct `@import "molstar/lib/mol-plugin-ui/skin/light.scss"` in globals.css — requires sass `@use` resolution that Next.js can't handle

### Next Steps
- Full visual test in browser
- Add SSE/WebSocket streaming to replace 2-second polling
- Add agent state graph/timeline visualization

---
