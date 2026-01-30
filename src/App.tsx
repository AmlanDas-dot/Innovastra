import { useState, useEffect } from "react";
import OpenAI from "openai";
import { useRef } from "react";

/* ---------------- Types ---------------- */

type DecisionMemory = {
  id: string;
  title: string;
  summary: string;
  decision: string;
  intent: string;
  constraints: string;
  alternatives: string;
  reasoning: string;
  archived?: boolean;
  createdAt: number;
};

type Message = {
  role: "user" | "ai";
  text: string;
};

type MemoryFieldKey =
  | "decision"
  | "intent"
  | "constraints"
  | "alternatives"
  | "reasoning";

type ConversationMode =
  | "capturing"
  | "review"
  | "reflecting";

/* ---------------- Conversation Flow ---------------- */

const MEMORY_FLOW: MemoryFieldKey[] = [
  "decision",
  "intent",
  "constraints",
  "alternatives",
  "reasoning",
];

const questionForField = (field: MemoryFieldKey) => {
  switch (field) {
    case "decision":
      return "What's the choice that's been on your mind lately?";
    case "intent":
      return "What’s making this choice matter to you at this point in your life?";
    case "constraints":
      return "Are there any limits or concerns you’re trying to balance — like time, money, risk, or emotions?";
    case "alternatives":
      return "What other paths or possibilities have crossed your mind so far?";
    case "reasoning":
      return "Right now, which option feels most natural or convincing to you — and what’s guiding that feeling?";
    default:
      return "";
  }
};

/* ---------------- App ---------------- */

export default function App() {
  const [flashcardSearch, setFlashcardSearch] = useState("");
  const [flashcardDate, setFlashcardDate] = useState<"all" | "week" | "month" | "year">("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [suggestedMemoryIndexes, setSuggestedMemoryIndexes] = useState<number[]>([]);


  /* ---------------- AI Mode ---------------- */

  const [aiMode, setAiMode] = useState<"online" | "offline">(() => {
    return (localStorage.getItem("aiMode") as "online" | "offline") || "online";
  });

  useEffect(() => {
    localStorage.setItem("aiMode", aiMode);
  }, [aiMode]);


  /* ---------------- OpenAI ---------------- */
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  /* ---------------- State ---------------- */
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [currentField, setCurrentField] =
    useState<MemoryFieldKey>("decision");

  const [conversationMode, setConversationMode] =
    useState<ConversationMode>("capturing");

  const [memory, setMemory] = useState<Omit<DecisionMemory, "id">>({
    decision: "",
    intent: "",
    constraints: "",
    alternatives: "",
    reasoning: "",
  });

  const [savedMemories, setSavedMemories] =
    useState<DecisionMemory[]>([]);

  const [selectedMemoryIndexes, setSelectedMemoryIndexes] =
    useState<number[]>([]);

  const [flashcardView, setFlashcardView] = useState<
    "active" | "archived"
  >("active");

  /* ---------------- Startup ---------------- */
  useEffect(() => {
    setMessages([{ role: "ai", text: questionForField("decision") }]);
  }, []);

  /*----------------- Autoscroll --------------*/
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- Derived ---------------- */

  const now = Date.now();

  const isWithinRange = (createdAt: number) => {
    const diff = now - createdAt;

    switch (flashcardDate) {
      case "week":
        return diff <= 7 * 24 * 60 * 60 * 1000;
      case "month":
        return diff <= 30 * 24 * 60 * 60 * 1000;
      case "year":
        return diff <= 365 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  };

  const isMemoryVisible = (mem: DecisionMemory) => {
    const text = `${mem.decision} ${mem.reasoning} ${mem.constraints}`.toLowerCase();
    const matchesSearch = text.includes(flashcardSearch.toLowerCase());

    const matchesArchive =
      flashcardView === "active" ? !mem.archived : mem.archived;

    const matchesDate = isWithinRange(mem.createdAt);

    return matchesSearch && matchesArchive && matchesDate;
  };

  const extractKeywords = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // remove punctuation
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 3 && // avoid noise
          ![
            "this",
            "that",
            "with",
            "from",
            "there",
            "about",
            "should",
            "could",
            "would",
            "which",
          ].includes(word)
      );
  };  

  const getMemoryRelevanceScore = (
    mem: DecisionMemory,
    keywords: string[]
  ) => {
    let score = 0;

    keywords.forEach((kw) => {
      if (mem.decision.toLowerCase().includes(kw)) score += 2;
      if (mem.reasoning.toLowerCase().includes(kw)) score += 1;
      if (mem.constraints.toLowerCase().includes(kw)) score += 1;
    });

    // small recency boost
    const daysOld =
      (Date.now() - mem.createdAt) / (1000 * 60 * 60 * 24);

    if (daysOld < 30) score += 1;

    return score;
  };

  const getSuggestedMemoryIndexes = () => {
    const activeText = `
      ${memory.decision}
      ${memory.intent}
      ${memory.constraints}
      ${memory.reasoning}
    `;

    const keywords = extractKeywords(activeText);

    if (keywords.length === 0) return [];

    const threshold = keywords.length > 4 ? 3 : 2;

    return savedMemories
      .map((mem, index) => ({
        index,
        score: getMemoryRelevanceScore(mem, keywords),
      }))
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.index);
  };

  useEffect(() => {
    const suggestions = getSuggestedMemoryIndexes();
    setSuggestedMemoryIndexes(suggestions);
  }, [memory, savedMemories]);

  const orderedMemories = [...savedMemories].sort((a, b) => {
    const aIndex = savedMemories.findIndex((m) => m.id === a.id);
    const bIndex = savedMemories.findIndex((m) => m.id === b.id);

    const aSelected = selectedMemoryIndexes.includes(aIndex);
    const bSelected = selectedMemoryIndexes.includes(bIndex);

    // Sticky selected memories (absolute priority)
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    const aSuggested =
      suggestedMemoryIndexes.includes(aIndex) && !aSelected;
    const bSuggested =
      suggestedMemoryIndexes.includes(bIndex) && !bSelected;

    //  Suggested
    if (aSuggested && !bSuggested) return -1;
    if (!aSuggested && bSuggested) return 1;

    return 0;
  });

  //MIGHT NEED filteredMemories, removed now for the system uses orderedMemories now.

  const canSave = MEMORY_FLOW.every((k) => memory[k].trim());

  const synthesis = canSave
    ? `Decision: ${memory.decision}
Intent: ${memory.intent}
Constraints: ${memory.constraints}
Alternatives: ${memory.alternatives}
Reasoning: ${memory.reasoning}`
    : "";

  /* ---------------- Conversation ---------------- */



  const handleSend = () => {
    if (!input.trim()) return;

    //Blocked typing during review
    if (conversationMode === "review") return;

    // different behaviour in reflection mode
      if (conversationMode === "reflecting") {
        continueReflection();
        return;
      }

    setMessages((prev) => [...prev, { role: "user", text: input }]);
    setMemory((prev) => ({ ...prev, [currentField]: input }));

    const idx = MEMORY_FLOW.indexOf(currentField);
    const next = MEMORY_FLOW[idx + 1];

    if (next) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: questionForField(next) },
      ]);
      setCurrentField(next);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            `Here’s a clear snapshot of what you’ve shared.

            You’re now in Review Mode. <br>
            • Editing is paused to preserve clarity <br>
            • You can still edit fields manually <br>
            • Choose one of the actions below when ready <br>`,

            
        },
      ]);
      setConversationMode("review");
    }

    setInput("");
  };


  /* ---------------- Save Decision ---------------- */

const generateAI = async ({
  system,
  user,
}: {
  system: string;
  user: string;
}) => {
  // ONLINE (GPT)
  if (aiMode === "online") {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  }

  // OFFLINE (Ollama)
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1:8b",
      prompt: `${system}\n\n${user}`,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error("Ollama request failed");
  }

  const data = await res.json();
  return data.response ?? "";
};



  const generateSummary = async (memory: {
    decision: string;
    intent: string;
    constraints: string;
    alternatives: string;
    reasoning: string;
  }) => {
    try {
      return (
        await generateAI({
          system: `You summarize completed personal decisions.

  Rules:
  - ONE sentence only
  - Max 30 words
  - Past tense
  - Neutral and factual
  - No advice
  - No judgment
  - No new information`,
          user: `Decision:
  ${memory.decision}

  Intent:
  ${memory.intent}

  Constraints:
  ${memory.constraints}

  Alternatives:
  ${memory.alternatives}

  Reasoning:
  ${memory.reasoning}

  Return ONLY the summary sentence.`,
        })
      ).trim();
    } catch {
      return "Summary unavailable";
    }
  };



  const saveDecision = async () => {
    const summary = await generateSummary(memory);

    setSavedMemories((prev) => [
      {
        ...memory,
        summary,
        id: crypto.randomUUID(),
        archived: false,
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setSelectedMemoryIndexes([]);
    setMemory({
      decision: "",
      intent: "",
      constraints: "",
      alternatives: "",
      reasoning: "",
    });

    setCurrentField("decision");
    setConversationMode("capturing");
    setMessages([{ role: "ai", text: questionForField("decision") }]);
  };

  /* ---------------- AI Advisory ---------------- */

  const askAIForAdvice = async () => {
    if (!canSave) return;

    const selectedMemories = selectedMemoryIndexes.map(
      (i) => savedMemories[i]
    );

    const memoryContext =
      selectedMemories.length > 0
        ? `\nPreviously selected decisions for context:\n${selectedMemories
            .map(
            (m, idx) =>
              `${idx + 1}. Decision: ${m.decision}
Constraints: ${m.constraints || "—"}
Alternatives: ${m.alternatives || "—"}`
            )
            .join("\n\n")}`
        : "";

    setMessages((prev) => [
      ...prev,
      { role: "ai", text: "Reflecting on your decision…" },
    ]);

    try {
      const aiText = await generateAI({
        system: `You are an advisory assistant helping a human reflect on a decision.

  Rules:
  - Do NOT make decisions for the user
  - Do NOT add new facts
  - Do NOT modify or reinterpret the decision
  - Use only the provided context
  - Be concise and structured`,
        user: `Here is the confirmed decision context:

  ${synthesis}
  ${memoryContext}

  Respond STRICTLY in this format:

  TRADE-OFFS:
  - (max 3 bullet points)

  RISKS / BLIND SPOTS:
  - (max 3 bullet points)

  REFLECTIVE QUESTION:
  - (only one question, short)`,
      });

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: aiText || "Unable to generate advice." },
      ]);

      setConversationMode("reflecting");
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: "AI request failed." },
      ]);
    }
  };

  
  const continueReflection = async () => {
    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMessage },
      { role: "ai", text: "Thinking it through…" },
    ]);

    setInput("");

    try {
      const aiText = await generateAI({
        system: `You are a reflective thinking assistant.

  Rules:
  - Do NOT make decisions for the user
  - Do NOT change the decision fields
  - Respond only to the user's question or thought
  - Stay grounded in the provided decision context
  - Be concise, calm, and thoughtful`,
        user: `Decision context:
  ${synthesis}

  User reflection:
  ${userMessage}

  Respond as a continuation of reflection.`,
      });

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: aiText || "I need a bit more clarity to respond." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: "Reflection failed. Try again." },
      ]);
    }
  };



  /* ---------------- UI ---------------- */

  return (
    <div className={`app-layout ${isSidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      
      <div className="flashcard-sidebar">

          {/* Toggle ALWAYS visible */}
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(v => !v)}
          aria-label="Toggle sidebar"
        />

        {/* Collapsible content */}
        <div className="sidebar-inner">

        <input
          type="text"
          value={flashcardSearch}
          onChange={(e) => setFlashcardSearch(e.target.value)}
          placeholder="Look for memories..."
          className="flashcard-search"
        />

        {/* 📅 Date filters */}
        <div className="flashcard-date-filters">
          {["all", "week", "month", "year"].map((range) => (
            <button
              key={range}
              className={`date-filter-btn ${
                flashcardDate === range ? "active" : ""
              }`}
              onClick={() =>
                setFlashcardDate(range as "all" | "week" | "month" | "year")
              }
            >
              {range}
            </button>
          ))}
        </div>

          <h3 className="font-semibold mb-3">Decision Memories</h3>

          <p className="text-xs text-[#999ba1] italic mb-4">
            Click to include as context
          </p>

          {orderedMemories.map((mem, index) => {
            const idx = savedMemories.findIndex((m) => m.id === mem.id);
            const visible = isMemoryVisible(mem);

            const isSuggested =
              suggestedMemoryIndexes.includes(idx) &&
              !selectedMemoryIndexes.includes(idx);

            return (
              <div
                key={mem.id}
                className={`sidebar-flashcard-wrapper ${
                  visible ? "visible" : "hidden"
                }`}
                style={{
                  transitionDelay: visible
                    ? "0ms"
                    : `${index * 40}ms`,
                }}
              >
                <div
                  onClick={() =>
                    setSelectedMemoryIndexes((prev) =>
                      prev.includes(idx)
                        ? prev.filter((i) => i !== idx)
                        : [...prev, idx]
                    )
                  }
                  className={`sidebar-flashcard
                    ${selectedMemoryIndexes.includes(idx) ? "selected" : ""}
                    ${isSuggested ? "suggested" : ""}
                  `}

                >
                  <div className="sidebar-flashcard-title">
                    {mem.decision}
                  </div>
                
                  <div className="sidebar-flashcard-summary">
                    {mem.summary}
                  </div>
                </div>
              </div>
            );
          })}


          {savedMemories.length > 0 &&
            savedMemories.every((m) => !isMemoryVisible(m)) && (
              <p className="text-xs text-[#9ca3af] italic">
                No matching decisions found
              </p>
            )}


        </div>
      </div>
      <div className="main-content">
        <div className="container">

          <header className="header">
            <h1 className="title">Thinkly.AI</h1>
            <p className="subtitle">AI supports your thinking. You make the choice.</p>
          </header>

          <div className="ai-toggle-row">
            <span className={`ai-label ${aiMode === "online" ? "active" : ""}`}>
              Cloud (GPT)
            </span>
                    
            <label className="ai-switch">
              <input
                type="checkbox"
                checked={aiMode === "offline"}
                onChange={() =>
                  setAiMode((prev) => (prev === "online" ? "offline" : "online"))
                }
              />
              <span className="ai-slider" />
            </label>
              
            <span className={`ai-label ${aiMode === "offline" ? "active" : ""}`}>
              Local (Ollama)
            </span>
          </div>
              

          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              AI Mode:
            </label>
            <select
              value={aiMode}
              onChange={(e) => setAiMode(e.target.value as "online" | "offline")}
              style={{ marginLeft: "8px" }}
            >
              <option value="online">Cloud (GPT)</option>
              <option value="offline">Local (Ollama)</option>
            </select>
          </div>

          <div className="main-grid">

            {/* Conversation */}
            <div className="conversation-card">
              <h2 className="font-semibold">Conversation</h2>

              <div className="messages">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`message ${m.role}`}
                  >
                    {m.text}
                  </div>

                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="input-row-wrapper">
                <div className="input-row">
                  {conversationMode === "review" ? (
                    <div className="review-message">
                      Review mode — choose Save or Ask AI to continue
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                        className="message-input"
                        placeholder={
                          conversationMode === "reflecting"
                            ? "Respond, question, or think aloud…"
                            : "Take your time, I am here…"
                        }
                      />
                
                      <button onClick={handleSend}>
                        Send
                      </button>
                    </>
                  )}
                </div>
              </div>
              </div>

            {/* Summary */}
            <div className="panel">
              <h2 className="font-semibold mb-4">Decision Summary</h2>

              <MemoryField label="Decision" value={memory.decision} onChange={(v) => setMemory((m) => ({ ...m, decision: v }))} disabled={conversationMode !== "capturing"}/>
              <MemoryField label="Intent" value={memory.intent} onChange={(v) => setMemory((m) => ({ ...m, intent: v }))} disabled={conversationMode !== "capturing"} />
              <MemoryField label="Constraints" value={memory.constraints} onChange={(v) => setMemory((m) => ({ ...m, constraints: v }))} disabled={conversationMode !== "capturing"}/>
              <MemoryField label="Alternatives" value={memory.alternatives} onChange={(v) => setMemory((m) => ({ ...m, alternatives: v }))} disabled={conversationMode !== "capturing"}/>
              <MemoryField label="Reasoning" value={memory.reasoning} onChange={(v) => setMemory((m) => ({ ...m, reasoning: v }))} disabled={conversationMode !== "capturing"}/>

              {canSave && (
                <>
                  <pre className="summary-output">{synthesis}</pre>

                  {conversationMode === "review" && (
                    <p className="review-message">
                      Review actions
                    </p>
                  )}

                  <div className="action-row">
                    <button className="save-btn" onClick={saveDecision}>
                      Save
                    </button>

                    <button className="ask-ai-btn" onClick={askAIForAdvice}>
                      Ask AI
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Memory Field ---------------- */

function MemoryField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="memory-field">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="field-input"
        disabled={disabled}
      />
    </div>
  );
}
