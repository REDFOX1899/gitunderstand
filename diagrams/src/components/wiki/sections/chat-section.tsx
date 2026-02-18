"use client";

import { useWikiContext } from "../wiki-context";
import { AIChat } from "~/components/ai-chat";

export function ChatSection() {
  const { digestId, aiAvailable, ingest, getEffectiveGeminiKey } = useWikiContext();

  if (ingest.loading && !digestId) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-stone-900">Chat</h1>
        <p className="mb-6 text-sm text-stone-400">
          Ask questions about the codebase
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          <span className="text-sm text-stone-600">
            Waiting for repository analysis to complete...
          </span>
        </div>
      </div>
    );
  }

  if (!digestId) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-stone-900">Chat</h1>
        <p className="mb-6 text-sm text-stone-400">
          Ask questions about the codebase
        </p>
        <p className="text-sm text-stone-400">
          Repository analysis must complete before chat is available.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Chat</h1>
      <p className="mb-6 text-sm text-stone-400">
        Ask questions about the codebase
      </p>
      <AIChat digestId={digestId} available={aiAvailable} apiKey={getEffectiveGeminiKey()} />
    </div>
  );
}
