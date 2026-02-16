"use client";

import {
  FileText,
  Layers,
  GitBranch,
  FolderTree,
  Shield,
  Rocket,
  MessageCircle,
  Loader2,
  Menu,
  X,
  Moon,
  Sun,
  ChevronsLeft,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useWikiContext } from "./wiki-context";
import type { WikiSection } from "~/lib/wiki-types";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Layers,
  GitBranch,
  FolderTree,
  Shield,
  Rocket,
  MessageCircle,
};

const SECTIONS: { id: WikiSection; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "FileText" },
  { id: "architecture", label: "Architecture", icon: "Layers" },
  { id: "diagram", label: "Diagram", icon: "GitBranch" },
  { id: "code-explorer", label: "Code Explorer", icon: "FolderTree" },
  { id: "security", label: "Security", icon: "Shield" },
  { id: "getting-started", label: "Getting Started", icon: "Rocket" },
];

interface WikiSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function WikiSidebar({ collapsed = false, onToggle }: WikiSidebarProps) {
  const { activeSection, setActiveSection, ingest, username, repo } =
    useWikiContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const isSectionReady = (section: WikiSection): boolean => {
    switch (section) {
      case "overview":
      case "architecture":
      case "code-explorer":
      case "security":
      case "getting-started":
        return !!ingest.result;
      case "diagram":
        return true;
      case "chat":
        return true;
      default:
        return false;
    }
  };

  const handleClick = (section: WikiSection) => {
    setActiveSection(section);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Repo header */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-foreground">
            {username}/{repo}
          </p>
          {onToggle && (
            <button
              onClick={onToggle}
              className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:inline-flex"
              title="Collapse sidebar ( [ )"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {ingest.loading && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{ingest.progress.label}</span>
          </div>
        )}
        {ingest.result && !ingest.loading && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">Analysis complete</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {SECTIONS.map((section) => {
          const Icon = ICON_MAP[section.icon] ?? FileText;
          const active = activeSection === section.id;
          const ready = isSectionReady(section.id);

          return (
            <button
              key={section.id}
              onClick={() => handleClick(section.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-l-2 border-cyan-600 bg-accent text-accent-foreground"
                  : "border-l-2 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left">{section.label}</span>
              {!ready && ingest.loading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Chat — bottom section */}
      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => handleClick("chat")}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            activeSection === "chat"
              ? "border-l-2 border-cyan-600 bg-accent text-accent-foreground"
              : "border-l-2 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <MessageCircle
            className={`h-4 w-4 ${activeSection === "chat" ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"}`}
          />
          <span>Chat</span>
        </button>
      </div>

      {/* Dark mode toggle */}
      <div className="border-t border-border px-3 py-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-3 top-[72px] z-50 rounded-md border border-border bg-background p-2 shadow-sm md:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] flex-col border-r border-border bg-background transition-all md:relative md:top-0 md:translate-x-0 ${
          collapsed ? "md:w-0 md:overflow-hidden md:border-r-0" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
