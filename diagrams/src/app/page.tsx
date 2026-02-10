"use client";

import { useState, useCallback } from "react";
import { IngestForm } from "~/components/ingest-form";
import { DigestResults } from "~/components/digest-results";
import { AIAnalysis } from "~/components/ai-analysis";
import { Progress } from "~/components/ui/progress";
import { useIngest } from "~/hooks/useIngest";
import MainCard from "~/components/main-card";
import type { IngestFormData } from "~/hooks/useIngest";

type Mode = "understand" | "diagrams";

export default function UnifiedPage() {
  const [mode, setMode] = useState<Mode>("understand");
  const { submit, result, error, loading, progress, digestId } = useIngest();

  const handleSubmit = useCallback(
    (data: IngestFormData) => {
      void submit(data);
    },
    [submit],
  );

  return (
    <main className="flex-grow px-4 pb-8">
      <div className="mx-auto max-w-5xl space-y-6 pt-6">
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

        {/* Mode Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
            <button
              onClick={() => setMode("understand")}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                mode === "understand"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Understand
            </button>
            <button
              onClick={() => setMode("diagrams")}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                mode === "diagrams"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Diagrams
            </button>
          </div>
        </div>

        {mode === "understand" ? (
          <>
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
          </>
        ) : (
          /* Diagrams Mode */
          <div className="flex justify-center">
            <MainCard />
          </div>
        )}
      </div>
    </main>
  );
}
