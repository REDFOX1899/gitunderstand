"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { readSSEStream } from "~/lib/sse-reader";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "What does this codebase do?",
  "What are the main components?",
  "How is the code structured?",
  "Are there any potential issues?",
];

function renderMarkdownToHtml(markdown: string): string {
  const html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang: string, code: string) => {
        const langLabel = lang
          ? `<span class="absolute top-2 right-12 text-[10px] text-stone-400 font-mono uppercase">${lang}</span>`
          : "";
        return `<div class="relative my-3">${langLabel}<pre class="bg-stone-900 text-stone-100 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"><code>${code}</code></pre></div>`;
      },
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-stone-200 px-1 rounded text-xs font-mono">$1</code>',
    )
    .replace(
      /^#### (.+)$/gm,
      '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="font-bold text-base mt-4 mb-1">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>',
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>',
    )
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="ml-8">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/^---$/gm, '<hr class="my-3 border-stone-300">')
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, "<br>");

  return `<p class="my-2">${html}</p>`;
}

interface AIChatProps {
  digestId: string;
  available: boolean;
}

export function AIChat({ digestId, available }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore chat history from sessionStorage
  useEffect(() => {
    if (!digestId) return;
    try {
      const saved = sessionStorage.getItem(`chat_${digestId}`);
      if (!saved) return;
      const history = JSON.parse(saved) as Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      if (!Array.isArray(history) || history.length === 0) return;
      setMessages(
        history.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(),
        })),
      );
      setShowSuggestions(false);
    } catch {
      /* ignore parse errors */
    }
  }, [digestId]);

  // Save chat history
  const saveHistory = useCallback(
    (msgs: ChatMessage[]) => {
      if (!digestId) return;
      try {
        sessionStorage.setItem(
          `chat_${digestId}`,
          JSON.stringify(
            msgs.map((m) => ({ role: m.role, content: m.content })),
          ),
        );
      } catch {
        /* ignore quota errors */
      }
    },
    [digestId],
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim();
      if (!message || busy) return;
      if (!available) {
        setError("AI features are not configured.");
        return;
      }
      if (!digestId) {
        setError("No digest available.");
        return;
      }

      setInput("");
      setShowSuggestions(false);
      setError(null);

      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      saveHistory(newMessages);
      setBusy(true);

      // Auto-resize textarea back
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await readSSEStream(
        "/api/chat/stream",
        {
          digest_id: digestId,
          message,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        (event) => {
          switch (event.type) {
            case "thinking":
              break;
            case "complete": {
              const content = (event.payload.content as string) ?? "";
              const assistantMsg: ChatMessage = {
                role: "assistant",
                content,
                timestamp: new Date(),
              };
              setMessages((prev) => {
                const updated = [...prev, assistantMsg];
                saveHistory(updated);
                return updated;
              });
              setBusy(false);
              break;
            }
            case "error":
              setError(
                (event.payload.message as string) ?? "An error occurred.",
              );
              setBusy(false);
              break;
          }
        },
        (err) => {
          setError(`Network error: ${err.message}`);
          setBusy(false);
        },
      );
    },
    [input, busy, available, digestId, messages, saveHistory],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  const handleAutoResize = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setShowSuggestions(true);
    if (digestId) {
      try {
        sessionStorage.removeItem(`chat_${digestId}`);
      } catch {
        /* ignore */
      }
    }
  }, [digestId]);

  return (
    <div className="flex flex-col" style={{ height: 480 }}>
      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {/* Welcome message */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div className="max-w-[80%] rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-medium text-stone-800">
              Hello! I have full context of this repository.
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Ask me about architecture, code patterns, bugs, or anything else.
            </p>
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl p-3 ${
                msg.role === "user"
                  ? "border border-cyan-200 bg-cyan-50"
                  : "border border-stone-200 bg-white shadow-sm"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm text-stone-800">
                  {msg.content}
                </p>
              ) : (
                <div
                  className="text-sm leading-relaxed text-stone-700"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownToHtml(msg.content),
                  }}
                />
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-200 text-xs font-bold text-stone-700">
                You
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {busy && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {showSuggestions && messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => void sendMessage(q)}
              disabled={busy || !available}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-stone-200 p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleAutoResize}
            onKeyDown={handleKeyDown}
            disabled={busy || !available}
            placeholder={
              busy ? "Waiting for response..." : "Ask about this codebase..."
            }
            rows={1}
            className="flex-1 resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={busy || !available || !input.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
          >
            Send
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-500 hover:bg-stone-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
