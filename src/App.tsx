import { useState, useEffect } from "react";
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
  | "editing"
  | "confirm"
  | "reflecting";

type MemoryVector = {
  id: string; // same as DecisionMemory.id
  vector: Record<string, number>;
};


/* ---------------- Conversation Flow ---------------- */

/*const MEMORY_FLOW: MemoryFieldKey[] = [
  "decision",
  "intent",
  "constraints",
  "alternatives",
  "reasoning",
];*/

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

  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteIndexes, setDeleteIndexes] = useState<number[]>([]);

  const deleteMemoryById = (id: string) => {
    setSavedMemories((prev) => prev.filter((m) => m.id !== id));
    setMemoryVectors((prev) => prev.filter((v) => v.id !== id));
    setSelectedMemoryIndexes([]);
  };

  /* ---------------- AI Mode ---------------- */

  const aiMode: "offline" = "offline";

  /* ---------------- State ---------------- */
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [currentField, setCurrentField] =
    useState<MemoryFieldKey>("decision");

  const [conversationMode, setConversationMode] =
    useState<ConversationMode>("capturing");

  const showActions =
    conversationMode === "review" ||
    conversationMode === "editing" ||
    conversationMode === "confirm" ||
    conversationMode === "reflecting";

  const [memory, setMemory] = useState<Omit<DecisionMemory, "id">>({
    decision: "",
    intent: "",
    constraints: "",
    alternatives: "",
    reasoning: "",
  });

  const [savedMemories, setSavedMemories] =
    useState<DecisionMemory[]>([]);

  const [memoryVectors, setMemoryVectors] = useState<MemoryVector[]>([]);
  const [hasLoadedVectors, setHasLoadedVectors] = useState(false);


  const [hasLoadedMemories, setHasLoadedMemories] = useState(false);

  /* ---------------- Load Saved Memories ---------------- */
  useEffect(() => {
    const stored = localStorage.getItem("thinkly_memories");
    if (stored) {
      try {
        setSavedMemories(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load saved memories", e);
      }
    }
    setHasLoadedMemories(true);
  }, []);


  const [selectedMemoryIndexes, setSelectedMemoryIndexes] =
    useState<number[]>([]);

  const [flashcardView, setFlashcardView] = useState<
    "active" | "archived"
  >("active");

  useEffect(() => {
    const stored = localStorage.getItem("thinkly_vectors");

    if (stored) {
      try {
        setMemoryVectors(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load vectors", e);
      }
    }

    setHasLoadedVectors(true);
  }, []);

  /* ---------------- AI System Prompts ---------------- */

  const MEMORY_INFERENCE_SYSTEM = `
  You are running locally on the user's device.
  You do not send or receive data from the internet.

  You help a human gain clarity about a personal decision.

  Your role:
  - Listen carefully
  - Reflect what the user has expressed
  - Infer structured fields from natural conversation

  Rules:
  - Do NOT make decisions for the user
  - Do NOT invent information
  - Do NOT force completion of fields
  - If information is unclear, leave it empty
  - Use the user's own words when possible

  You must return ONLY valid JSON in this exact shape:
  {
    "decision": "",
    "intent": "",
    "constraints": "",
    "alternatives": "",
    "reasoning": ""
  }
  `;


  /* ---------------- Persist Memories ---------------- */
  useEffect(() => {
    if (!hasLoadedMemories) return;

    localStorage.setItem(
      "thinkly_memories",
      JSON.stringify(savedMemories)
    );
  }, [savedMemories, hasLoadedMemories]);

  useEffect(() => {
    if (!hasLoadedVectors) return;

    localStorage.setItem(
      "thinkly_vectors",
      JSON.stringify(memoryVectors)
    );
  }, [memoryVectors, hasLoadedVectors]);


  /* ---------------- Startup ---------------- */
  useEffect(() => {
    setMessages([
      {
        role: "ai",
        text: "Hey! What’s been weighing on your mind or pulling you in different directions lately?",
      },
    ]);
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

  const buildVector = (text: string): Record<string, number> => {
    const keywords = extractKeywords(text);
    const vector: Record<string, number> = {};
    
    keywords.forEach((kw) => {
      vector[kw] = (vector[kw] || 0) + 1;
    });
  
    return vector;
  };

  const vectorSimilarity = (
    a: Record<string, number>,
    b: Record<string, number>
  ) => {
    let score = 0;

    Object.keys(a).forEach((key) => {
      if (b[key]) {
        score += a[key] * b[key];
      }
    });

    return score;
  };


    const getSuggestedMemoryIndexes = () => {
    if (!hasLoadedVectors || memoryVectors.length === 0) return [];

    const activeText = `
      ${memory.decision}
      ${memory.intent}
      ${memory.constraints}
      ${memory.reasoning}
    `;

    const queryVector = buildVector(activeText);
    if (Object.keys(queryVector).length === 0) return [];

    return memoryVectors
      .map((mv) => {
        const sim = vectorSimilarity(queryVector, mv.vector);

      const mem = savedMemories.find((m) => m.id === mv.id);
        if (!mem) return null;

        const daysOld =
          (Date.now() - mem.createdAt) / (1000 * 60 * 60 * 24);

        const recencyBoost = daysOld < 30 ? 1 : 0;

        return {
          index: savedMemories.findIndex((m) => m.id === mv.id),
          score: sim + recencyBoost,
        };
      })
      .filter(
        (x): x is { index: number; score: number } =>
          x !== null && x.score > 0
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.index);
  };


  useEffect(() => {
    const suggestions = getSuggestedMemoryIndexes();
    setSuggestedMemoryIndexes(suggestions);
  }, [memory, savedMemories, memoryVectors, hasLoadedVectors]);


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

  const canSave =
    memory.decision ||
    memory.intent ||
    memory.constraints ||
    memory.alternatives ||
    memory.reasoning;


  const synthesis = canSave
    ? `Decision: ${memory.decision}
Intent: ${memory.intent}
Constraints: ${memory.constraints}
Alternatives: ${memory.alternatives}
Reasoning: ${memory.reasoning}`
    : "";

  /* ---------------- Conversation ---------------- */

  const shouldInfer = (messages: Message[]) => {
    const userMessages = messages.filter((m) => m.role === "user");
    return userMessages.length >= 3; // critical threshold
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (conversationMode === "review") return;

    const userMessage: Message = { role: "user", text: input };

    // 1. Show user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    // 2. Infer memory silently (after enough signal)
    if (shouldInfer(updatedMessages)) {
      const inferred = await inferMemoryFromConversation(updatedMessages);

      if (inferred) {
        setMemory((prev) => ({
          decision: inferred.decision || prev.decision,
          intent: inferred.intent || prev.intent,
          constraints: inferred.constraints || prev.constraints,
          alternatives: inferred.alternatives || prev.alternatives,
          reasoning: inferred.reasoning || prev.reasoning,
        }));
      }
    }

    // 3. AI responds naturally (conversation AI)
    const aiText = await generateAI({
      system: `
  You are running locally on the user's device.
  You help a human gain clarity about a decision.

  Behavior:
  - Reflect what the user just said
  - Progress the thinking forward
  - Do NOT repeat the same question in different words
  - If intent, constraints, or preferences become clear, acknowledge them

  Rules:
  - Ask at most ONE follow-up question
  - Stop asking questions once enough context exists
  - Never give recommendations unless explicitly asked
  `,
      user: updatedMessages
        .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
        .join("\n"),
    });

    setMessages((prev) => [
  ...prev,
  { role: "ai", text: aiText || "I’m thinking this through with you." },
]);

  };


  /* ---------------- AI Core ---------------- */

    const generateAI = async ({
      system,
      user,
    }: {
      system: string;
      user: string;
    }) => {
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.1:8b",
          prompt: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
          stream: false,
        }),
      });
    
      if (!res.ok) {
        throw new Error("Local AI (Ollama) is not running");
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
          system: `You are running locally on the user's device.
          You do not send or receive data from the internet.

          You summarize completed personal decisions.

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

  /* ---------------- AI Inference ---------------- */

  const inferMemoryFromConversation = async (messages: Message[]) => {
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join("\n");
  
    const aiResponse = await generateAI({
      system: MEMORY_INFERENCE_SYSTEM,
      user: `
  Here is the conversation so far:
    
  ${conversationText}
    
  Infer the decision-related fields from this conversation.
  If something is unclear, leave it empty.
  `,
    });
  
    try {
      return JSON.parse(aiResponse);
    } catch {
      return null;
    }
  };
  


  const saveDecision = async () => {
    if (!hasLoadedMemories || !hasLoadedVectors) return;

    const summary = await generateSummary(memory);

    const fullText = `
      ${memory.decision}
      ${memory.intent}
      ${memory.constraints}
      ${memory.alternatives}
      ${memory.reasoning}
    `;

    const id = crypto.randomUUID();

    setSavedMemories((prev) => [
      {
        ...memory,
        summary,
        id,
        archived: false,
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setMemoryVectors((prev) => [
      {
        id,
        vector: buildVector(fullText),
      },
      ...prev,
    ]);

    setMemory({
      decision: "",
      intent: "",
      constraints: "",
      alternatives: "",
      reasoning: "",
    });
  
    setCurrentField("decision");
    setConversationMode("capturing");
    setInput("");
  
    setMessages([
      {
        role: "ai",
        text: "Alright. If you want, we can look at something else that’s been on your mind.",
      },
    ]);


    setSelectedMemoryIndexes([]);
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
        system: `You are running locally on the user's device.
        You do not send or receive data from the internet.

        You are an advisory assistant helping a human reflect on a decision.

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
        system: `You are running locally on the user's device.
        You do not send or receive data from the internet.

        You are a reflective thinking assistant.

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
                <div className="sidebar-flashcard-container">
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
                    
                  {/* 🗑️ Delete button */}
                  <button
                    className="flashcard-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const ok = window.confirm("Delete this memory permanently?");
                      if (ok) deleteMemoryById(mem.id);
                    }}
                    title="Delete memory"
                  >
                    <img
                      src="/bin.png"
                      alt="Delete memory"
                      className="flashcard-delete-icon"
                    />
                  </button>
                  
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

          <p className="text-xs text-[#7e838c] italic mb-4">
            Your data is safe. Fully offline only. (Ollama)
          </p>              

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
                      Review mode — choose Save, Edit or Ask AI to continue
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

              <MemoryField label="Decision" value={memory.decision} onChange={(v) => setMemory((m) => ({ ...m, decision: v }))} disabled={conversationMode === "confirm"} />
              <MemoryField label="Intent" value={memory.intent} onChange={(v) => setMemory((m) => ({ ...m, intent: v }))} disabled={conversationMode === "confirm"} />
              <MemoryField label="Constraints" value={memory.constraints} onChange={(v) => setMemory((m) => ({ ...m, constraints: v }))} disabled={conversationMode === "confirm"}/>
              <MemoryField label="Alternatives" value={memory.alternatives} onChange={(v) => setMemory((m) => ({ ...m, alternatives: v }))} disabled={conversationMode === "confirm"}/>
              <MemoryField label="Reasoning" value={memory.reasoning} onChange={(v) => setMemory((m) => ({ ...m, reasoning: v }))} disabled={conversationMode === "confirm"}/>

              {canSave && (
                <>
                  <pre className="summary-output">{synthesis}</pre>

                  {canSave && showActions && (
                    <>
                      {/* Edit & Confirm always visible after review */}
                      <div className="action-row">
                        <button
                          className="edit-btn"
                          onClick={() => setConversationMode("editing")}
                        >
                          Edit
                        </button>
                                    
                        <button
                          className="confirm-btn"
                          onClick={() => setConversationMode("confirm")}
                        >
                          Confirm
                        </button>
                      </div>
                                    
                      {/* Ask AI always visible */}
                      <div className="action-row">
                        <button className="ask-ai-btn" onClick={askAIForAdvice}>
                          Ask AI
                        </button>
                                    
                        {/* Save only after confirm */}
                        {conversationMode === "confirm" && (
                          <button className="save-btn" onClick={saveDecision}>
                            Save
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  


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
