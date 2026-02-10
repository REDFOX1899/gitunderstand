"use client";

import { useState, useCallback } from "react";
import type { TreeNode } from "~/hooks/useIngest";

const EXT_COLORS: Record<string, string> = {
  ".py": "#3572A5",
  ".js": "#f1e05a",
  ".ts": "#3178c6",
  ".tsx": "#3178c6",
  ".jsx": "#f1e05a",
  ".go": "#00ADD8",
  ".rs": "#dea584",
  ".java": "#b07219",
  ".cpp": "#f34b7d",
  ".c": "#555555",
  ".h": "#555555",
  ".cs": "#178600",
  ".swift": "#F05138",
  ".kt": "#A97BFF",
  ".rb": "#701516",
  ".php": "#4F5D95",
  ".html": "#e34c26",
  ".css": "#663399",
  ".scss": "#c6538c",
  ".json": "#292929",
  ".yml": "#cb171e",
  ".yaml": "#cb171e",
  ".md": "#083fa1",
  ".sql": "#e38c00",
  ".sh": "#89e051",
  ".bash": "#89e051",
  ".dockerfile": "#384d54",
  ".toml": "#9c4221",
  ".xml": "#0060ac",
  ".vue": "#41b883",
  ".svelte": "#ff3e00",
};

function getFileExtColor(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "#6b7280";
  return EXT_COLORS[name.substring(idx).toLowerCase()] ?? "#6b7280";
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || bytes === 0) return "";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

function countFiles(node: TreeNode): number {
  if (node.type !== "directory") return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

function nodeMatchesQuery(node: TreeNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.path.toLowerCase().includes(q)) return true;
  if (node.children) {
    return node.children.some((c) => nodeMatchesQuery(c, q));
  }
  return false;
}

interface TreeNodeItemProps {
  node: TreeNode;
  query: string;
  allExpanded: boolean | null;
}

function TreeNodeItem({ node, query, allExpanded }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.type === "directory";

  // Respond to expand/collapse all
  const isExpanded = allExpanded ?? expanded;

  const matchesQuery = !query || nodeMatchesQuery(node, query);
  if (!matchesQuery) return null;

  return (
    <div className="tree-node">
      <div className="flex items-center gap-1 py-[1px]">
        {isDir ? (
          <>
            <button
              onClick={() => setExpanded(!isExpanded)}
              className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-xs text-stone-400 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              &#9654;
            </button>
            <span className="text-sm">&#128193;</span>
            <span className="font-bold text-stone-800">{node.name}/</span>
            {node.children && node.children.length > 0 && (
              <span className="ml-1 text-xs text-stone-400">
                ({countFiles(node)})
              </span>
            )}
          </>
        ) : (
          <>
            <span className="inline-block w-4" />
            <span
              className="mr-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: getFileExtColor(node.name) }}
            />
            <span className="text-stone-700">{node.name}</span>
            {node.size != null && node.size > 0 && (
              <span className="ml-auto pl-2 text-xs tabular-nums text-stone-400">
                {formatFileSize(node.size)}
              </span>
            )}
          </>
        )}
      </div>
      {isDir && isExpanded && node.children && (
        <div className="ml-4 border-l border-stone-200 pl-1">
          {node.children.map((child, i) => (
            <TreeNodeItem
              key={child.path || `${child.name}-${i}`}
              node={child}
              query={query}
              allExpanded={allExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  treeData: TreeNode;
  plainTree?: string;
}

export function FileTree({ treeData, plainTree }: FileTreeProps) {
  const [query, setQuery] = useState("");
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);

  const handleExpandAll = useCallback(() => setAllExpanded(true), []);
  const handleCollapseAll = useCallback(() => setAllExpanded(false), []);

  // Reset allExpanded when user interacts with search
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setAllExpanded(null);
    },
    [],
  );

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search files..."
          className="flex-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-700 placeholder:text-stone-400"
        />
        <button
          onClick={handleExpandAll}
          className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
        >
          Expand
        </button>
        <button
          onClick={handleCollapseAll}
          className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
        >
          Collapse
        </button>
      </div>

      {/* Tree */}
      <div className="max-h-[500px] overflow-auto rounded-lg border border-stone-200 bg-white p-3 font-mono text-sm">
        {treeData ? (
          <TreeNodeItem
            node={treeData}
            query={query}
            allExpanded={allExpanded}
          />
        ) : plainTree ? (
          <pre className="whitespace-pre-wrap text-stone-700">{plainTree}</pre>
        ) : null}
      </div>
    </div>
  );
}
