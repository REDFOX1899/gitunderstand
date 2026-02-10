"use client";

import { useState, useCallback, useRef } from "react";
import { readSSEStream } from "~/lib/sse-reader";

export interface IngestFormData {
  input_text: string;
  pattern_type: "exclude" | "include";
  pattern: string;
  max_file_size: number;
  output_format: "text" | "json" | "markdown" | "xml";
  target_model: string;
  token?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: TreeNode[];
}

export interface ChunkData {
  index: number;
  total_chunks: number;
  files: string[];
  token_count: number;
  content: string;
}

export interface IngestResult {
  repo_url: string;
  short_repo_url: string;
  summary: string;
  digest_url: string;
  tree: string;
  content: string;
  token_counts: Record<string, number>;
  chunks?: ChunkData[];
  target_model?: string;
  tree_structure?: TreeNode;
  output_format: string;
}

export interface IngestProgress {
  stage: string;
  label: string;
  pct: number;
  detail: string;
}

const PROGRESS_STAGES: Record<string, { label: string; pct: number }> = {
  parsing: { label: "Parsing URL", pct: 5 },
  cloning: { label: "Cloning repository", pct: 25 },
  analyzing: { label: "Analyzing files", pct: 60 },
  formatting: { label: "Building output", pct: 85 },
  storing: { label: "Saving digest", pct: 95 },
};

export function useIngest() {
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<IngestProgress>({
    stage: "",
    label: "Preparing...",
    pct: 0,
    detail: "Initializing...",
  });
  const abortRef = useRef(false);

  const digestId = result?.digest_url
    ? result.digest_url.split("/").pop() ?? null
    : null;

  const submit = useCallback(async (formData: IngestFormData) => {
    abortRef.current = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({
      stage: "",
      label: "Preparing...",
      pct: 0,
      detail: "Initializing...",
    });

    await readSSEStream(
      "/api/ingest/stream",
      formData,
      (event) => {
        if (abortRef.current) return;

        const { type, payload } = event;

        switch (type) {
          case "parsing":
          case "cloning":
          case "analyzing":
          case "formatting":
          case "storing": {
            const stageInfo = PROGRESS_STAGES[type];
            if (stageInfo) {
              const filesProcessed = payload.files_processed as
                | number
                | undefined;
              setProgress({
                stage: type,
                label: stageInfo.label,
                pct: stageInfo.pct,
                detail: filesProcessed
                  ? `${filesProcessed} files processed`
                  : (payload.message as string) ?? "",
              });
            }
            break;
          }
          case "complete": {
            setProgress({
              stage: "complete",
              label: "Complete",
              pct: 100,
              detail: "",
            });
            setResult(payload as unknown as IngestResult);
            setLoading(false);
            break;
          }
          case "error": {
            setError(
              (payload.error as string) ??
                (payload.message as string) ??
                "An unknown error occurred.",
            );
            setLoading(false);
            break;
          }
        }
      },
      (err) => {
        if (!abortRef.current) {
          setError(err.message);
          setLoading(false);
        }
      },
    );
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    submit,
    reset,
    result,
    error,
    loading,
    progress,
    digestId,
  };
}
