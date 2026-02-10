"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";
import { safeGetItem, safeRemoveItem } from "~/lib/safe-storage";

interface ApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => void;
}

export function ApiKeyDialog({ isOpen, onClose, onSubmit }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    const storedKey = safeGetItem("anthropic_key");
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(apiKey);
    setApiKey("");
  };

  const handleClear = () => {
    safeRemoveItem("anthropic_key");
    setApiKey("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-stone-200 bg-white p-6 shadow-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-stone-900">
            Enter Anthropic API Key
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-stone-600">
            GitDiagram offers infinite free diagram generations! You can also
            provide an Anthropic API key to generate diagrams at your own cost.
            The key will be stored locally in your browser.
            <br />
            <br />
            <span className="font-medium">Get your Anthropic API key </span>
            <Link
              href="https://console.anthropic.com/settings/keys"
              className="font-medium text-cyan-600 transition-colors duration-200 hover:text-cyan-700"
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
                Your API key will be stored locally in your browser and used
                only for generating diagrams. You can also self-host this app by
                following the instructions in the{" "}
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
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-base font-bold placeholder:text-base placeholder:font-normal placeholder:text-stone-400 focus:ring-2 focus:ring-cyan-500"
            required
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
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
                disabled={!apiKey.startsWith("sk-ant-")}
                className="bg-cyan-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
              >
                Save Key
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
