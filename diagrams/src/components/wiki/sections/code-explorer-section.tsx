"use client";

import { useState, useMemo, useCallback } from "react";
import { useWikiContext } from "../wiki-context";
import { TreeSkeleton } from "../wiki-skeleton";
import { FileTree } from "~/components/file-tree";
import { CodeViewer } from "../code-viewer";
import { parseContentBlocks } from "~/lib/content-parser";
import { FolderOpen } from "lucide-react";

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
      <div>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Code Explorer</h1>
        <p className="mb-6 text-sm text-muted-foreground">Browse files and view source code</p>
        <TreeSkeleton />
      </div>
    );
  }

  if (!ingest.result) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Code Explorer</h1>
        <p className="mb-6 text-sm text-muted-foreground">Browse files and view source code</p>
        <p className="text-sm text-muted-foreground">Repository analysis required.</p>
      </div>
    );
  }

  const selectedContent = selectedFile ? contentMap.get(selectedFile) ?? null : null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">Code Explorer</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Browse files and view source code
        <span className="ml-2 text-xs text-muted-foreground/60">
          Press <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[10px]">/</kbd> to search files
        </span>
      </p>

      <div className="flex gap-0 overflow-hidden rounded-lg border border-border" style={{ height: "calc(100vh - 220px)" }}>
        {/* File tree panel */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-border bg-card">
          {ingest.result.tree_structure ? (
            <FileTree
              treeData={ingest.result.tree_structure}
              plainTree={ingest.result.tree}
              onFileClick={handleFileSelect}
            />
          ) : (
            <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground">
              {ingest.result.tree}
            </pre>
          )}
        </div>

        {/* Code viewer panel */}
        <div className="flex-1">
          {selectedFile && selectedContent ? (
            <CodeViewer
              filePath={selectedFile}
              content={selectedContent}
              username={username}
              repo={repo}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary">
              <div className="text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {selectedFile
                    ? "File content not available in digest"
                    : "Select a file from the tree to view its contents"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
