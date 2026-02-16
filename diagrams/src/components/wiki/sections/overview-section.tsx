"use client";

import { useWikiContext } from "../wiki-context";
import { SectionSkeleton } from "../wiki-skeleton";
import { renderMarkdownToHtml } from "~/lib/markdown";

export function OverviewSection() {
  const { ingest, summaries } = useWikiContext();

  const summary = summaries.architecture;
  const isLoading = ingest.loading || summary?.loading;

  if (isLoading && !ingest.result && !summary?.content) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-stone-900">Overview</h1>
        <p className="mb-6 text-sm text-stone-400">Project summary and key details</p>
        <SectionSkeleton lines={10} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Overview</h1>
      <p className="mb-6 text-sm text-stone-400">Project summary and key details</p>

      {/* Quick summary from ingest */}
      {ingest.result?.summary && (
        <div className="mb-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Summary
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
            {ingest.result.summary}
          </p>
        </div>
      )}

      {/* Token counts */}
      {ingest.result?.token_counts && Object.keys(ingest.result.token_counts).length > 0 && (
        <div className="mb-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Repository Size
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            {Object.entries(ingest.result.token_counts).map(([model, count]) => (
              <div key={model}>
                <span className="text-stone-400">{model}</span>
                <span className="ml-2 font-bold text-stone-800">
                  {count >= 1000000
                    ? `${(count / 1000000).toFixed(1)}M`
                    : count >= 1000
                      ? `${(count / 1000).toFixed(1)}k`
                      : count}{" "}
                  tokens
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Architecture Overview */}
      {summary?.loading && (
        <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          <span className="text-sm text-stone-600">Generating overview...</span>
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
