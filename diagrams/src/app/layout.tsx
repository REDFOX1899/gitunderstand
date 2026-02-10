import "~/styles/globals.css";

import { type Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { CSPostHogProvider } from "./providers";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "GitUnderstand - Repository Analysis & Diagrams",
  description:
    "Turn any GitHub repository into an LLM-friendly digest and interactive diagram. Analyze code architecture, generate summaries, and chat with AI about any codebase.",
  metadataBase: new URL("https://gitunderstand.com"),
  keywords: [
    "github",
    "repository analysis",
    "code digest",
    "diagram generator",
    "repository visualization",
    "code structure",
    "software architecture",
    "mermaid",
    "interactive diagram",
    "LLM",
    "AI code analysis",
    "gitunderstand",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gitunderstand.com",
    title: "GitUnderstand - Repository Analysis & Diagrams",
    description:
      "Turn any GitHub repository into an LLM-friendly digest and interactive diagram.",
    siteName: "GitUnderstand",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <CSPostHogProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            {children}
            <Footer />
            <Toaster />
          </div>
        </CSPostHogProvider>
      </body>
    </html>
  );
}
