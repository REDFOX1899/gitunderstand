"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { safeGetItem, safeRemoveItem } from "~/lib/safe-storage";
import {
  saveGithubPat,
  getGithubPat,
  clearGithubPat,
} from "~/app/_actions/user";

interface PrivateReposDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pat: string) => void;
}

export function PrivateReposDialog({
  isOpen,
  onClose,
  onSubmit,
}: PrivateReposDialogProps) {
  const [pat, setPat] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    if (!isOpen) return;

    if (isLoggedIn) {
      void getGithubPat().then((key) => {
        if (key) setPat(key);
      });
    } else {
      const storedPat = safeGetItem("github_pat");
      if (storedPat) {
        setPat(storedPat);
      }
    }
  }, [isOpen, isLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isLoggedIn) {
        const result = await saveGithubPat(pat);
        if (!result.success) {
          console.error("Failed to save PAT:", result.error);
          return;
        }
      }
      onSubmit(pat);
      setPat("");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (isLoggedIn) {
      await clearGithubPat();
    }
    safeRemoveItem("github_pat");
    setPat("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-stone-200 bg-white p-6 shadow-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Enter GitHub Personal Access Token
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="text-sm text-stone-600">
            To enable private repositories, you&apos;ll need to provide a GitHub
            Personal Access Token with repo scope.{" "}
            {isLoggedIn ? (
              <>
                The token will be{" "}
                <span className="font-medium text-cyan-700">
                  encrypted and stored securely in your account
                </span>
                .
              </>
            ) : (
              <>The token will be stored locally in your browser.</>
            )}{" "}
            Find out how{" "}
            <Link
              href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
              className="text-cyan-600 transition-colors duration-200 hover:text-cyan-700"
            >
              here
            </Link>
            .
          </div>
          <details className="group text-sm [&>summary:focus-visible]:outline-none">
            <summary className="cursor-pointer font-medium text-cyan-700 hover:text-cyan-600">
              Data storage disclaimer
            </summary>
            <div className="animate-accordion-down mt-2 space-y-2 overflow-hidden pl-2">
              <p className="text-stone-600">
                {isLoggedIn
                  ? "Your token is encrypted with AES-256-GCM before being stored in the database. Only you can access it through your authenticated session."
                  : "Take note that the diagram data will be stored in my database (not that I would use it for anything anyways)."}{" "}
                You can also self-host this app by following the instructions in
                the{" "}
                <Link
                  href="https://github.com/REDFOX1899/gitunderstand"
                  className="text-cyan-600 transition-colors duration-200 hover:text-cyan-700"
                >
                  README
                </Link>
                .
              </p>
            </div>
          </details>
          <Input
            type="password"
            placeholder="ghp_..."
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-base font-bold placeholder:text-base placeholder:font-normal placeholder:text-stone-400 focus:ring-2 focus:ring-cyan-500"
            required
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => void handleClear()}
              className="text-sm text-cyan-600 hover:text-cyan-700"
            >
              Clear
            </button>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                className="border border-stone-300 bg-stone-100 px-4 py-2 text-stone-700 shadow-sm transition-colors hover:bg-stone-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!pat.startsWith("ghp_") || saving}
                className="bg-cyan-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Token"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
