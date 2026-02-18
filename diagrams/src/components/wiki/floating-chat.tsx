"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { AIChat } from "~/components/ai-chat";
import { useWikiContext } from "./wiki-context";

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { digestId, aiAvailable, activeSection, getEffectiveGeminiKey } = useWikiContext();

  // Don't show on the chat section itself
  if (activeSection === "chat") return null;

  // Don't show if no digest available
  if (!digestId) return null;

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Chat with AI
            </h3>
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <AIChat digestId={digestId} available={aiAvailable} apiKey={getEffectiveGeminiKey()} />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? "bg-muted text-foreground"
            : "bg-cyan-600 text-white hover:bg-cyan-700"
        }`}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
