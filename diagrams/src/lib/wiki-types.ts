export type WikiSection =
  | "overview"
  | "architecture"
  | "diagram"
  | "code-explorer"
  | "security"
  | "getting-started"
  | "chat";

export interface SummaryState {
  content: string | null;
  loading: boolean;
  error: string | null;
}

export const WIKI_SECTIONS: {
  id: WikiSection;
  label: string;
  icon: string;
  summaryType?: string;
}[] = [
  { id: "overview", label: "Overview", icon: "FileText", summaryType: "architecture" },
  { id: "architecture", label: "Architecture", icon: "Layers" },
  { id: "diagram", label: "Diagram", icon: "GitBranch" },
  { id: "code-explorer", label: "Code Explorer", icon: "FolderTree" },
  { id: "security", label: "Security", icon: "Shield", summaryType: "security" },
  { id: "getting-started", label: "Getting Started", icon: "Rocket", summaryType: "onboarding" },
  { id: "chat", label: "Chat", icon: "MessageCircle" },
];
