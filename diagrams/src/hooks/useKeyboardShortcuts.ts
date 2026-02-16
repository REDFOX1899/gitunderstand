"use client";

import { useEffect } from "react";
import type { WikiSection } from "~/lib/wiki-types";

const SECTION_KEYS: Record<string, WikiSection> = {
  "1": "overview",
  "2": "architecture",
  "3": "diagram",
  "4": "code-explorer",
  "5": "security",
  "6": "getting-started",
  "7": "chat",
};

interface UseKeyboardShortcutsOptions {
  setActiveSection: (section: WikiSection) => void;
  onToggleSidebar?: () => void;
  onFocusChat?: () => void;
}

export function useKeyboardShortcuts({
  setActiveSection,
  onToggleSidebar,
  onFocusChat,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;

      // Don't intercept when user is typing in an input/textarea/contenteditable
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd/Ctrl+K → open/focus chat
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (onFocusChat) {
          onFocusChat();
        } else {
          setActiveSection("chat");
        }
        return;
      }

      // Don't process other shortcuts if modifier keys are held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Number keys 1-7 → switch sections
      const section = SECTION_KEYS[e.key];
      if (section) {
        e.preventDefault();
        setActiveSection(section);
        return;
      }

      // [ → toggle sidebar
      if (e.key === "[") {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // / → focus file search (switch to code explorer)
      if (e.key === "/") {
        e.preventDefault();
        setActiveSection("code-explorer");
        // Focus the search input after a tick
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>(
            '[data-file-search]'
          );
          searchInput?.focus();
        }, 100);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveSection, onToggleSidebar, onFocusChat]);
}
