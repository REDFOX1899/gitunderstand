"use client";

import { useCallback, useMemo } from "react";
import { IngestForm } from "~/components/ingest-form";
import { DigestResults } from "~/components/digest-results";
import { AIAnalysis } from "~/components/ai-analysis";
import { DiagramSection } from "~/components/diagram-section";
import { Progress } from "~/components/ui/progress";
import { useIngest } from "~/hooks/useIngest";
import type { IngestFormData } from "~/hooks/useIngest";

export default function UnifiedPage() {
  const { submit, result, error, loading, progress, digestId } = useIngest();

  const handleSubmit = useCallback(
    (data: IngestFormData) => {
      void submit(data);
    },
    [submit],
  );

  // Extract username/repo from short_repo_url (e.g. "user/repo")
  const diagramInfo = useMemo(() => {
    if (!result?.short_repo_url) return null;
    // short_repo_url format: "user/repo" or "https://github.com/user/repo"
    const url = result.short_repo_url;
    const parts = url
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\/$/, "")
      .split("/");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { username: parts[0], repo: parts[1] };
    }
    // Also try repo_url
    if (result.repo_url) {
      const match =
        /github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9._-]+)/.exec(
          result.repo_url,
        );
      if (match?.[1] && match?.[2]) {
        return { username: match[1], repo: match[2] };
      }
    }
    return null;
  }, [result]);

  return (
    <main className="flex-grow px-4 pb-8">
      <div className="mx-auto max-w-7xl space-y-6 pt-6">
        {/* Header text */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Understand any{" "}
            <span className="text-cyan-600">repository</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-stone-500">
            Generate LLM-friendly digests, AI-powered analysis, and interactive
            diagrams from any GitHub repository.
          </p>
        </div>

        {/* Ingest Form */}
        <IngestForm onSubmit={handleSubmit} loading={loading} />

        {/* Progress Bar */}
        {loading && (
          <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-stone-700">
                {progress.label}
              </span>
              <span className="text-stone-400">{progress.pct}%</span>
            </div>
            <Progress value={progress.pct} className="h-2" />
            {progress.detail && (
              <p className="text-xs text-stone-400">{progress.detail}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Digest Results */}
        {result && <DigestResults result={result} />}

        {/* AI Analysis */}
        {digestId && <AIAnalysis digestId={digestId} />}

        {/* Diagram Section */}
        {diagramInfo && (
          <DiagramSection
            username={diagramInfo.username}
            repo={diagramInfo.repo}
            ingestContent={result?.content}
          />
        )}
      </div>
    </main>
  );
}
