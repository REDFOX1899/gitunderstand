import { type Metadata } from "next";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { CSPostHogProvider } from "../providers";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "GitHubUnderstand - Diagrams",
  description:
    "Turn any GitHub repository into an interactive diagram for visualization in seconds.",
  metadataBase: new URL("https://githubunderstand.com"),
  keywords: [
    "github",
    "diagram",
    "diagram generator",
    "repository visualization",
    "code structure",
    "system design",
    "software architecture",
    "mermaid",
    "interactive diagram",
    "open source",
    "githubunderstand",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://githubunderstand.com/diagrams",
    title: "GitHubUnderstand - Repository to Diagram in Seconds",
    description:
      "Turn any GitHub repository into an interactive diagram for visualization.",
    siteName: "GitHubUnderstand",
    images: [
      {
        url: "/diagrams/og-image.png",
        width: 1200,
        height: 630,
        alt: "GitHubUnderstand Diagrams - Repository Visualization Tool",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
    },
  },
};

export default function DiagramsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <CSPostHogProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
        <Toaster />
      </div>
    </CSPostHogProvider>
  );
}
