"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Sparkles } from "lucide-react";
import React from "react";
import { CustomizationDropdown } from "./customization-dropdown";
import { exampleRepos } from "~/lib/exampleRepos";
import { ExportDropdown } from "./export-dropdown";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Switch } from "~/components/ui/switch";

interface MainCardProps {
  isHome?: boolean;
  username?: string;
  repo?: string;
  showCustomization?: boolean;
  onModify?: (instructions: string) => void;
  onRegenerate?: (instructions: string) => void;
  onCopy?: () => void;
  lastGenerated?: Date;
  onExportImage?: () => void;
  zoomingEnabled?: boolean;
  onZoomToggle?: () => void;
  loading?: boolean;
}

export default function MainCard({
  isHome = true,
  username,
  repo,
  showCustomization,
  onModify,
  onRegenerate,
  onCopy,
  lastGenerated,
  onExportImage,
  zoomingEnabled,
  onZoomToggle,
  loading,
}: MainCardProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<
    "customize" | "export" | null
  >(null);
  const router = useRouter();

  useEffect(() => {
    if (username && repo) {
      setRepoUrl(`https://github.com/${username}/${repo}`);
    }
  }, [username, repo]);

  useEffect(() => {
    if (loading) {
      setActiveDropdown(null);
    }
  }, [loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const githubUrlPattern =
      /^https?:\/\/github\.com\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_\.]+)\/?$/;
    const match = githubUrlPattern.exec(repoUrl.trim());

    if (!match) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }

    const [, username, repo] = match || [];
    if (!username || !repo) {
      setError("Invalid repository URL format");
      return;
    }
    const sanitizedUsername = encodeURIComponent(username);
    const sanitizedRepo = encodeURIComponent(repo);
    router.push(`/diagrams/${sanitizedUsername}/${sanitizedRepo}`);
  };

  const handleExampleClick = (repoPath: string, e: React.MouseEvent) => {
    e.preventDefault();
    router.push(repoPath);
  };

  const handleDropdownToggle = (dropdown: "customize" | "export") => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  return (
    <Card className="relative w-full max-w-3xl border border-stone-200 bg-white p-4 shadow-lg sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Input
            placeholder="https://github.com/username/repo"
            className="flex-1 rounded-md border border-stone-300 px-3 py-4 text-base font-bold placeholder:text-base placeholder:font-normal placeholder:text-stone-400 focus:ring-2 focus:ring-cyan-500 sm:px-4 sm:py-6 sm:text-lg sm:placeholder:text-lg"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            required
          />
          <Button
            type="submit"
            className="rounded-md bg-cyan-600 p-4 px-4 text-base text-white shadow-sm transition-colors hover:bg-cyan-700 sm:p-6 sm:px-6 sm:text-lg"
          >
            Diagram
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Dropdowns Container */}
        {!isHome && (
          <div className="space-y-4">
            {/* Only show buttons and dropdowns when not loading */}
            {!loading && (
              <>
                {/* Buttons Container */}
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-4">
                  {showCustomization &&
                    onModify &&
                    onRegenerate &&
                    lastGenerated && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDropdownToggle("customize");
                        }}
                        className={`flex items-center justify-between gap-2 rounded-md border border-stone-300 px-4 py-2 font-medium text-stone-700 transition-colors sm:max-w-[250px] ${
                          activeDropdown === "customize"
                            ? "bg-stone-200"
                            : "bg-stone-100 hover:bg-stone-200"
                        }`}
                      >
                        <span>Customize Diagram</span>
                        {activeDropdown === "customize" ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    )}

                  {onCopy && lastGenerated && onExportImage && (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDropdownToggle("export");
                        }}
                        className={`flex items-center justify-between gap-2 rounded-md border border-stone-300 px-4 py-2 font-medium text-stone-700 transition-colors sm:max-w-[250px] ${
                          activeDropdown === "export"
                            ? "bg-stone-200"
                            : "bg-stone-100 hover:bg-stone-200"
                        }`}
                      >
                        <span>Export Diagram</span>
                        {activeDropdown === "export" ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>
                  )}
                  {lastGenerated && (
                    <>
                      <label className="font-medium text-stone-700">
                        Enable Zoom
                      </label>
                      <Switch
                        checked={zoomingEnabled}
                        onCheckedChange={onZoomToggle}
                      />
                    </>
                  )}
                </div>

                {/* Dropdown Content */}
                <div
                  className={`transition-all duration-200 ${
                    activeDropdown
                      ? "pointer-events-auto max-h-[500px] opacity-100"
                      : "pointer-events-none max-h-0 opacity-0"
                  }`}
                >
                  {activeDropdown === "customize" && (
                    <CustomizationDropdown
                      onModify={onModify!}
                      onRegenerate={onRegenerate!}
                      lastGenerated={lastGenerated!}
                      isOpen={true}
                    />
                  )}
                  {activeDropdown === "export" && (
                    <ExportDropdown
                      onCopy={onCopy!}
                      lastGenerated={lastGenerated!}
                      onExportImage={onExportImage!}
                      isOpen={true}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Example Repositories */}
        {isHome && (
          <div className="space-y-2">
            <div className="text-sm text-stone-500 sm:text-base">
              Try these example repositories:
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(exampleRepos).map(([name, path]) => (
                <Button
                  key={name}
                  variant="outline"
                  className="border border-cyan-200 bg-cyan-50 text-sm text-cyan-700 transition-colors hover:bg-cyan-100 sm:text-base"
                  onClick={(e) => handleExampleClick(path, e)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Decorative Sparkle */}
      <div className="absolute -bottom-8 -left-12 hidden sm:block">
        <Sparkles
          className="h-20 w-20 fill-cyan-500 text-stone-400"
          strokeWidth={0.6}
          style={{ transform: "rotate(-15deg)" }}
        />
      </div>
    </Card>
  );
}
