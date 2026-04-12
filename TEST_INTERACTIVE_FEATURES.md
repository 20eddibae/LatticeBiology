# Interactive Features - End-to-End Test Plan

## Overview
This document outlines the comprehensive test plan for verifying that all new interactive features (ResearchLoadingAnimation, InteractiveResultsViewer, HypothesisRefinementTool, AgentCollaborationBoard) are working correctly in the integrated lab page.

---

## Test Environment Setup

### Prerequisites
- ✅ Frontend dev server running on http://localhost:3000
- ✅ Backend API server running on http://localhost:8000
- ✅ All TypeScript compilation errors resolved
- ✅ Components imported with dynamic() and ssr: false

### Component Files Verified
- ✅ `frontend/components/ResearchLoadingAnimation.tsx` (9,283 bytes)
- ✅ `frontend/components/InteractiveResultsViewer.tsx` (18,619 bytes)
- ✅ `frontend/components/HypothesisRefinementTool.tsx` (15,342 bytes)
- ✅ `frontend/components/AgentCollaborationBoard.tsx` (12,631 bytes)

---

## Test Cases

### 1. LOADING PHASE (ResearchLoadingAnimation)

#### 1.1 Component Display
**Test:** When a user starts a research query, verify the ResearchLoadingAnimation appears
**Expected:**
- Dark slate-950 background fills the screen
- Animated background orbs (blue, purple, teal) move with blend modes
- 3 concentric orbital rings rotate at different speeds
- Central pulsing core with breathing animation
- **Status:** Not yet tested - awaiting frontend server

#### 1.2 Progress Stages
**Test:** As the research progresses, stages update in real time
**Expected progression:**
1. ⚙️ Initializing Research Framework (starts immediately)
2. 🔍 Extracting Entities & Relationships (when entities_found populated)
3. 🧬 Predicting Protein Structures (when alphafold_results populated)
4. ⚛️ Analyzing Mechanistic Hypotheses (when hypotheses populated)
5. 📋 Synthesizing Final Report (when final_summary exists)

**Verification method:**
- Watch for stage icons to change from numbered to ⚡ (active) to ✓ (completed)
- Verify timestamps update as each stage transitions
- **Status:** Not yet tested - awaiting backend responsiveness

#### 1.3 Message Display
**Test:** Agent messages display in real-time beneath the progress tracker
**Expected:**
- Latest agent message from `session.messages[session.messages.length - 1]?.content` displays
- Message updates as new messages arrive via SSE
- **Status:** Not yet tested - awaiting full integration test

---

### 2. POST-RESEARCH PHASE (InteractiveResultsViewer)

#### 2.1 Tab Navigation
**Test:** All four tabs can be clicked and content switches smoothly
**Expected:**
- "Hypotheses" tab displays hypothesis cards with confidence sliders
- "Agent Chat" tab shows message history with input field
- "Knowledge Graph" tab shows placeholder for Cytoscape integration
- "Export" tab shows section selection checkboxes and export buttons
- **Status:** Not yet tested - awaiting frontend server

#### 2.2 Hypotheses Tab - Confidence Filtering
**Test:** Drag the confidence threshold slider to filter hypotheses
**Expected:**
- Moving slider from 0% to 100% filters out low-confidence hypotheses
- Hypotheses below threshold disappear smoothly
- Remaining hypotheses re-rank based on confidence
- **Status:** Not yet tested

#### 2.3 Hypotheses Tab - Per-Hypothesis Adjustment
**Test:** Adjust confidence slider on individual hypothesis cards
**Expected:**
- User can drag slider to adjust confidence (0-100%)
- Confidence value updates in real-time
- Selected hypothesis shows "Refine This Hypothesis" button
- **Status:** Not yet tested

#### 2.4 Agent Chat Tab - Message History
**Test:** Agent chat interface displays all messages with timestamps
**Expected:**
- User messages appear right-aligned in blue
- Agent messages appear left-aligned in slate with agent name and confidence
- Messages have timestamps in HH:MM:SS format
- Thinking animation (3 bouncing dots) shows during processing
- **Status:** Not yet tested

#### 2.5 Export Tab - Section Selection
**Test:** Toggle checkboxes to select which sections to export
**Expected:**
- Checkboxes for: Summary, Hypotheses, Entities, Relationships, Metrics
- Visual feedback when toggled
- State persists within the session
- **Status:** Not yet tested

#### 2.6 Export Tab - Download Formats
**Test:** Click export buttons to download in different formats
**Expected:**
- "PDF Report" button initiates JSON download (simulated)
- "Raw JSON" button downloads research-results-{sessionId}.json
- "Markdown" button initiates markdown download
- Files are automatically named with session ID
- **Status:** Not yet tested

---

### 3. POST-RESEARCH PHASE (HypothesisRefinementTool)

#### 3.1 View/Edit Toggle
**Test:** Click "Edit Hypothesis" button to enter edit mode
**Expected:**
- Button text changes to "Save Changes" when editing
- Text fields become editable (textarea elements)
- Hypothesis statement, mechanism, and experimental approach can be modified
- Clicking "Save Changes" returns to view mode
- **Status:** Not yet tested

#### 3.2 Confidence Slider
**Test:** Adjust the confidence slider in both edit and view modes
**Expected:**
- Slider ranges from 0-100%
- Percentage value displays next to slider
- Visual confidence bar shows gradient fill
- Color and styling indicates confidence level
- **Status:** Not yet tested

#### 3.3 Validation Checklist - Required Items
**Test:** Interact with required validation checkboxes
**Expected:**
- Checkboxes for CRISPR/shRNA, in vivo, temporal dynamics, etc.
- Items start unchecked
- Clicking toggles checkbox state
- Selected items get emerald background
- Progress bar updates to reflect completion
- **Status:** Not yet tested

#### 3.4 Validation Checklist - Optional Items
**Test:** Interact with optional validation checkboxes
**Expected:**
- Checkboxes for organoids, confirmation, multi-omics, etc.
- Visual distinction (blue coloring) from required items
- Same toggle behavior as required items
- Progress counts toward overall completion
- **Status:** Not yet tested

#### 3.5 AI Refinement Modal
**Test:** Click "AI Refinement" button to trigger modal
**Expected:**
- Modal appears with dark overlay
- Loading state shows 3 animated bars (2 seconds)
- Completion state shows emerald success message
- "Accept & Save" button applies refinement
- "Cancel" button dismisses without changes
- Confidence increases by 10% upon acceptance
- **Status:** Not yet tested

---

### 4. POST-RESEARCH PHASE (AgentCollaborationBoard)

#### 4.1 Agent Panel Display
**Test:** Verify left panel shows all 4 agents
**Expected:**
- 🔬 PI Agent (Research Director) - clickable
- 💡 Hypothesis Generator (Theory Specialist) - clickable
- 🔍 Critic Agent (Quality Assurance) - clickable
- 🧠 Insight Agent (Pattern Recognition) - clickable
- Each shows role and expertise on hover/selection
- **Status:** Not yet tested

#### 4.2 Agent Selection
**Test:** Click on each agent to select them
**Expected:**
- Selected agent highlights with gradient background
- Expertise text displays instead of role description
- Visual feedback is immediate
- Only one agent selected at a time
- **Status:** Not yet tested

#### 4.3 Quick Action Buttons
**Test:** Click "Refine Findings" and "Validate Results" buttons
**Expected:**
- "Refine Findings" triggers agent responses
- "Validate Results" triggers validation-focused responses
- Chat panel updates with staggered agent responses
- Thinking animation shows during processing
- **Status:** Not yet tested

#### 4.4 Chat Interface - User Input
**Test:** Type a question and send it
**Expected:**
- Input field shows placeholder "Ask the research panel..."
- Enter key or Send button submits message
- User message appears right-aligned in blue chat bubble
- Input clears after sending
- **Status:** Not yet tested

#### 4.5 Chat Interface - Agent Responses
**Test:** Wait for agent responses to appear
**Expected:**
- Agents respond sequentially (~800ms stagger between each)
- Each agent shows name, confidence score, and content
- Agent messages appear left-aligned in slate
- Timestamp shows response time
- Multiple agents respond in order (HYP → CRITIC → INSIGHT)
- **Status:** Not yet tested

#### 4.6 Thinking Animation
**Test:** Observe thinking state during agent processing
**Expected:**
- 3 bouncing dots animate during processing
- Thinking indicator shows "🤔" avatar
- Animation plays smoothly for ~1.5 seconds
- Animation stops when agents start responding
- **Status:** Not yet tested

---

### 5. POST-RESEARCH PHASE (Layout & Integration)

#### 5.1 Overall Layout Structure
**Test:** Verify the layout after research completes
**Expected:**
- "Research Complete" header with sparkles icon
- 3-column grid:
  - Left (2 cols): InteractiveResultsViewer
  - Right (1 col): HypothesisRefinementTool
- Full-width: AgentCollaborationBoard below
- Key metrics cards at bottom (Entities, Structures, Hypotheses, Compounds)
- **Status:** Not yet tested

#### 5.2 Animations
**Test:** Verify entrance animations
**Expected:**
- Header fades in from opacity 0
- InteractiveResultsViewer slides in from left (delay: 0.4s)
- HypothesisRefinementTool slides in from right (delay: 0.4s)
- AgentCollaborationBoard fades up from bottom (delay: 0.5s)
- Metrics cards fade up (delay: 0.6s)
- Staggered animations create visual flow
- **Status:** Not yet tested

#### 5.3 Responsive Design
**Test:** Resize browser window to test responsiveness
**Expected:**
- On desktop (>1024px): 3-column layout works as designed
- On tablet (768px-1024px): Columns stack appropriately
- On mobile (<768px): Single column with full-width components
- No content is cut off or overlapping
- Scrolling is smooth and functional
- **Status:** Not yet tested (requires visual inspection)

---

### 6. CROSS-COMPONENT INTEGRATION

#### 6.1 Data Flow from Backend
**Test:** Verify data flows correctly from backend to components
**Expected:**
- `hypotheses` array maps correctly to InteractiveResultsViewer props
- `entities_found` count displays in metrics cards
- `alphafold_results` count displays in metrics cards
- `lead_compounds` count displays in metrics cards
- `messages` populate chat history in AgentCollaborationBoard
- **Status:** Not yet tested - awaiting backend server responsiveness

#### 6.2 State Management
**Test:** Verify component state persists across interactions
**Expected:**
- Hypothesis confidence adjustments persist
- Tab selection in InteractiveResultsViewer persists
- Edit mode state in HypothesisRefinementTool persists
- Chat history grows as new messages arrive
- Validation checkbox selections persist
- **Status:** Not yet tested

#### 6.3 Error Handling
**Test:** Verify graceful fallbacks for missing data
**Expected:**
- Missing hypotheses show "No hypotheses available"
- Empty chat history shows placeholder message
- Missing confidence scores default to 0.7
- Missing testability defaults to "high"
- No console errors or crashes
- **Status:** Not yet tested

---

## Known Issues & Workarounds

### Issue 1: Backend Server Timeout
**Status:** ACTIVE
**Description:** Backend (uvicorn) became unresponsive during initial testing
**Current State:** All backend processes killed and need to be restarted
**Workaround:** Kill processes with `pkill -f uvicorn` and restart

### Issue 2: TypeScript Compilation Errors
**Status:** RESOLVED
**Fixes Applied:**
- Changed `GitNetwork` to `Network` icon in InteractiveResultsViewer
- Fixed Set iteration using `Array.from()` in SimilarStudies.tsx
- Added type annotation for `entity` parameter
- Fixed hypothesis object property access with type casting

---

## Test Execution Checklist

### Phase 1: Frontend Dev Server Verification
- [ ] Dev server starts without errors
- [ ] No TypeScript compilation errors
- [ ] Main lab page loads at http://localhost:3000/lab
- [ ] Empty state displays correctly

### Phase 2: Loading Animation Testing
- [ ] Start a research query
- [ ] ResearchLoadingAnimation appears immediately
- [ ] 5 stages display in progress tracker
- [ ] Stages update as results arrive
- [ ] Animation loops smoothly

### Phase 3: Post-Research UI Testing
- [ ] Research completes successfully
- [ ] "Research Complete" header appears
- [ ] All 4 tabs in InteractiveResultsViewer are clickable
- [ ] Tab content switches smoothly
- [ ] HypothesisRefinementTool displays hypothesis
- [ ] AgentCollaborationBoard loads with agent list

### Phase 4: Interaction Testing
- [ ] Confidence sliders respond to mouse/touch
- [ ] Edit mode toggling works
- [ ] Validation checkboxes can be checked/unchecked
- [ ] AI Refinement modal displays and animates
- [ ] Agent Chat accepts input and displays responses

### Phase 5: Browser Consistency
- [ ] Test on Chrome/Chromium
- [ ] Test on Firefox
- [ ] Test on Safari (if available)
- [ ] Test on mobile viewport (iOS/Android simulation)

---

## Success Criteria

**The interactive features are considered "fully working" when:**

1. ✅ All TypeScript errors are resolved (COMPLETED)
2. ⏳ Frontend dev server runs without errors
3. ⏳ ResearchLoadingAnimation displays with all 5 stages and animates correctly
4. ⏳ Post-research section renders without crashing
5. ⏳ All 4 tabs in InteractiveResultsViewer are interactive and functional
6. ⏳ HypothesisRefinementTool responds to all user inputs
7. ⏳ AgentCollaborationBoard displays agents and accepts queries
8. ⏳ Responsive layout works on desktop, tablet, and mobile
9. ⏳ No console errors or warnings during normal operation
10. ⏳ All animations are smooth (60fps) and properly timed

---

## Next Steps

1. Restart backend API server
2. Verify frontend dev server is accessible
3. Execute Phase 1 checks (dev server verification)
4. Run a complete research query
5. Execute remaining test phases sequentially
6. Document findings and any issues discovered
7. Address any failing tests with targeted fixes

---

**Last Updated:** 2026-04-12  
**Test Status:** PENDING (awaiting server startup)
