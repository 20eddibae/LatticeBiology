# Interactive Research Experience - Complete Feature Guide

## Overview

The Virtual Wet Lab now includes sophisticated animations and post-research interactivity that make scientific discovery engaging, visual, and collaborative. This guide documents all new features and how to integrate them.

---

## 🎬 PART 1: LOADING ANIMATIONS

### ResearchLoadingAnimation Component

**Location:** `frontend/components/ResearchLoadingAnimation.tsx`

#### Features
- **Animated molecular orbits** - 3 concentric orbiting rings representing molecular structure
- **Dynamic pulsing core** - Central sphere with breathing effect and color glow
- **Background fluid animations** - Subtle moving color orbs (blue, purple, teal) with blend modes
- **5-stage progress tracker** - Visual timeline showing:
  1. ⚙️ Initializing Research Framework
  2. 🔍 Extracting Entities & Relationships
  3. 🧬 Predicting Protein Structures
  4. ⚛️ Analyzing Mechanistic Hypotheses
  5. 📋 Synthesizing Final Report

#### Design Principles
- **Minimalistic but complex**: Simple geometric shapes create sophisticated motion
- **Scientific theme**: Molecular orbits, DNA spirals metaphor align with biology
- **Dark theme**: Slate-950 background with glowing accents (blue, purple, teal)
- **Real-time feedback**: Stage indicators show progress, completed stages get checkmarks

#### Integration
```tsx
import ResearchLoadingAnimation from "@/components/ResearchLoadingAnimation";

// In your lab page:
{status === "running" && (
  <ResearchLoadingAnimation 
    status={currentStage}
    message={agentMessage}
  />
)}
```

#### Props
- `status`: "initializing" | "extracting" | "predicting" | "analyzing" | "synthesizing"
- `message`: Optional custom message from agent

---

## 🎮 PART 2: POST-RESEARCH INTERACTIVITY

### 2.1 InteractiveResultsViewer

**Location:** `frontend/components/InteractiveResultsViewer.tsx`

#### Tabs & Features

##### **Hypotheses Tab**
- **Confidence Threshold Slider** - Filter results by minimum confidence
- **Hypothesis Cards** - Interactive cards with:
  - Full hypothesis text
  - Testability badges (high/medium/low)
  - Confidence slider for user adjustment
  - "Refine This Hypothesis" action button
- **Real-time Ranking** - Hypotheses auto-rerank as user adjusts confidence

##### **Agent Chat Tab**
- **Live Agent Dialogue** - Chat interface with research agents
- **Smart Responses** - Agents answer about hypotheses, structures, confidence
- **Context-aware** - Responses reference specific findings from the research
- **Message History** - Full conversation thread with timestamps

##### **Knowledge Graph Tab**
- **Interactive Graph Visualization** - (Placeholder for Cytoscape integration)
- **Drag-to-Rearrange** - Move entities to explore relationships
- **Edit Relationships** - Click edges to modify or add new connections
- **Quick Actions**:
  - "+ Add Entity" - Insert new nodes
  - "- Remove Selected" - Delete entities

##### **Export Tab**
- **Section Selection** - Toggle which sections to include:
  - Executive Summary
  - Generated Hypotheses
  - Extracted Entities
  - Entity Relationships
  - Confidence Metrics
- **Multi-format Export**:
  - PDF Report (formatted for publication)
  - Raw JSON (for programmatic access)
  - Markdown (for documentation)
- **Smart Download** - Automatically names files with session ID

#### Integration
```tsx
import InteractiveResultsViewer from "@/components/InteractiveResultsViewer";

<InteractiveResultsViewer
  hypotheses={labSession.hypotheses}
  agentMessages={labSession.messages}
  sessionId={labSession.sessionId}
/>
```

---

### 2.2 HypothesisRefinementTool

**Location:** `frontend/components/HypothesisRefinementTool.tsx`

#### Features

##### **Hypothesis Editing**
- **Toggle Edit Mode** - Switch between view/edit with animated button
- **Multi-field Editing**:
  - Hypothesis statement (textarea)
  - Proposed mechanism
  - Experimental approach
- **Real-time Saving** - Changes persist immediately

##### **Confidence Assessment**
- **User Confidence Slider** - Adjust confidence independent of AI score
- **Visual Feedback** - Bars and percentages show confidence level
- **Comparative Display** - AI confidence vs. user assessment side-by-side

##### **Validation Checklist**
- **Required Validations** (for publication):
  - Genetic perturbation studies
  - In vivo validation
  - Temporal dynamics analysis
  - etc.
- **Optional Validations** (strengthen argument):
  - Patient-derived organoid validation
  - Orthogonal experimental confirmation
  - etc.
- **Validation Progress Bar** - Shows completion status
- **Interactive Checkboxes** - Click to toggle selections

##### **AI-Powered Refinement**
- **"AI Refinement" Button** - Triggers agent enhancement
- **2-Second Processing** - Simulates agent thinking
- **Enhanced Output**:
  - Adds mechanistic detail
  - Incorporates pathway crosstalk insights
  - Updates confidence score (+10%)
  - Suggests temporal measurements
- **Accept/Reject Modal** - User can accept refined version or discard

#### Integration
```tsx
import HypothesisRefinementTool from "@/components/HypothesisRefinementTool";

const [refinedHypothesis, setRefinedHypothesis] = useState(hypothesis);

<HypothesisRefinementTool
  initialHypothesis={hypothesis}
  onSave={(refined) => setRefinedHypothesis(refined)}
/>
```

---

### 2.3 AgentCollaborationBoard

**Location:** `frontend/components/AgentCollaborationBoard.tsx`

#### Design
- **4-Agent Panel** on left:
  - 🔬 PI Agent (Research Director) - Orchestration & synthesis
  - 💡 Hypothesis Generator (Theory Specialist) - Mechanistic reasoning
  - 🔍 Critic Agent (Quality Assurance) - Validation & gaps
  - 🧠 Insight Agent (Pattern Recognition) - Knowledge graph analysis
- **Live Chat Interface** on right:
  - User query input
  - Cascading agent responses (sequential)
  - Confidence scores for each response
  - Sentiment indicators (positive/critical)
  - Thinking animation during processing

#### Features

##### **Agent Selection**
- **Click Agent** - Highlights selected specialist
- **View Expertise** - Shows agent's focus area
- **Direct Addressing** - Ask specific agents for insights

##### **Collaborative Discussion**
- **Sequential Responses** - Each agent responds with ~800ms stagger
- **Confidence Display** - Each agent shows confidence in findings
- **Sentiment Badges** - Visual indicator of agent stance:
  - 😊 Positive (supporting findings)
  - 😐 Neutral (factual observations)
  - ⚠️ Critical (identifies issues)

##### **Quick Actions**
- **"Refine Findings"** - Agents synthesize conclusions
- **"Validate Results"** - Agents suggest validation experiments

#### Integration
```tsx
import AgentCollaborationBoard from "@/components/AgentCollaborationBoard";

<AgentCollaborationBoard
  sessionId={sessionId}
  onRefinement={(refinement) => {
    console.log("Refined hypothesis:", refinement);
  }}
/>
```

---

## 📊 USAGE FLOW

### Complete User Journey

```
1. USER STARTS RESEARCH
   └─> ResearchLoadingAnimation plays
       - Molecular orbits spin
       - 5-stage progress tracker updates
       - User watches elegant animations for ~30-60 seconds

2. RESEARCH COMPLETES
   └─> Results Dashboard appears with:
       - InteractiveResultsViewer (tabs open to Hypotheses)
       - HypothesisRefinementTool (first hypothesis selected)
       - AgentCollaborationBoard (ready for questions)

3. USER EXPLORES FINDINGS
   └─> Can:
       - Adjust confidence thresholds → See hypotheses re-rank
       - Edit hypothesis text → Add observations
       - Chat with agents → Ask "Why did you prioritize this?"
       - Review validation checklist → Plan experiments
       - Refine with AI → Enhance findings with agent input
       - Export results → Download for publication

4. USER VALIDATES
   └─> Can:
       - Interact with knowledge graph → Add/remove relationships
       - Review agent consensus → See if agents agree
       - Plan experiments → From suggested validations
       - Export validated findings → JSON/PDF ready for lab

5. USER SHARES
   └─> Exports:
       - PDF report (polished for publication)
       - JSON (programmatic integration)
       - Markdown (documentation)
```

---

## 🎨 DESIGN ALIGNMENT

### Color Scheme
- **Primary**: Blue (#3B82F6) - Trust, analysis
- **Secondary**: Purple (#7C3AED) - Creativity, hypotheses
- **Accent**: Teal (#0F766E) - Precision, validation
- **Neutral**: Slate (multiple shades) - Clean backgrounds

### Typography
- **Headers**: Bold, 16-20px, slate-900
- **Labels**: Semibold, 12px, uppercase tracking
- **Body**: Regular, 14px, slate-700
- **Small**: 12px, slate-600 (secondary info)

### Animations
- **Entrance**: Fade + slide up (200ms)
- **Stagger**: Multiply for lists (100ms between items)
- **Micro**: Scale on hover, bounce on click
- **Loading**: Breathing, orbiting, pulsing effects

---

## 🔧 INTEGRATION CHECKLIST

- [ ] Add `ResearchLoadingAnimation` to `/api/lab/session/{id}/stream` view
- [ ] Integrate `InteractiveResultsViewer` when status === "completed"
- [ ] Place `HypothesisRefinementTool` in results sidebar
- [ ] Wire `AgentCollaborationBoard` for post-research dialogue
- [ ] Add export handlers in backend (PDF, JSON generation)
- [ ] Connect knowledge graph editor to actual Cytoscape data
- [ ] Test SSE streaming with animation stage progression
- [ ] Verify responsiveness on mobile/tablet

---

## 🚀 FUTURE ENHANCEMENTS

1. **Real Interactive Graph Editor**
   - Integrate with Cytoscape backend data
   - Save edited relationships
   - Suggest new connections based on literature

2. **Persistent Collaboration**
   - Save agent conversations
   - Share discussion threads with collaborators
   - Version control for hypothesis refinements

3. **Advanced Visualizations**
   - 3D pathway network
   - Timeline of hypothesis evolution
   - Confidence distribution curves

4. **API Integration**
   - Direct PubMed search from chat
   - Real-time literature validation
   - Automated experiment planning from validations

5. **Mobile Optimization**
   - Responsive agent board for small screens
   - Touch-friendly sliders and interactions
   - Portrait mode layout for graphs

---

## 📝 NOTES FOR DEVELOPERS

- All animations use **Framer Motion** for performance
- Components are fully responsive (mobile-first design)
- Dark mode compatibility added via CSS variables
- Export functionality is placeholder (implement backend)
- Agent responses are simulated (connect to real agent API)
- Knowledge graph editor is placeholder (wire to Cytoscape backend)

---

## 🎯 SUCCESS METRICS

- **Loading Animation**: User feels engaged, not bored
- **Hypothesis Tool**: User understands confidence model after interaction
- **Agent Board**: User gains new insights from agent discussion
- **Export**: Publication-ready documents generated correctly
- **Overall**: Transforms research from "black box" to "interactive collaboration"
