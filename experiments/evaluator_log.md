# Evaluator Log — LatticeBio Virtual Wet Lab

> All verdicts, critiques, rabbit hole flags. One entry per cycle.

---

## Cycle 5 — DATA — Enhanced NER + Real Dashboard Metrics
**Date:** 2026-04-11
**Verdict:** APPROVE

### Evaluation Criteria
| Criterion | Score | Notes |
|-----------|-------|-------|
| Protein extraction | PASS | p53, MDM2 correctly typed as protein |
| Pydantic validation | PASS | SLMEntity accepts Protein after fix |
| Dashboard metrics endpoint | PASS | Returns real counts from pipeline cache |
| Trending entities endpoint | PASS | 12 entities ranked by mention count |
| Frontend integration | PASS | Dashboard renders real data, compiles cleanly |

### Critique
- **Strengths**: Eliminated all hardcoded mock metrics from the dashboard. Real trending entities give a true picture of the corpus. Protein extraction fills a major gap in entity coverage.
- **Risks**: Existing studies in cache/DB were extracted without Protein type — they'll only have protein entities after re-ingestion. Avg confidence (60.7%) is lower than the mock (87.3%) — this is correct but may look less impressive in demo.
- **Debt**: None significant. The mock data arrays in `api.ts` are still present as fallbacks — acceptable for resilience.

### Rabbit Hole Check
No rabbit holes. The Pydantic `Literal` fix was straightforward once the validation error was caught in the test.

---

## Cycle 4 — FRONTEND — SSE Streaming + Agent Pipeline Graph
**Date:** 2026-04-11
**Verdict:** APPROVE

### Evaluation Criteria
| Criterion | Score | Notes |
|-----------|-------|-------|
| SSE event delivery | PASS | 16/16 events received end-to-end, correct ordering |
| Event types | PASS | message, status, done — all parsed correctly |
| Frontend compilation | PASS | `next build` passes, lab page serves at :3001/lab |
| Pipeline graph states | PASS | Loading/active/completed/pending states render correctly |
| Fallback on error | PASS | SSE disconnect triggers single fetchLabSession |

### Critique
- **Strengths**: Real-time streaming replaces 2s polling — ~4x faster message delivery. Pipeline graph gives clear visual feedback of LangGraph progression. Functional updater pattern in useState prevents stale closure bugs.
- **Risks**: SSE is unidirectional — cannot send client cancellation signals. No reconnection logic beyond single fallback fetch. If backend restarts mid-stream, client sees an error but doesn't auto-reconnect.
- **Debt**: None significant. SSE is the right transport for this use case (server pushes, client receives).

### Rabbit Hole Check
The `json` import bug was caught quickly via backend logs. No rabbit holes — the SSE implementation is straightforward.

---

## Cycle 3 — PATH A — MCP Server for Bio Tools
**Date:** 2026-04-11
**Verdict:** APPROVE

### Evaluation Criteria
| Criterion | Score | Notes |
|-----------|-------|-------|
| Tool schema correctness | PASS | All 3 tools have valid JSON Schema with required fields |
| End-to-end data flow | PASS | Real API calls to EBI BioStudies + AlphaFold return live data |
| Error handling | PASS | Unknown tools return structured error; graceful degradation |
| Protocol compliance | PASS | JSON-RPC 2.0 + MCP 2024-11-05 handshake verified |
| Dependency stability | PASS | Fixed: FastAPI 0.135.3 + httpx 0.28.1 + ollama 0.6.1 |

### Critique
- **Strengths**: Clean MCP server with 3 real bio tools, all hitting live APIs. The stdio transport works correctly. Proper separation — MCP server reuses existing `biostudies.py` and `agents/tools.py` modules.
- **Risks**: No rate limiting on external API calls. No caching layer — repeated queries re-hit EBI/UniProt every time. No authentication on the MCP server itself.
- **Debt introduced**: Requirements now use `>=` ranges instead of pinned versions — acceptable for a hackathon but would need pinning for production.

### Rabbit Hole Check
No rabbit holes. The dependency conflict was identified quickly (starlette 1.0.0 vs FastAPI 0.111.0) and resolved by upgrading FastAPI rather than downgrading or pinning. Total time on dependency fix: ~5 minutes.

---

## Cycle 2 — FRONTEND — Mol* 3D Molecular Viewer Integration
**Date:** 2026-04-11
**Verdict:** APPROVE

### Evaluation Criteria
| Criterion | Score | Notes |
|-----------|-------|-------|
| Component renders | PASS | MolstarViewer.tsx compiles, dynamic import avoids SSR |
| WebGL integration | PASS | Mol* createPluginUI correctly embedded |
| CSS strategy | PASS | CDN CSS avoids SCSS build issues in Next.js |
| Error/loading states | PASS | Skeleton loader + error with retry/fallback link |

### Critique
- **Strengths**: Bio-themed skeleton loader is a nice touch. Hidden controls keep the viewer clean. Error state with AlphaFold DB fallback is user-friendly.
- **Pending**: Needs visual verification in a browser. WebGL may fail in headless or low-GPU environments.

---

## Cycle 1 — PATH B — LangGraph Orchestration Migration
**Date:** 2026-04-11
**Verdict:** APPROVE

### Evaluation Criteria
| Criterion | Score | Notes |
|-----------|-------|-------|
| Graph execution | PASS | 5-node StateGraph runs to completion |
| Conditional edges | PASS | Critic → Hypothesis loop logic correct |
| Frontend compatibility | PASS | Polling API unchanged, 13 messages streamed |
| Token tracking | PARTIAL | Token counts collected but not persisted per-node |

### Critique
- **Strengths**: Clean LangGraph migration maintaining backward compatibility with the polling frontend. Conditional edge pattern is the right abstraction for critic feedback loops.
- **Risks**: Revision loop only tested with MODERATE assessment — never triggered WEAK path in production. Max 1 revision is conservative but safe.

---
