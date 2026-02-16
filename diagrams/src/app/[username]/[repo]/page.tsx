"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWiki } from "~/hooks/useWiki";
import { useKeyboardShortcuts } from "~/hooks/useKeyboardShortcuts";
import { WikiProvider } from "~/components/wiki/wiki-context";
import { WikiSidebar } from "~/components/wiki/wiki-sidebar";
import { WikiContent } from "~/components/wiki/wiki-content";
import { FloatingChat } from "~/components/wiki/floating-chat";

export default function WikiRepoPage() {
  const params = useParams<{ username: string; repo: string }>();
  const username = decodeURIComponent(params.username).toLowerCase();
  const repo = decodeURIComponent(params.repo).toLowerCase();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const wiki = useWiki(username, repo);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  useKeyboardShortcuts({
    setActiveSection: wiki.setActiveSection,
    onToggleSidebar: toggleSidebar,
  });

  return (
    <WikiProvider value={wiki}>
      <WikiSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-y-auto">
        <WikiContent />
      </main>
      <FloatingChat />
    </WikiProvider>
  );
}
