"use client";

import { useState, useMemo, useCallback } from "react";
import { useWikiContext } from "../wiki-context";
import { TreeSkeleton } from "../wiki-skeleton";
import { FileTree } from "~/components/file-tree";
import { CodeViewer } from "../code-viewer";
import { parseContentBlocks } from "~/lib/content-parser";
import { Copy, Check, FolderOpen } from "lucide-react";

/* ─── Copy Button (Gitingest style) ─── */
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={() => void handleCopy()}
      className="flex items-center gap-1 rounded-lg border-[2px] border-gray-900 bg-[#EBDBB7] px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-[#FFC480]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> Copied!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> {label}
        </>
      )}
    </button>
  );
}

/* ─── 3D Shadow Box (Gitingest style) ─── */
function ShadowBox({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl bg-gray-900" />
      <div className="relative z-10 overflow-hidden rounded-xl border-[3px] border-gray-900 bg-white">
        {children}
      </div>
    </div>
  );
}

export function CodeExplorerSection() {
  const { ingest, username, repo } = useWikiContext();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const contentBlocks = useMemo(() => {
    if (!ingest.result?.content) return [];
    return parseContentBlocks(ingest.result.content);
  }, [ingest.result?.content]);

  const contentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const block of contentBlocks) {
      map.set(block.path, block.content);
    }
    return map;
  }, [contentBlocks]);

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  if (ingest.loading && !ingest.result) {
    return (
      <div className="bg-[#FFFDF8] p-6">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Code Explorer</h1>
        <p className="mb-6 text-sm text-gray-500">Browse files and view source code</p>
        <TreeSkeleton />
      </div>
    );
  }

  if (!ingest.result) {
    return (
      <div className="bg-[#FFFDF8] p-6">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Code Explorer</h1>
        <p className="mb-6 text-sm text-gray-500">Browse files and view source code</p>
        <p className="text-sm text-gray-500">Repository analysis required.</p>
      </div>
    );
  }

  const selectedContent = selectedFile ? contentMap.get(selectedFile) ?? null : null;

  return (
    <div className="bg-[#FFFDF8] p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Code Explorer</h1>
          <p className="text-sm text-gray-500">
            Browse files and view source code
            <span className="ml-2 text-xs text-gray-400">
              Press <kbd className="rounded border-[2px] border-gray-900 bg-[#EBDBB7] px-1.5 py-0.5 font-mono text-[10px] font-bold">/</kbd> to search
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <CopyButton text={ingest.result.tree} label="Copy Tree" />
          <CopyButton text={ingest.result.content} label="Copy Content" />
        </div>
      </div>

      {/* Summary bar */}
      <ShadowBox className="mb-4">
        <div className="flex items-center justify-between bg-[#FFF4DA] px-5 py-3">
          <span className="text-sm font-bold text-gray-900">
            {ingest.result.short_repo_url}
          </span>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="font-bold">{contentBlocks.length} files</span>
            {ingest.result.token_counts &&
              Object.entries(ingest.result.token_counts).slice(0, 2).map(([model, count]) => (
                <span key={model}>
                  {model}:{" "}
                  <span className="font-bold">
                    {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                  </span>
                </span>
              ))}
          </div>
        </div>
      </ShadowBox>

      {/* Main content: Tree + Code Viewer */}
      <ShadowBox>
        <div className="flex" style={{ height: "calc(100vh - 310px)" }}>
          {/* File tree panel */}
          <div className="w-80 flex-shrink-0 overflow-y-auto border-r-[3px] border-gray-900 bg-[#FFFDF8] p-2">
            {ingest.result.tree_structure ? (
              <FileTree
                treeData={ingest.result.tree_structure}
                plainTree={ingest.result.tree}
                onFileClick={handleFileSelect}
                selectedFile={selectedFile}
              />
            ) : (
              <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-gray-700">
                {ingest.result.tree}
              </pre>
            )}
          </div>

          {/* Code viewer panel */}
          <div className="flex-1 overflow-hidden">
            {selectedFile && selectedContent ? (
              <CodeViewer
                filePath={selectedFile}
                content={selectedContent}
                username={username}
                repo={repo}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#FFF4DA]">
                <div className="text-center">
                  <FolderOpen className="mx-auto h-14 w-14 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-500">
                    {selectedFile
                      ? "File content not available in digest"
                      : "Select a file from the tree to view its contents"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </ShadowBox>
    </div>
  );
}
