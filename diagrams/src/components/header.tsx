"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { getStarCount } from "~/app/_actions/github";
import { PrivateReposDialog } from "./private-repos-dialog";
import { ApiKeyDialog } from "./api-key-dialog";

export function Header() {
  const [isPrivateReposDialogOpen, setIsPrivateReposDialogOpen] =
    useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);

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
    localStorage.setItem("github_pat", pat);
    setIsPrivateReposDialogOpen(false);
  };

  const handleApiKeySubmit = (apiKey: string) => {
    localStorage.setItem("anthropic_key", apiKey);
    setIsApiKeyDialogOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-8">
        <Link href="/diagrams" className="flex items-center">
          <span className="text-lg font-semibold sm:text-xl">
            <span className="text-stone-900 transition-colors duration-200 hover:text-stone-600">
              Git
            </span>
            <span className="text-cyan-600 transition-colors duration-200 hover:text-cyan-500">
              Understand
            </span>
            <span className="ml-1 text-sm text-stone-400">Diagrams</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            Digest
          </Link>
          <span
            onClick={() => setIsApiKeyDialogOpen(true)}
            className="cursor-pointer text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
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
            className="cursor-pointer text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            <span className="sm:hidden">Private Repos</span>
            <span className="hidden sm:inline">Private Repos</span>
          </span>
          <Link
            href="https://github.com/REDFOX1899/gitunderstand"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 sm:gap-2"
          >
            <FaGithub className="h-5 w-5" />
            <span className="hidden sm:inline">GitHub</span>
          </Link>
          <span className="flex items-center gap-1 text-sm font-medium text-stone-600">
            <span className="text-amber-400">★</span>
            {formatStarCount(starCount)}
          </span>
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
