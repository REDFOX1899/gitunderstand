"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useIngest } from "~/hooks/useIngest";
import { useDiagram } from "~/hooks/useDiagram";
import { readSSEStream } from "~/lib/sse-reader";
import { getGeminiKey } from "~/app/_actions/user";
import { safeGetItem } from "~/lib/safe-storage";
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
  const [digestId, setDigestId] = useState<string | null>(null);

  // Auth-aware Gemini key loading (same pattern as useDiagram.ts)
  const { data: session } = useSession();
  const dbGeminiKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      void getGeminiKey().then((key) => { dbGeminiKeyRef.current = key; });
    } else {
      dbGeminiKeyRef.current = null;
    }
  }, [session]);

  const getEffectiveGeminiKey = useCallback((): string | null => {
    if (session?.user && dbGeminiKeyRef.current) return dbGeminiKeyRef.current;
    return safeGetItem("gemini_key");
  }, [session]);

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

    const check = async () => {
      try {
        const res = await fetch("/api/summary/available");
        const data = (await res.json()) as { available: boolean };
        if (cancelled) return;
        // BYOK: AI is available if the endpoint says so AND user has a Gemini key
        const hasKey = !!getEffectiveGeminiKey();
        setAiAvailable(!!data.available && hasKey);
      } catch {
        // AI availability check failed — mark unavailable
        if (!cancelled) setAiAvailable(false);
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [digestId, getEffectiveGeminiKey]);

  // Generate a summary for a given type
  const generateSummary = useCallback(
    async (summaryType: string) => {
      if (!aiAvailable || !digestId) return;

      // Don't regenerate if we already have it or if it already errored
      const existing = summaries[summaryType];
      if (existing?.content || existing?.loading || existing?.error) return;

      const apiKey = getEffectiveGeminiKey();
      if (!apiKey) return;

      setSummaries((prev) => ({
        ...prev,
        [summaryType]: { content: null, loading: true, error: null },
      }));

      await readSSEStream(
        "/api/summary/stream",
        { digest_id: digestId, summary_type: summaryType, api_key: apiKey },
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
    [aiAvailable, digestId, summaries, getEffectiveGeminiKey],
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
    digestId,
    generateSummary,
    getEffectiveGeminiKey,
    username,
    repo,
  };
}

export type WikiContextType = ReturnType<typeof useWiki>;
