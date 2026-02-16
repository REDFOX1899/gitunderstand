"use client";

import { createContext, useContext } from "react";
import type { WikiContextType } from "~/hooks/useWiki";

const WikiContext = createContext<WikiContextType | null>(null);

export function WikiProvider({
  value,
  children,
}: {
  value: WikiContextType;
  children: React.ReactNode;
}) {
  return <WikiContext.Provider value={value}>{children}</WikiContext.Provider>;
}

export function useWikiContext() {
  const ctx = useContext(WikiContext);
  if (!ctx) throw new Error("useWikiContext must be used inside WikiProvider");
  return ctx;
}
