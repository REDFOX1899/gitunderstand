"use client";

import { useWikiContext } from "./wiki-context";
import { OverviewSection } from "./sections/overview-section";
import { ArchitectureSection } from "./sections/architecture-section";
import { DiagramSectionWiki } from "./sections/diagram-section-wiki";
import { CodeExplorerSection } from "./sections/code-explorer-section";
import { SecuritySection } from "./sections/security-section";
import { GettingStartedSection } from "./sections/getting-started-section";
import { ChatSection } from "./sections/chat-section";

export function WikiContent() {
  const { activeSection } = useWikiContext();

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        {activeSection === "overview" && <OverviewSection />}
        {activeSection === "architecture" && <ArchitectureSection />}
        {activeSection === "diagram" && <DiagramSectionWiki />}
        {activeSection === "code-explorer" && <CodeExplorerSection />}
        {activeSection === "security" && <SecuritySection />}
        {activeSection === "getting-started" && <GettingStartedSection />}
        {activeSection === "chat" && <ChatSection />}
      </div>
    </div>
  );
}
