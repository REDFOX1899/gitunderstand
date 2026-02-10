"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "~/components/ui/card";
import { useDiagram } from "~/hooks/useDiagram";
import Loading from "~/components/loading";
import MermaidChart from "~/components/mermaid-diagram";
import { ApiKeyDialog } from "~/components/api-key-dialog";
import { ApiKeyButton } from "~/components/api-key-button";
import { Switch } from "~/components/ui/switch";
import { CustomizationDropdown } from "~/components/customization-dropdown";
import { ExportDropdown } from "~/components/export-dropdown";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface DiagramSectionProps {
  username: string;
  repo: string;
  ingestContent?: string;
}

interface NodeDetail {
  path: string;
  url: string;
}

function findFileSnippet(content: string, filePath: string): string | null {
  if (!content || !filePath) return null;
  const separator = "================================================";
  const parts = content.split(separator);

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    for (let j = 0; j < Math.min(lines.length, 5); j++) {
      const line = lines[j]!.trim();
      if (
        (line.startsWith("FILE:") ||
          line.startsWith("DIRECTORY:") ||
          line.startsWith("SYMLINK:")) &&
        line.includes(filePath)
      ) {
        const contentStart = j + 1;
        const snippet = lines.slice(contentStart).join("\n").trim();
        if (snippet) {
          // Return first 80 lines max
          return snippet.split("\n").slice(0, 80).join("\n");
        }
      }
    }
  }
  return null;
}

export function DiagramSection({ username, repo, ingestContent }: DiagramSectionProps) {
  const [zoomingEnabled, setZoomingEnabled] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<
    "customize" | "export" | null
  >(null);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);

  const {
    diagram,
    error,
    loading,
    lastGenerated,
    cost,
    showApiKeyDialog,
    handleModify,
    handleRegenerate,
    handleCopy,
    handleApiKeySubmit,
    handleCloseApiKeyDialog,
    handleOpenApiKeyDialog,
    handleExportImage,
    state,
    checkingCache,
  } = useDiagram(username.toLowerCase(), repo.toLowerCase());

  const handleDropdownToggle = (dropdown: "customize" | "export") => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const handleNodeClick = useCallback((path: string, url: string) => {
    setSelectedNode({ path, url });
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const fileSnippet = useMemo(() => {
    if (!selectedNode || !ingestContent) return null;
    return findFileSnippet(ingestContent, selectedNode.path);
  }, [selectedNode, ingestContent]);

  return (
    <Card className="border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">
          Repository Diagram
        </h2>
        <div className="flex items-center gap-3">
          {/* Controls - only show when diagram loaded and not loading */}
          {!loading && !error && lastGenerated && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDropdownToggle("customize");
                }}
                className={`flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors ${
                  activeDropdown === "customize"
                    ? "bg-stone-200"
                    : "bg-stone-50 hover:bg-stone-100"
                }`}
              >
                <span>Customize</span>
                {activeDropdown === "customize" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDropdownToggle("export");
                }}
                className={`flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors ${
                  activeDropdown === "export"
                    ? "bg-stone-200"
                    : "bg-stone-50 hover:bg-stone-100"
                }`}
              >
                <span>Export</span>
                {activeDropdown === "export" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>

              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                Zoom
                <Switch
                  checked={zoomingEnabled}
                  onCheckedChange={() => setZoomingEnabled(!zoomingEnabled)}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Dropdown Content */}
      {activeDropdown && !loading && (
        <div className="mb-4">
          {activeDropdown === "customize" && (
            <CustomizationDropdown
              onModify={handleModify}
              onRegenerate={handleRegenerate}
              lastGenerated={lastGenerated!}
              isOpen={true}
            />
          )}
          {activeDropdown === "export" && (
            <ExportDropdown
              onCopy={handleCopy}
              lastGenerated={lastGenerated!}
              onExportImage={handleExportImage}
              isOpen={true}
            />
          )}
        </div>
      )}

      {/* Diagram content with optional detail panel */}
      {loading ? (
        <Loading
          cost={cost}
          status={state.status}
          explanation={state.explanation}
          mapping={state.mapping}
          diagram={state.diagram}
        />
      ) : error || state.error ? (
        <div className="py-8 text-center">
          <p className="text-lg font-medium text-red-600">
            {error || state.error}
          </p>
          {(error?.includes("API key") ||
            state.error?.includes("API key")) && (
            <div className="mt-4">
              <ApiKeyButton onClick={handleOpenApiKeyDialog} />
            </div>
          )}
        </div>
      ) : diagram ? (
        <div className="flex gap-0">
          {/* Diagram area */}
          <div className={selectedNode ? "w-[60%]" : "w-full"}>
            <MermaidChart
              chart={diagram}
              zoomingEnabled={zoomingEnabled}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Detail panel */}
          {selectedNode && (
            <div className="w-[40%] border-l border-stone-200 pl-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-stone-800">
                    File Detail
                  </h3>
                  <p className="mt-1 truncate font-mono text-xs text-cyan-600">
                    {selectedNode.path}
                  </p>
                </div>
                <button
                  onClick={handleCloseDetail}
                  className="ml-2 flex-shrink-0 rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-3">
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-100"
                >
                  View on GitHub
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                    />
                  </svg>
                </a>
              </div>

              {/* Code snippet from ingest content */}
              {fileSnippet ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-stone-500">
                    Code Preview
                  </p>
                  <pre className="max-h-[50vh] overflow-auto rounded-lg border border-stone-200 bg-stone-900 p-3 font-mono text-xs leading-relaxed text-stone-100">
                    <code>{fileSnippet}</code>
                  </pre>
                </div>
              ) : ingestContent ? (
                <p className="mt-3 text-xs text-stone-400">
                  No matching content found for this path.
                </p>
              ) : (
                <p className="mt-3 text-xs text-stone-400">
                  Ingest the repository first to see code previews.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        !checkingCache && (
          <div className="py-8 text-center text-sm text-stone-400">
            No diagram available.
          </div>
        )
      )}

      <ApiKeyDialog
        isOpen={showApiKeyDialog}
        onClose={handleCloseApiKeyDialog}
        onSubmit={handleApiKeySubmit}
      />
    </Card>
  );
}
