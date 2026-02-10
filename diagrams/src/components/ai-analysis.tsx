"use client";

import { useState, useCallback, useEffect } from "react";
import { Card } from "~/components/ui/card";
import { readSSEStream } from "~/lib/sse-reader";
import { AIChat } from "~/components/ai-chat";

const AI_TYPE_LABELS: Record<string, string> = {
  architecture: "Architecture Overview",
  code_review: "Code Review",
  onboarding: "Onboarding Guide",
  security: "Security Audit",
};

function renderMarkdownToHtml(markdown: string): string {
  const html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang: string, code: string) => {
        const langLabel = lang
          ? `<span class="absolute top-2 right-12 text-[10px] text-stone-400 font-mono uppercase">${lang}</span>`
          : "";
        return `<div class="relative my-3">${langLabel}<pre class="bg-stone-900 text-stone-100 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"><code>${code}</code></pre></div>`;
      },
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-stone-200 px-1 rounded text-xs font-mono">$1</code>',
    )
    // Headers
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
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="ml-8">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // HR
    .replace(/^---$/gm, '<hr class="my-3 border-stone-300">')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, "<br>");

  return `<p class="my-2">${html}</p>`;
}

interface AIAnalysisProps {
  digestId: string;
}

export function AIAnalysis({ digestId }: AIAnalysisProps) {
  const [activeTab, setActiveTab] = useState<"summaries" | "chat">("summaries");
  const [available, setAvailable] = useState(false);
  const [quota, setQuota] = useState<{
    remaining: number;
    limit: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [summaryType, setSummaryType] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoadingText, setSummaryLoadingText] = useState("");
  const [cached, setCached] = useState(false);
  const [activeSummaryType, setActiveSummaryType] = useState<string | null>(
    null,
  );

  // Check AI availability
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 3;

    const check = async () => {
      try {
        const res = await fetch("/api/summary/available");
        const data = (await res.json()) as {
          available: boolean;
          quota?: { remaining: number; limit: number };
        };
        if (cancelled) return;
        setAvailable(!!data.available);
        if (data.quota) setQuota(data.quota);

        if (!data.available && attempt < maxAttempts) {
          attempt++;
          setTimeout(() => void check(), 2000 * attempt);
        }
      } catch {
        if (cancelled) return;
        setAvailable(false);
        if (attempt < maxAttempts) {
          attempt++;
          setTimeout(() => void check(), 2000 * attempt);
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [digestId]);

  const generateSummary = useCallback(
    async (type: string) => {
      if (!available || !digestId) return;

      setSummaryLoading(true);
      setSummaryContent(null);
      setSummaryError(null);
      setCached(false);
      setActiveSummaryType(type);
      setSummaryLoadingText(
        `Generating ${(AI_TYPE_LABELS[type] ?? type).toLowerCase()}...`,
      );

      await readSSEStream(
        "/api/summary/stream",
        { digest_id: digestId, summary_type: type },
        (event) => {
          switch (event.type) {
            case "generating":
              setSummaryLoadingText(
                (event.payload.message as string) ?? "Generating...",
              );
              break;
            case "complete":
              setSummaryLoading(false);
              setSummaryContent(event.payload.content as string);
              setSummaryType(
                AI_TYPE_LABELS[event.payload.summary_type as string] ??
                  (event.payload.summary_type as string),
              );
              setCached(!!(event.payload.cached as boolean));
              if (event.payload.quota)
                setQuota(
                  event.payload.quota as { remaining: number; limit: number },
                );
              break;
            case "error":
              setSummaryLoading(false);
              setSummaryError(
                (event.payload.message as string) ??
                  "An error occurred during AI analysis.",
              );
              break;
          }
        },
        (err) => {
          setSummaryLoading(false);
          setSummaryError(`Network error: ${err.message}`);
        },
      );
    },
    [available, digestId],
  );

  const copySummary = useCallback(async () => {
    if (!summaryContent) return;
    try {
      await navigator.clipboard.writeText(summaryContent);
    } catch {
      /* ignore */
    }
  }, [summaryContent]);

  return (
    <Card className="border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      {/* Tabs */}
      <div className="mb-4 flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab("summaries")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "summaries"
              ? "border-cyan-600 font-semibold text-cyan-600"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          AI Summaries
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "chat"
              ? "border-cyan-600 font-semibold text-cyan-600"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          Chat
        </button>
        {/* Quota display */}
        {quota && (
          <div className="ml-auto flex items-center text-xs text-stone-400">
            <span
              className={`font-medium ${
                quota.remaining > 2
                  ? "text-green-600"
                  : quota.remaining > 0
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {quota.remaining}/{quota.limit}
            </span>{" "}
            <span className="ml-1">AI requests remaining</span>
          </div>
        )}
      </div>

      {/* Not available notice */}
      {!available && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          AI features are not available. The server may not have an API key
          configured.
        </div>
      )}

      {/* Summaries tab */}
      {activeTab === "summaries" && (
        <div className="space-y-4">
          {/* Summary type buttons */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(AI_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => void generateSummary(key)}
                disabled={!available || summaryLoading}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  activeSummaryType === key
                    ? "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                } ${!available || summaryLoading ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {summaryLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
              <span className="text-sm text-stone-600">
                {summaryLoadingText}
              </span>
            </div>
          )}

          {/* Error state */}
          {summaryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {summaryError}
            </div>
          )}

          {/* Result */}
          {summaryContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-stone-700">
                    {summaryType}
                  </h3>
                  {cached && (
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                      Cached
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void copySummary()}
                  className="rounded border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Copy
                </button>
              </div>
              <div
                className="prose prose-sm max-w-none rounded-lg border border-stone-200 bg-white p-4 text-sm leading-relaxed text-stone-700"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(summaryContent),
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <AIChat digestId={digestId} available={available} />
      )}
    </Card>
  );
}
