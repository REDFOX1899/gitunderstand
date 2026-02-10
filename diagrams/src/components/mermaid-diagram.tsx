"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidChartProps {
  chart: string;
  zoomingEnabled?: boolean;
}

const MermaidChart = ({ chart, zoomingEnabled = true }: MermaidChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
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

    const initializePanZoom = async () => {
      const svgElement = containerRef.current?.querySelector("svg");
      if (!svgElement) return;

      // Post-process all links to open in new tabs
      const links = svgElement.querySelectorAll("a");
      links.forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      });

      if (zoomingEnabled) {
        // Remove any max-width constraints
        svgElement.style.maxWidth = "none";
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";

        try {
          const svgPanZoom = (await import("svg-pan-zoom")).default;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
    };

    mermaid.contentLoaded();
    // Wait for the SVG to be rendered
    setTimeout(() => {
      void initializePanZoom();
    }, 100);

    return () => {
      // Cleanup not needed with dynamic import approach
    };
  }, [chart, zoomingEnabled]);

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-full p-4 ${zoomingEnabled ? "h-[75vh]" : ""}`}
    >
      <div
        key={`${chart}-${zoomingEnabled}`}
        className={`mermaid h-full ${
          zoomingEnabled ? "rounded-xl border border-stone-200" : ""
        }`}
      >
        {chart}
      </div>
      {zoomingEnabled && (
        <p className="mt-2 text-center text-xs text-stone-400">
          Scroll to zoom · Click and drag to pan
        </p>
      )}
    </div>
  );
};

export default MermaidChart;
