import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import OpenAI from "openai";
import { useRef } from "react";


/* ---------------- Types ---------------- */

type DecisionMemory = {
  id: string;
  decision: string;
  intent: string;
  constraints: string;
  alternatives: string;
  reasoning: string;
  archived?: boolean;
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
            "Here’s a clear snapshot of what you’ve shared so far. Take a moment to review it — you can save it, adjust it, or ask the AI for perspectives",
        },
      ]);
    }

    setInput("");
  };

  /* ---------------- Save Decision ---------------- */

  const saveDecision = () => {
    setSavedMemories((prev) => [
      {
        ...memory,
        id: crypto.randomUUID(),
        archived: false,
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
      { role: "ai", text: "Reflecting on your decision…"
 },
    ]);

    try {
      const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `You are an advisory assistant helping a human reflect on a decision.

Rules:
- Do NOT make decisions for the user
- Do NOT add new facts
- Do NOT modify or reinterpret the decision
- Use only the provided context
- Be concise and structured`,
    },
    {
      role: "user",
      content: `Here is the confirmed decision context:

${synthesis}
${memoryContext}

Respond STRICTLY in this format:

TRADE-OFFS:
- (max 3 bullet points)

RISKS / BLIND SPOTS:
- (max 3 bullet points)

REFLECTIVE QUESTION:
- (only one question, short)`,
    },
  ],
});


      const aiText =
        response.choices[0]?.message?.content ??
        "Unable to generate advice.";

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: aiText },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", text: "AI request failed." },
      ]);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="app">
      <div className="container">

        <header className="header">
          <h1 className="title">Thinkly.AI</h1>
          <p className="subtitle">AI supports your thinking. You make the choice.</p>
        </header>


        <div className="main-grid">

          {/* Conversation */}
          <div className="conversation-card">
            <h2 className="font-semibold mb-4">Conversation</h2>

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

            <div className="input-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                className="message-input"
                placeholder="Take your time, I am here…"
              />

              <button
                onClick={handleSend}
              >
                Send
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="panel">
            <h2 className="font-semibold mb-4">Decision Summary</h2>

            <MemoryField label="Decision" value={memory.decision} onChange={(v) => setMemory((m) => ({ ...m, decision: v }))} />
            <MemoryField label="Intent" value={memory.intent} onChange={(v) => setMemory((m) => ({ ...m, intent: v }))} />
            <MemoryField label="Constraints" value={memory.constraints} onChange={(v) => setMemory((m) => ({ ...m, constraints: v }))} />
            <MemoryField label="Alternatives" value={memory.alternatives} onChange={(v) => setMemory((m) => ({ ...m, alternatives: v }))} />
            <MemoryField label="Reasoning" value={memory.reasoning} onChange={(v) => setMemory((m) => ({ ...m, reasoning: v }))} />

            {canSave && (
              <>
                <pre className="summary-output">{synthesis}</pre>

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

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setFlashcardView("active")}
            className={`toggle-btn ${
              flashcardView === "active"
                ? "font-semibold"
                : "opacity-60"
            }`}
          >
            Active
          </button>
          
          <button
            onClick={() => setFlashcardView("archived")}
            className={`toggle-btn ${
              flashcardView === "archived"
                ? "font-semibold"
                : "opacity-60"
            }`}
          >
            Archived
          </button>
        </div>


        {/* Flashcards */}
        {savedMemories.some(
          (m) => flashcardView === "active" ? !m.archived : m.archived
        ) && (

          <div className="section">
            <h2 className="font-semibold mb-3">
              Memory Flashcards
            </h2>

            <div className="flashcard-grid">
              {savedMemories.map((mem, idx) => {
                if (flashcardView === "active" && mem.archived) return null;
                if (flashcardView === "archived" && !mem.archived) return null;
                            
                return (

                  <div
                    key={mem.id}
                    onClick={() =>
                      setSelectedMemoryIndexes((prev) =>
                        prev.includes(idx)
                          ? prev.filter((i) => i !== idx)
                          : [...prev, idx]
                      )
                    }
                    className={`flashcard ${
                      selectedMemoryIndexes.includes(idx) ? "flashcard-selected" : ""
                    }`}
                  >
                    <p><strong>{mem.decision}</strong></p>
                    <p className="text-sm text-gray-600">
                      Constraints: {mem.constraints || "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Alternatives: {mem.alternatives || "—"}
                    </p>
                  
                    {/* Archive button – only in ACTIVE view */}
                    {flashcardView === "active" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSavedMemories((prev) =>
                            prev.map((m) =>
                              m.id === mem.id ? { ...m, archived: true } : m
                            )
                          );
                        }}
                        className="archive-btn"
                      >
                        Archive
                      </button>
                    )}

                    {/* Restore button – only in ARCHIVED view */}
                    {flashcardView === "archived" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSavedMemories((prev) =>
                            prev.map((m) =>
                              m.id === mem.id ? { ...m, archived: false } : m
                            )
                          );
                        }}
                        className="restore-btn"
                      >
                        Restore
                      </button>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Memory Field ---------------- */

function MemoryField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="memory-field">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="field-input"
      />
    </div>
  );
}
