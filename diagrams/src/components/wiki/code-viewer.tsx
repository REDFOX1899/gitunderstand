"use client";

import { useState, useCallback } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";

interface CodeViewerProps {
  filePath: string;
  content: string;
  username: string;
  repo: string;
}

export function CodeViewer({ filePath, content, username, repo }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const lines = content.split("\n");
  const githubUrl = `https://github.com/${username}/${repo}/blob/main/${filePath}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [content]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-stone-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-700 bg-stone-800 px-4 py-2">
        <span className="truncate font-mono text-xs text-stone-300">
          {filePath}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleCopy()}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-stone-300 transition-colors hover:bg-stone-700 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-stone-300 transition-colors hover:bg-stone-700 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            GitHub
          </a>
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto bg-stone-900">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-stone-800/50">
                <td className="select-none border-r border-stone-700 px-3 py-0 text-right font-mono text-xs leading-5 text-stone-500">
                  {i + 1}
                </td>
                <td className="px-4 py-0 font-mono text-xs leading-5 text-stone-100">
                  <pre className="whitespace-pre">{line || " "}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
