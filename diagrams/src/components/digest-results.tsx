"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { FileTree } from "~/components/file-tree";
import type { IngestResult } from "~/hooks/useIngest";

function formatTokenCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

const SEPARATOR = "================================================";

interface ContentBlock {
  path: string;
  content: string;
}

function parseContentBlocks(content: string): ContentBlock[] {
  if (!content) return [];
  const blocks: ContentBlock[] = [];
  const parts = content.split(SEPARATOR);

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    let filePath: string | null = null;
    let contentStart = 0;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j]!.trim();
      if (
        line.startsWith("FILE:") ||
        line.startsWith("DIRECTORY:") ||
        line.startsWith("SYMLINK:")
      ) {
        filePath = line.split(":").slice(1).join(":").trim();
        contentStart = j + 1;
        break;
      }
    }

    if (filePath) {
      const fileContent = lines.slice(contentStart).join("\n").trim();
      if (fileContent) {
        blocks.push({ path: filePath, content: fileContent });
      }
    }
  }

  return blocks;
}

interface DigestResultsProps {
  result: IngestResult;
}

export function DigestResults({ result }: DigestResultsProps) {
  const [activeChunk, setActiveChunk] = useState(0);
  const [viewMode, setViewMode] = useState<"plain" | "highlighted">("plain");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasChunks = result.chunks && result.chunks.length > 1;
  const currentContent = hasChunks
    ? result.chunks![activeChunk]?.content ?? ""
    : result.content;

  const contentBlocks = useMemo(
    () => (viewMode === "highlighted" ? parseContentBlocks(currentContent) : []),
    [currentContent, viewMode],
  );

  const isTextFormat =
    (result.output_format || "text").toLowerCase() === "text";

  const copyToClipboard = useCallback(
    async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const handleCopyAll = useCallback(async () => {
    const full = `${result.tree}\n\nFiles Content:\n\n${currentContent}`;
    await copyToClipboard(full, "all");
  }, [result.tree, currentContent, copyToClipboard]);

  const handleDownload = useCallback(() => {
    if (!result.digest_url) return;
    const a = document.createElement("a");
    a.href = result.digest_url;
    a.download = "digest.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result.digest_url]);

  return (
    <Card className="border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Left column: Summary + Token counts + Actions */}
        <div className="space-y-4 md:col-span-5">
          {/* Summary */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">
              Summary
            </label>
            <textarea
              readOnly
              value={result.summary || ""}
              rows={6}
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-sm text-stone-700"
            />
          </div>

          {/* Token counts */}
          {result.token_counts &&
            Object.keys(result.token_counts).length > 0 && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Token Counts
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(result.token_counts).map(([model, count]) => (
                    <div key={model} className="contents">
                      <span className="text-stone-500">{model}</span>
                      <span className="text-right font-bold text-stone-800">
                        {formatTokenCount(count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="border-stone-300 text-stone-700"
            >
              {copiedField === "all" ? "Copied!" : "Copy All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="border-stone-300 text-stone-700"
            >
              Download
            </Button>
          </div>
        </div>

        {/* Right column: Tree + Content */}
        <div className="space-y-4 md:col-span-7">
          {/* Directory Tree */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">
              Directory Structure
            </label>
            {result.tree_structure ? (
              <FileTree
                treeData={result.tree_structure}
                plainTree={result.tree}
              />
            ) : (
              <div className="max-h-[300px] overflow-auto rounded-lg border border-stone-200 bg-white p-3 font-mono text-sm">
                <pre className="whitespace-pre-wrap text-stone-700">
                  {result.tree}
                </pre>
              </div>
            )}
          </div>

          {/* Chunk navigation */}
          {hasChunks && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                {result.target_model && (
                  <span className="font-medium">
                    Chunked for {result.target_model}
                  </span>
                )}
                <span>
                  Chunk {activeChunk + 1}/{result.chunks!.length}
                  {" -- "}
                  {result.chunks![activeChunk]?.files.length} files
                  {" -- "}
                  {formatTokenCount(
                    result.chunks![activeChunk]?.token_count ?? 0,
                  )}{" "}
                  tokens
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {result.chunks!.map((chunk, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveChunk(idx)}
                    className={`rounded-md px-3 py-1 font-mono text-sm transition-colors ${
                      idx === activeChunk
                        ? "bg-cyan-600 font-semibold text-white shadow-sm"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    Chunk {idx + 1} ({formatTokenCount(chunk.token_count)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-semibold text-stone-700">
                File Contents
              </label>
              {isTextFormat && (
                <div className="flex rounded-md border border-stone-200">
                  <button
                    onClick={() => setViewMode("plain")}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "plain"
                        ? "bg-cyan-600 text-white"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Plain
                  </button>
                  <button
                    onClick={() => setViewMode("highlighted")}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "highlighted"
                        ? "bg-cyan-600 text-white"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Highlighted
                  </button>
                </div>
              )}
            </div>

            {viewMode === "plain" ? (
              <textarea
                readOnly
                value={currentContent}
                rows={16}
                className="w-full resize-y rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-sm text-stone-700"
              />
            ) : (
              <div className="max-h-[500px] space-y-3 overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-3">
                {contentBlocks.length > 0 ? (
                  contentBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      className="overflow-hidden rounded-lg border border-stone-200"
                    >
                      <div className="flex items-center justify-between bg-stone-800 px-3 py-1.5">
                        <span className="font-mono text-xs text-stone-300">
                          {block.path}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(block.content, `block-${idx}`)
                          }
                          className="rounded bg-stone-700 px-2 py-0.5 text-xs text-stone-200 transition-colors hover:bg-stone-600"
                        >
                          {copiedField === `block-${idx}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <pre className="overflow-x-auto bg-stone-900 p-3 font-mono text-xs leading-relaxed text-stone-100">
                        <code>{block.content}</code>
                      </pre>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-stone-400">
                    No file blocks found to highlight.
                  </p>
                )}
              </div>
            )}

            {/* Copy chunk button */}
            {hasChunks && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() =>
                    copyToClipboard(
                      result.chunks![activeChunk]?.content ?? "",
                      "chunk",
                    )
                  }
                  className="rounded border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  {copiedField === "chunk" ? "Copied!" : "Copy Chunk"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
