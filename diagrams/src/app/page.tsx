"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { exampleRepos } from "~/lib/exampleRepos";
import {
  FileText,
  GitBranch,
  MessageCircle,
  FolderTree,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Wiki Docs",
    description:
      "Auto-generated overview, architecture analysis, security audit, and onboarding guide for any repo.",
  },
  {
    icon: GitBranch,
    title: "Interactive Diagrams",
    description:
      "Mermaid architecture diagrams with pan, zoom, and clickable nodes that link to source files.",
  },
  {
    icon: MessageCircle,
    title: "AI Chat",
    description:
      "Ask any question about the codebase. Get answers with context from the full repository analysis.",
  },
  {
    icon: FolderTree,
    title: "Code Explorer",
    description:
      "Browse the file tree and view source code with syntax highlighting — all in one place.",
  },
];

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = repoUrl.trim();
    const githubUrlPattern =
      /^https?:\/\/github\.com\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_.]+)\/?$/;
    const match = githubUrlPattern.exec(trimmed);

    if (!match?.[1] || !match?.[2]) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }

    const username = encodeURIComponent(match[1]);
    const repo = encodeURIComponent(match[2]);
    router.push(`/${username}/${repo}`);
  };

  const handleExampleClick = (path: string) => {
    router.push(path);
  };

  return (
    <main className="flex-grow">
      {/* Hero Section */}
      <section className="px-4 pb-16 pt-16 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            Understand any{" "}
            <span className="text-cyan-600">repository</span>
            <br />
            in seconds
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-500 sm:text-xl">
            AI-powered wiki, architecture diagrams, and chat for any GitHub
            repository. No setup required.
          </p>

          {/* Search Bar */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 max-w-2xl"
          >
            <div className="flex gap-3">
              <Input
                placeholder="https://github.com/username/repo"
                className="flex-1 rounded-lg border-stone-300 px-4 py-6 text-base font-medium placeholder:text-stone-400 focus:ring-2 focus:ring-cyan-500 sm:text-lg"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
              />
              <Button
                type="submit"
                className="rounded-lg bg-cyan-600 px-6 py-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 sm:text-lg"
              >
                Explore
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </form>

          {/* Example Repos */}
          <div className="mt-6">
            <p className="mb-3 text-sm text-stone-400">
              Try an example:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(exampleRepos).map(([name, path]) => (
                <button
                  key={name}
                  onClick={() => handleExampleClick(path)}
                  className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-stone-100 bg-stone-50/50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-cyan-600">
            What you get
          </h2>
          <p className="mb-12 text-center text-2xl font-bold text-stone-900 sm:text-3xl">
            Everything you need to understand a codebase
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border border-stone-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <feature.icon className="mb-4 h-8 w-8 text-cyan-600" />
                <h3 className="mb-2 text-lg font-semibold text-stone-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-stone-500">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
            Better than reading docs
          </h2>
          <p className="mt-3 text-stone-500">
            Stop spending hours reading through unfamiliar codebases. Get an
            AI-generated wiki with architecture diagrams, security audits, and
            an interactive chat — all in seconds.
          </p>
          <Button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                'input[placeholder*="github.com"]',
              );
              input?.focus();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-6 rounded-lg bg-cyan-600 px-8 py-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </main>
  );
}
