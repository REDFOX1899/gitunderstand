"use client";

import { useWikiContext } from "../wiki-context";
import { SectionSkeleton } from "../wiki-skeleton";
import { renderMarkdownToHtml } from "~/lib/markdown";

export function GettingStartedSection() {
  const { summaries, generateSummary, aiAvailable, ingest } = useWikiContext();

  const summary = summaries.onboarding;
  const isIngestLoading = ingest.loading;

  if (isIngestLoading && !summary?.content) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-stone-900">Getting Started</h1>
        <p className="mb-6 text-sm text-stone-400">
          Onboarding guide for new contributors
        </p>
        <SectionSkeleton lines={8} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Getting Started</h1>
      <p className="mb-6 text-sm text-stone-400">
        Onboarding guide for new contributors
      </p>

      {!summary?.content && !summary?.loading && !summary?.error && (
        <div className="text-center">
          {aiAvailable ? (
            <button
              onClick={() => void generateSummary("onboarding")}
              className="rounded-lg bg-cyan-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
            >
              Generate Onboarding Guide
            </button>
          ) : (
            <p className="text-sm text-stone-400">
              AI features are not available. The server may not have an API key configured.
            </p>
          )}
        </div>
      )}

      {summary?.loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            <span className="text-sm text-stone-600">
              Generating onboarding guide...
            </span>
          </div>
          <SectionSkeleton lines={6} />
        </div>
      )}

      {summary?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {summary.error}
        </div>
      )}

      {summary?.content && (
        <div
          className="prose prose-sm max-w-none text-stone-700 prose-headings:text-stone-900 prose-a:text-cyan-600"
          dangerouslySetInnerHTML={{
            __html: renderMarkdownToHtml(summary.content),
          }}
        />
      )}
    </div>
  );
}
