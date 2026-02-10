"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import type { IngestFormData } from "~/hooks/useIngest";
import { safeGetItem } from "~/lib/safe-storage";

const PRESETS: Record<
  string,
  {
    label: string;
    pattern_type: "exclude" | "include";
    pattern: string;
  }
> = {
  "code-review": {
    label: "Code Review",
    pattern_type: "include",
    pattern:
      "*.py, *.js, *.ts, *.tsx, *.jsx, *.go, *.rs, *.java, *.cpp, *.c, *.h, *.cs, *.swift, *.kt, *.rb, *.php",
  },
  documentation: {
    label: "Documentation",
    pattern_type: "include",
    pattern: "*.md, *.rst, *.txt, *.doc, README*",
  },
  architecture: {
    label: "Architecture",
    pattern_type: "exclude",
    pattern:
      "*test*, *spec*, *__pycache__*, *.png, *.jpg, *.svg, *.gif, *.ico, node_modules/, dist/, build/",
  },
  "full-digest": {
    label: "Full Digest",
    pattern_type: "exclude",
    pattern: "",
  },
};

const EXAMPLE_REPOS = [
  { name: "FastAPI", url: "https://github.com/fastapi/fastapi" },
  { name: "Flask", url: "https://github.com/pallets/flask" },
  { name: "Streamlit", url: "https://github.com/streamlit/streamlit" },
  { name: "Monkeytype", url: "https://github.com/monkeytypegame/monkeytype" },
];

function logSliderToSize(position: number): number {
  const maxPosition = 500;
  const maxValue = Math.log(102400); // 100 MB
  const value = Math.exp(maxValue * (position / maxPosition) ** 1.5);
  return Math.round(value);
}

function formatSize(sizeInKB: number): string {
  if (sizeInKB >= 1024) {
    return `${Math.round(sizeInKB / 1024)}MB`;
  }
  return `${Math.round(sizeInKB)}kB`;
}

interface IngestFormProps {
  onSubmit: (data: IngestFormData) => void;
  loading?: boolean;
}

export function IngestForm({ onSubmit, loading }: IngestFormProps) {
  const [url, setUrl] = useState("");
  const [patternType, setPatternType] = useState<"exclude" | "include">(
    "exclude",
  );
  const [pattern, setPattern] = useState("");
  const [sliderValue, setSliderValue] = useState(250);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const patternRef = useRef<HTMLInputElement>(null);

  const handlePreset = useCallback(
    (presetName: string) => {
      if (activePreset === presetName) {
        const fd = PRESETS["full-digest"]!;
        setPatternType(fd.pattern_type);
        setPattern(fd.pattern);
        setActivePreset(null);
        return;
      }
      const preset = PRESETS[presetName];
      if (!preset) return;
      setPatternType(preset.pattern_type);
      setPattern(preset.pattern);
      setActivePreset(presetName);
    },
    [activePreset],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormError("");

      const trimmed = url.trim();
      if (!trimmed) {
        setFormError("Please enter a repository URL.");
        return;
      }

      const pat =
        typeof window !== "undefined"
          ? safeGetItem("github_pat") ?? undefined
          : undefined;

      onSubmit({
        input_text: trimmed,
        pattern_type: patternType,
        pattern,
        max_file_size: logSliderToSize(sliderValue),
        output_format: "markdown",
        target_model: "",
        token: pat,
      });
    },
    [url, patternType, pattern, sliderValue, onSubmit],
  );

  const handleExampleClick = useCallback((repoUrl: string) => {
    setUrl(repoUrl);
  }, []);

  const fileSizeDisplay = formatSize(logSliderToSize(sliderValue));

  return (
    <Card className="border border-stone-200 bg-white p-4 shadow-lg sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL input + submit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Input
            placeholder="https://github.com/username/repo"
            className="flex-1 rounded-md border border-stone-300 px-3 py-4 text-base font-bold placeholder:text-base placeholder:font-normal placeholder:text-stone-400 focus:ring-2 focus:ring-cyan-500 sm:px-4 sm:py-6 sm:text-lg sm:placeholder:text-lg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading}
            className="rounded-md bg-cyan-600 p-4 px-4 text-base text-white shadow-sm transition-colors hover:bg-cyan-700 sm:p-6 sm:px-6 sm:text-lg"
          >
            {loading ? "Processing..." : "Ingest"}
          </Button>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        {/* Preset buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                activePreset === key
                  ? "border-cyan-500 bg-cyan-600 text-white"
                  : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Options (always visible) */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
          {/* Pattern type + pattern */}
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-stone-600">
              File Pattern
            </label>
            <div className="flex gap-2">
              <select
                value={patternType}
                onChange={(e) =>
                  setPatternType(e.target.value as "exclude" | "include")
                }
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              <input
                ref={patternRef}
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                  setActivePreset(null);
                }}
                placeholder="*.py, *.js, node_modules/"
                className="flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700 placeholder:text-stone-400"
              />
            </div>
          </div>

          {/* File size slider */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Max File Size:{" "}
              <span className="font-bold text-cyan-600">
                {fileSizeDisplay}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={500}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full accent-cyan-600"
            />
          </div>
        </div>

        {/* Example repos */}
        <div className="space-y-1">
          <div className="text-sm text-stone-500">Try an example:</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_REPOS.map((repo) => (
              <Button
                key={repo.name}
                type="button"
                variant="outline"
                size="sm"
                className="border border-cyan-200 bg-cyan-50 text-sm text-cyan-700 transition-colors hover:bg-cyan-100"
                onClick={() => handleExampleClick(repo.url)}
              >
                {repo.name}
              </Button>
            ))}
          </div>
        </div>
      </form>
    </Card>
  );
}
