"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Users, Lightbulb, Shield, CheckCircle2, Send } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar: string;
  expertise: string;
}

interface CollaborationMessage {
  agentId: string;
  agentName: string;
  timestamp: string;
  content: string;
  confidence?: number;
  sentiment: "positive" | "neutral" | "critical";
}

const AGENTS: Agent[] = [
  {
    id: "pi",
    name: "PI Agent",
    role: "Research Director",
    color: "#0F766E",
    avatar: "🔬",
    expertise: "Orchestration & hypothesis synthesis",
  },
  {
    id: "hypothesis",
    name: "Hypothesis Generator",
    role: "Theory Specialist",
    color: "#7C3AED",
    avatar: "💡",
    expertise: "Mechanistic reasoning & testability",
  },
  {
    id: "critic",
    name: "Critic Agent",
    role: "Quality Assurance",
    color: "#D97706",
    avatar: "🔍",
    expertise: "Validation & finding gaps",
  },
  {
    id: "insight",
    name: "Insight Agent",
    role: "Pattern Recognition",
    color: "#2563EB",
    avatar: "🧠",
    expertise: "Knowledge graph analysis",
  },
];

interface AgentCollaborationBoardProps {
  sessionId?: string;
  onRefinement?: (refinement: any) => void;
}

export default function AgentCollaborationBoard({
  sessionId,
  onRefinement,
}: AgentCollaborationBoardProps) {
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Simulate agent collaboration
  useEffect(() => {
    const initialMessage: CollaborationMessage = {
      agentId: "pi",
      agentName: "PI Agent",
      timestamp: new Date().toLocaleTimeString(),
      content:
        "Welcome to the agent collaboration board. I've synthesized the research findings and assembled a panel of specialists to discuss and refine our conclusions.",
      sentiment: "positive",
    };
    setMessages([initialMessage]);
  }, []);

  const handleAgentQuery = async (query: string) => {
    if (!query.trim()) return;

    // Add user message
    const userMessage: CollaborationMessage = {
      agentId: "user",
      agentName: "You",
      timestamp: new Date().toLocaleTimeString(),
      content: query,
      sentiment: "neutral",
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
    setIsThinking(true);

    // Simulate agent responses
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const agentResponses: CollaborationMessage[] = [
      {
        agentId: "hypothesis",
        agentName: "Hypothesis Generator",
        timestamp: new Date().toLocaleTimeString(),
        content: `Interesting question. Based on the mechanistic analysis, I'd prioritize testing the pathway crosstalk hypothesis. The structural predictions show a 78% likelihood of binding site accessibility.`,
        confidence: 0.78,
        sentiment: "positive",
      },
      {
        agentId: "critic",
        agentName: "Critic Agent",
        timestamp: new Date().toLocaleTimeString(),
        content: `However, we need to address the temporal dynamics. The in vitro conditions may not translate to cellular contexts. I recommend time-resolved measurements.`,
        confidence: 0.65,
        sentiment: "critical",
      },
      {
        agentId: "insight",
        agentName: "Insight Agent",
        timestamp: new Date().toLocaleTimeString(),
        content: `The knowledge graph integration supports this. We found 12 related studies with similar pathway configurations. The consensus suggests a 2-3 hour response window.`,
        confidence: 0.82,
        sentiment: "positive",
      },
    ];

    for (const response of agentResponses) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setMessages((prev) => [...prev, response]);
    }

    setIsThinking(false);
  };

  const handleRefineHypothesis = () => {
    setIsThinking(true);
    setTimeout(() => {
      onRefinement?.({
        refinedConfidence: 0.85,
        recommendedExperiments: [
          "Time-resolved phosphoproteomics",
          "Cryo-EM structure validation",
          "In vivo knockdown experiments",
        ],
      });
      setIsThinking(false);

      const refinementMessage: CollaborationMessage = {
        agentId: "pi",
        agentName: "PI Agent",
        timestamp: new Date().toLocaleTimeString(),
        content:
          "Based on our collaborative discussion, I've refined the hypothesis with a 85% confidence score. The recommended experimental validation plan is now available.",
        sentiment: "positive",
      };
      setMessages((prev) => [...prev, refinementMessage]);
    }, 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
      {/* Agent panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-1 bg-white rounded-lg border border-slate-200 p-4 overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Research Panel</h3>
        </div>

        <div className="space-y-2">
          {AGENTS.map((agent) => (
            <motion.button
              key={agent.id}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedAgent(agent.id)}
              className={`w-full text-left p-3 rounded-lg transition-all ${
                selectedAgent === agent.id
                  ? "bg-gradient-to-r from-slate-900 to-slate-800 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{agent.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{agent.name}</p>
                  <p className="text-xs text-opacity-70">
                    {selectedAgent === agent.id
                      ? agent.expertise
                      : agent.role}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefineHypothesis}
            disabled={isThinking}
            className="w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium text-sm hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Refine Findings
          </motion.button>
          <button className="w-full px-3 py-2 bg-slate-100 text-slate-900 rounded-lg font-medium text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Validate Results
          </button>
        </div>
      </motion.div>

      {/* Chat panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-3 bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-transparent to-slate-50">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => {
              const agent = AGENTS.find((a) => a.id === msg.agentId);
              const isUser = msg.agentId === "user";

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
                >
                  {!isUser && (
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${agent?.color}20` }}
                    >
                      {agent?.avatar}
                    </div>
                  )}

                  <div
                    className={`max-w-xs ${
                      isUser
                        ? "bg-blue-500 text-white rounded-2xl rounded-tr-none"
                        : "bg-slate-100 text-slate-900 rounded-2xl rounded-tl-none"
                    } p-4`}
                  >
                    {!isUser && (
                      <p className="text-xs font-semibold mb-1" style={{ color: agent?.color }}>
                        {agent?.name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.confidence && (
                      <div className="mt-2 pt-2 border-t border-opacity-20 border-slate-400">
                        <p className="text-xs font-semibold">
                          Confidence: {Math.round(msg.confidence * 100)}%
                        </p>
                      </div>
                    )}
                    <p className="text-xs opacity-60 mt-1">{msg.timestamp}</p>
                  </div>
                </motion.div>
              );
            })}

            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-slate-200">
                  🤔
                </div>
                <div className="bg-slate-100 text-slate-900 rounded-2xl rounded-tl-none p-4">
                  <div className="flex gap-1">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="w-2 h-2 bg-slate-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                      className="w-2 h-2 bg-slate-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 bg-slate-400 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-4 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAgentQuery(userInput)}
              placeholder="Ask the research panel a question..."
              disabled={isThinking}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAgentQuery(userInput)}
              disabled={!userInput.trim() || isThinking}
              className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 Tip: Ask agents to validate findings, suggest experiments, or refine hypotheses
          </p>
        </div>
      </motion.div>
    </div>
  );
}
