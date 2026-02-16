"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { ChevronRight } from "lucide-react";
import { getStarCount } from "~/app/_actions/github";
import { PrivateReposDialog } from "./private-repos-dialog";
import { ApiKeyDialog } from "./api-key-dialog";
import { safeSetItem } from "~/lib/safe-storage";
import { SignInButton } from "./sign-in-button";

export function Header() {
  const [isPrivateReposDialogOpen, setIsPrivateReposDialogOpen] =
    useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void getStarCount().then(setStarCount);
  }, []);

  const formatStarCount = (count: number | null) => {
    if (count === null) return "";
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const handlePrivateReposSubmit = (pat: string) => {
    safeSetItem("github_pat", pat);
    setIsPrivateReposDialogOpen(false);
  };

  const handleApiKeySubmit = (apiKey: string) => {
    safeSetItem("anthropic_key", apiKey);
    setIsApiKeyDialogOpen(false);
  };

  // Breadcrumb: detect /username/repo wiki pages
  const segments = pathname.split("/").filter(Boolean);
  const isWikiPage =
    segments.length === 2 &&
    !["diagrams", "api", "_next"].includes(segments[0]!);
  const wikiUsername = isWikiPage ? segments[0] : null;
  const wikiRepo = isWikiPage ? segments[1] : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
            <span className="text-lg font-semibold sm:text-xl">
              <span className="text-foreground transition-colors duration-200 hover:text-muted-foreground">
                Git
              </span>
              <span className="text-cyan-600 transition-colors duration-200 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300">
                Understand
              </span>
            </span>
          </Link>

          {/* Breadcrumbs for wiki pages */}
          {isWikiPage && wikiUsername && wikiRepo && (
            <div className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {wikiUsername}
              </span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {wikiRepo}
              </span>
            </div>
          )}
        </div>

        <nav className="flex items-center gap-3 sm:gap-6">
          <span
            onClick={() => setIsApiKeyDialogOpen(true)}
            className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center sm:hidden">
              <span>API Key</span>
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <span>API Key</span>
            </span>
          </span>
          <span
            onClick={() => setIsPrivateReposDialogOpen(true)}
            className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="sm:hidden">Private Repos</span>
            <span className="hidden sm:inline">Private Repos</span>
          </span>
          <Link
            href="https://github.com/REDFOX1899/gitunderstand"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:gap-2"
          >
            <FaGithub className="h-5 w-5" />
            <span className="hidden sm:inline">GitHub</span>
          </Link>
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <span className="text-amber-400">★</span>
            {formatStarCount(starCount)}
          </span>
          <SignInButton />
        </nav>

        <PrivateReposDialog
          isOpen={isPrivateReposDialogOpen}
          onClose={() => setIsPrivateReposDialogOpen(false)}
          onSubmit={handlePrivateReposSubmit}
        />
        <ApiKeyDialog
          isOpen={isApiKeyDialogOpen}
          onClose={() => setIsApiKeyDialogOpen(false)}
          onSubmit={handleApiKeySubmit}
        />
      </div>
    </header>
  );
}
