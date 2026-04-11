# Researcher Log — LatticeBio Virtual Wet Lab

> Backend experiments, API tests, pipeline results. One entry per cycle.

---

## Cycle 5 — DATA — Enhanced NER + Real Dashboard Metrics
**Date:** 2026-04-11
**Verdict:** APPROVE

### What Was Tested
1. Added `Protein` entity type to NER extraction (previously only Disease, Gene, Drug, Pathway)
2. Created `/api/dashboard/metrics` endpoint returning real aggregated statistics
3. Created `/api/dashboard/trending` endpoint returning entity rankings from actual study data
4. Wired frontend dashboard to use real backend data instead of hardcoded mock values

### Results
- **NER test**: `p53 + MDM2 apoptosis` text → 5 entities extracted: p53 (protein), MDM2 (protein), BAX (gene), BCL-2 (gene), Nutlin-3a (compound)
- **Dashboard metrics**: 18 studies indexed, 101 entities, 100% uptime, 60.7% avg confidence
- **Trending entities**: 12 entities ranked by occurrence — BRCA1 (18), EGFR (15), BRCA2 (14), PCSK9 (14), lung cancer (13), ACE2 receptor (12), etc.
- Frontend compiles and renders real data from backend

### Key Findings
- `SLMEntity` Pydantic model had a `Literal` constraint excluding "Protein" — adding it required updating both `models.py` and `ai_processor.py`
- Dashboard metrics can be derived entirely from the in-memory pipeline cache — no new DB queries needed
- Trending entities computed via `Counter` over all study entities — O(n) scan is fine for demo scale

### Next Steps
- Re-run full ingestion to populate all studies with protein entities
- Add relationship extraction (entity-entity interactions) to NER prompt

---

## Cycle 3 — PATH A — MCP Server for Bio Tools
**Date:** 2026-04-11
**Verdict:** APPROVE

### What Was Tested
Built and tested an MCP (Model Context Protocol) server (`backend/mcp_server.py`) exposing 3 tools via JSON-RPC over stdio: `search_biostudies`, `fetch_study_detail`, `lookup_protein_structure`. Full end-to-end test with a programmatic MCP client sending JSON-RPC messages through the stdio transport.

### Results
- **initialize**: Server returns `protocolVersion: 2024-11-05`, `serverInfo.name: latticebio`
- **tools/list**: All 3 tools listed with correct JSON Schema `inputSchema` definitions
- **search_biostudies**: `KRAS pancreatic` → 2 results, first accession `S-EPMC5618076` (status: success)
- **lookup_protein_structure**: `ACE2` → UniProt `Q9BYF1`, PDB URL `AF-Q9BYF1-F1-model_v6.pdb` (status: success)
- **fetch_study_detail**: `S-EPMC5623901` → full title, 8 authors (status: success)
- **Unknown tool**: Returns `status: error, message: Unknown tool: bogus_tool` (graceful error)
- All 6 test cases passed

### Key Findings
- MCP `mcp[cli]` install upgraded httpx to 0.28.1 and starlette to 1.0.0, breaking FastAPI 0.111.0. **Fix**: Upgraded FastAPI to 0.135.3 and ollama to 0.6.1 — all packages now compatible.
- The MCP stdio transport requires the client to keep stdin open; piping messages with `printf | python` closes stdin prematurely and the server exits before async tool calls complete. Subprocess with explicit pipe management works correctly.
- `Server` from MCP SDK is a clean embedding API — minimal boilerplate wrapping existing async functions.

### Failed Approaches
- Testing MCP via `printf ... | python mcp_server.py` — stdin closes before async HTTP calls finish
- Directly awaiting `server.list_tools()` — it's a decorated handler, not directly callable

### Next Steps
- Wire MCP server into Claude Desktop / Claude Code config for interactive use
- Add PubChem compound lookup as a 4th MCP tool
- Consider SSE transport for web-based MCP clients

---

## Cycle 1 — PATH B — LangGraph Orchestration Migration
**Date:** 2026-04-11
**Verdict:** APPROVE

### What Was Tested
Replaced the sequential `run_lab_session` in `orchestrator.py` with a LangGraph `StateGraph` in `agents/graph.py`. 5 nodes: PI Analysis → AlphaFold Lookup → Hypothesis Generation → Critic Review → Synthesis. Conditional edge: Critic can loop back to Hypothesis if assessment is "weak" (max 1 revision).

### Results
- Session `lab-816c6b4b91` completed successfully via LangGraph
- 13 agent messages, 3 entities, 2 hypotheses, full critique + synthesis
- Critic returned MODERATE — no revision loop triggered (correct)
- Frontend polling via `/api/lab/session/{id}` works unchanged
- No infinite loops observed

### Key Findings
- LangGraph `ainvoke()` runs the full graph to completion; state flows correctly through TypedDict
- Pushing messages into the shared session dict from within nodes works for live frontend updates
- The conditional edge pattern (`should_revise`) is clean — just inspect state and return a string literal

### Next Steps
- Add per-node token tracking via OpenAI `usage` response field
- Test the revision loop with an intentionally weak query to trigger "weak" assessment
- Consider adding a PubChem tool node between AlphaFold and Hypothesis

---
