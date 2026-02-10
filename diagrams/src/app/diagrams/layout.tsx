import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "GitUnderstand - Diagrams",
  description:
    "Turn any GitHub repository into an interactive diagram for visualization in seconds.",
};

export default function DiagramsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
