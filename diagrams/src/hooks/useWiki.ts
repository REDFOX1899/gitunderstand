"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useIngest } from "~/hooks/useIngest";
import { useDiagram } from "~/hooks/useDiagram";
import { readSSEStream } from "~/lib/sse-reader";
import type { WikiSection, SummaryState } from "~/lib/wiki-types";

export function useWiki(username: string, repo: string) {
  const [activeSection, setActiveSection] = useState<WikiSection>("overview");

  // Ingest state — reuse existing hook
  const ingest = useIngest();

  // Diagram state — reuse existing hook
  const diagram = useDiagram(username, repo);

  // AI summaries state
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});
  const [aiAvailable, setAiAvailable] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const [digestId, setDigestId] = useState<string | null>(null);

  // Track whether ingest has been triggered
  const ingestTriggered = useRef(false);

  // Auto-trigger ingest on mount
  useEffect(() => {
    if (ingestTriggered.current) return;
    ingestTriggered.current = true;

    void ingest.submit({
      input_text: `https://github.com/${username}/${repo}`,
      pattern_type: "exclude",
      pattern: "",
      max_file_size: 243,
      output_format: "text",
      target_model: "",
    });
  }, [username, repo, ingest]);

  // Extract digestId when ingest completes
  useEffect(() => {
    if (ingest.result?.digest_url) {
      const id = ingest.result.digest_url.split("/").pop() ?? null;
      setDigestId(id);
    }
  }, [ingest.result]);

  // Check AI availability after ingest completes
  useEffect(() => {
    if (!digestId) return;

    let cancelled = false;
    let attempt = 0;

    const check = async () => {
      try {
        const res = await fetch("/api/summary/available");
        const data = (await res.json()) as {
          available: boolean;
          quota?: { remaining: number; limit: number };
        };
        if (cancelled) return;
        setAiAvailable(!!data.available);
        if (data.quota) setQuota(data.quota);

        if (!data.available && attempt < 3) {
          attempt++;
          setTimeout(() => void check(), 2000 * attempt);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 3) {
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

  // Generate a summary for a given type
  const generateSummary = useCallback(
    async (summaryType: string) => {
      if (!aiAvailable || !digestId) return;

      // Don't regenerate if we already have it
      const existing = summaries[summaryType];
      if (existing?.content || existing?.loading) return;

      setSummaries((prev) => ({
        ...prev,
        [summaryType]: { content: null, loading: true, error: null },
      }));

      await readSSEStream(
        "/api/summary/stream",
        { digest_id: digestId, summary_type: summaryType },
        (event) => {
          switch (event.type) {
            case "complete":
              setSummaries((prev) => ({
                ...prev,
                [summaryType]: {
                  content: event.payload.content as string,
                  loading: false,
                  error: null,
                },
              }));
              if (event.payload.quota)
                setQuota(event.payload.quota as { remaining: number; limit: number });
              break;
            case "error":
              setSummaries((prev) => ({
                ...prev,
                [summaryType]: {
                  content: null,
                  loading: false,
                  error: (event.payload.message as string) ?? "Failed to generate summary",
                },
              }));
              break;
          }
        },
        (err) => {
          setSummaries((prev) => ({
            ...prev,
            [summaryType]: {
              content: null,
              loading: false,
              error: `Network error: ${err.message}`,
            },
          }));
        },
      );
    },
    [aiAvailable, digestId, summaries],
  );

  // Auto-generate overview summary when AI becomes available
  const overviewTriggered = useRef(false);
  useEffect(() => {
    if (aiAvailable && digestId && !overviewTriggered.current) {
      overviewTriggered.current = true;
      void generateSummary("architecture");
    }
  }, [aiAvailable, digestId, generateSummary]);

  // Generate summary when navigating to a section that needs one
  useEffect(() => {
    const sectionSummaryMap: Record<string, string> = {
      overview: "architecture",
      security: "security",
      "getting-started": "onboarding",
    };

    const summaryType = sectionSummaryMap[activeSection];
    if (summaryType && aiAvailable && digestId) {
      void generateSummary(summaryType);
    }
  }, [activeSection, aiAvailable, digestId, generateSummary]);

  return {
    activeSection,
    setActiveSection,
    ingest: {
      result: ingest.result,
      loading: ingest.loading,
      progress: ingest.progress,
      error: ingest.error,
    },
    diagram,
    summaries,
    aiAvailable,
    quota,
    digestId,
    generateSummary,
    username,
    repo,
  };
}

export type WikiContextType = ReturnType<typeof useWiki>;
