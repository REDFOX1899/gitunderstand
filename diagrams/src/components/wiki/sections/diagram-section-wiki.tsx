"use client";

import { useWikiContext } from "../wiki-context";
import { DiagramSection } from "~/components/diagram-section";

export function DiagramSectionWiki() {
  const { username, repo, ingest } = useWikiContext();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Diagram</h1>
      <p className="mb-6 text-sm text-stone-400">
        Interactive architecture diagram with pan, zoom, and clickable nodes
      </p>

      <DiagramSection
        username={username}
        repo={repo}
        ingestContent={ingest.result?.content}
      />
    </div>
  );
}
