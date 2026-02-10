"use client";

import { useEffect, useRef, useState, useCallback, Component } from "react";
import type { ReactNode } from "react";
import mermaid from "mermaid";

/**
 * Auto-repair common Mermaid syntax mistakes produced by LLMs.
 */
function repairMermaidSyntax(code: string): string {
  let fixed = code;

  // 1. Strip any %%{init:...}%% declarations (we initialize externally)
  fixed = fixed.replace(/%%\{init:[\s\S]*?\}%%/g, "");

  // 2. Fix spaces around pipe characters in edge labels:
  //    -->| "label" | → -->|"label"|
  fixed = fixed.replace(
    /(-->|---|-\.-|==>|-.->|--x|--o)\|\s*"([^"]*)"\s*\|/g,
    '$1|"$2"|',
  );
  // Also handle unquoted labels with surrounding spaces: -->| label |
  fixed = fixed.replace(
    /(-->|---|-\.-|==>|-.->|--x|--o)\|\s+([^"|][^|]*?)\s+\|/g,
    '$1|"$2"|',
  );

  // 3. Remove :::className from subgraph declarations
  //    subgraph "Name":::style → subgraph "Name"
  fixed = fixed.replace(/(subgraph\s+"[^"]*"):::\w+/g, "$1");
  fixed = fixed.replace(/(subgraph\s+\S+):::\w+/g, "$1");

  // 4. Fix subgraph alias syntax: subgraph ID "Name" → subgraph "Name"
  //    Be careful: mermaid supports `subgraph id [title]` in some versions
  //    Only fix the quoted form which is commonly broken
  fixed = fixed.replace(/subgraph\s+\w+\s+"([^"]+)"/g, 'subgraph "$1"');

  // 5. Quote unquoted node labels containing special characters
  //    A[some/path (thing)] → A["some/path (thing)"]
  //    Match node definitions with [...], (...), {...}, ([...]), etc.
  fixed = fixed.replace(
    /(\b\w+)\[([^\]"]+)\]/g,
    (_match, id: string, label: string) => {
      if (/[/\\(){}@#$%^&*!<>;]/.test(label) && !label.startsWith('"')) {
        return `${id}["${label}"]`;
      }
      return `${id}[${label}]`;
    },
  );
  fixed = fixed.replace(
    /(\b\w+)\(([^)"]+)\)/g,
    (_match, id: string, label: string) => {
      if (/[/\\[\]{}@#$%^&*!<>;]/.test(label) && !label.startsWith('"')) {
        return `${id}("${label}")`;
      }
      return `${id}(${label})`;
    },
  );

  // 6. Remove leading/trailing empty lines
  fixed = fixed.trim();

  return fixed;
}

interface MermaidChartProps {
  chart: string;
  zoomingEnabled?: boolean;
  onNodeClick?: (path: string, url: string) => void;
}

interface MermaidErrorState {
  hasError: boolean;
  message: string;
  rawCode: string;
  repairedCode: string | null;
}

const MermaidChart = ({ chart, zoomingEnabled = true, onNodeClick }: MermaidChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorState, setErrorState] = useState<MermaidErrorState>({
    hasError: false,
    message: "",
    rawCode: "",
    repairedCode: null,
  });
  const [copied, setCopied] = useState(false);
  const [activeChart, setActiveChart] = useState(chart);
  const renderIdRef = useRef(0);

  const initMermaid = useCallback(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      htmlLabels: true,
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        nodeSpacing: 50,
        rankSpacing: 50,
        padding: 15,
      },
      themeCSS: `
        .clickable {
          transition: transform 0.2s ease;
        }
        .clickable:hover {
          transform: scale(1.05);
          cursor: pointer;
        }
      `,
    });
  }, []);

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  const initializePanZoom = useCallback(
    async (svgElement: SVGElement) => {
      // Post-process all links: intercept clicks if onNodeClick is provided
      const links = svgElement.querySelectorAll("a");
      links.forEach((link) => {
        const href = link.getAttribute("href") ?? link.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
        if (onNodeClickRef.current && href) {
          // Extract file path from GitHub URL
          // Typical format: https://github.com/user/repo/blob/main/path/to/file
          // or https://github.com/user/repo/tree/main/path/to/dir
          let filePath = href;
          const ghMatch = /github\.com\/[^/]+\/[^/]+\/(?:blob|tree)\/[^/]+\/(.+)/.exec(href);
          if (ghMatch?.[1]) {
            filePath = ghMatch[1];
          }
          link.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onNodeClickRef.current?.(filePath, href);
          });
          link.style.cursor = "pointer";
          link.removeAttribute("target");
        } else {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        }
      });

      if (zoomingEnabled) {
        svgElement.style.maxWidth = "none";
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";

        try {
          const svgPanZoom = (await import("svg-pan-zoom")).default;
          svgPanZoom(svgElement, {
            zoomEnabled: true,
            controlIconsEnabled: true,
            fit: true,
            center: true,
            minZoom: 0.1,
            maxZoom: 10,
            zoomScaleSensitivity: 0.3,
          });
        } catch (error) {
          console.error("Failed to load svg-pan-zoom:", error);
        }
      }
    },
    [zoomingEnabled],
  );

  const renderDiagram = useCallback(
    async (code: string) => {
      if (!containerRef.current) return;

      initMermaid();
      const renderId = `mermaid-${++renderIdRef.current}-${Date.now()}`;

      try {
        // Validate syntax first
        await mermaid.parse(code);
      } catch (parseError) {
        const repaired = repairMermaidSyntax(code);
        // If repair changed something, try again with repaired code
        if (repaired !== code) {
          try {
            await mermaid.parse(repaired);
            // Repaired code parses - render it and store for retry context
            setErrorState({
              hasError: false,
              message: "",
              rawCode: code,
              repairedCode: repaired,
            });
            // Render the repaired version
            const { svg } = await mermaid.render(renderId, repaired);
            if (containerRef.current) {
              const target = containerRef.current.querySelector(
                ".mermaid-render-target",
              );
              if (target) {
                target.innerHTML = svg;
                const svgEl = target.querySelector("svg");
                if (svgEl) {
                  await initializePanZoom(svgEl);
                }
              }
            }
            return;
          } catch {
            // Repaired code also fails
          }
        }

        const errMsg =
          parseError instanceof Error
            ? parseError.message
            : "Invalid Mermaid syntax";
        setErrorState({
          hasError: true,
          message: errMsg,
          rawCode: code,
          repairedCode: repaired !== code ? repaired : null,
        });
        return;
      }

      try {
        const { svg } = await mermaid.render(renderId, code);
        if (containerRef.current) {
          const target = containerRef.current.querySelector(
            ".mermaid-render-target",
          );
          if (target) {
            target.innerHTML = svg;
            const svgEl = target.querySelector("svg");
            if (svgEl) {
              await initializePanZoom(svgEl);
            }
          }
        }
        setErrorState({
          hasError: false,
          message: "",
          rawCode: "",
          repairedCode: null,
        });
      } catch (renderError) {
        const errMsg =
          renderError instanceof Error
            ? renderError.message
            : "Failed to render diagram";
        setErrorState({
          hasError: true,
          message: errMsg,
          rawCode: code,
          repairedCode: null,
        });
      }
    },
    [initMermaid, initializePanZoom],
  );

  useEffect(() => {
    setActiveChart(chart);
    setErrorState({
      hasError: false,
      message: "",
      rawCode: "",
      repairedCode: null,
    });
  }, [chart]);

  useEffect(() => {
    void renderDiagram(activeChart);
  }, [activeChart, renderDiagram]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(errorState.rawCode || activeChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = errorState.rawCode || activeChart;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [errorState.rawCode, activeChart]);

  const handleRetryWithFixes = useCallback(() => {
    if (errorState.repairedCode) {
      setActiveChart(errorState.repairedCode);
    }
  }, [errorState.repairedCode]);

  if (errorState.hasError) {
    return (
      <div
        ref={containerRef}
        className="w-full max-w-full p-4"
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                Diagram Rendering Error
              </h3>
              <p className="mt-1 text-sm text-red-600">{errorState.message}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-stone-500">
              Raw Mermaid Code
            </p>
            <pre className="max-h-64 overflow-auto rounded-lg border border-stone-200 bg-stone-900 p-4 text-xs text-stone-100">
              {errorState.rawCode}
            </pre>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCopyCode}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              {copied ? "Copied!" : "Copy Code"}
            </button>

            {errorState.repairedCode && (
              <button
                onClick={handleRetryWithFixes}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
              >
                Retry with fixes
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-full p-4 ${zoomingEnabled ? "h-[75vh]" : ""}`}
    >
      <div
        className={`mermaid-render-target h-full ${
          zoomingEnabled ? "rounded-xl border border-stone-200" : ""
        }`}
      />
      {zoomingEnabled && (
        <p className="mt-2 text-center text-xs text-stone-400">
          Scroll to zoom · Click and drag to pan
        </p>
      )}
    </div>
  );
};

// Error Boundary wrapper
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackChart?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MermaidErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-full p-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-800">
              Something went wrong while rendering the diagram.
            </p>
            <p className="mt-1 text-sm text-red-600">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrapped export with error boundary
const MermaidChartWithBoundary = (props: MermaidChartProps) => (
  <MermaidErrorBoundary>
    <MermaidChart {...props} />
  </MermaidErrorBoundary>
);

export default MermaidChartWithBoundary;
