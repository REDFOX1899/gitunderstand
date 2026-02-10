import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 py-4 lg:px-8">
      <div className="container mx-auto flex h-8 max-w-7xl items-center justify-center">
        <span className="text-sm font-medium text-stone-500">
          Powered by{" "}
          <Link
            href="https://github.com/ahmedkhaleel2004/gitdiagram"
            className="text-cyan-600 hover:underline"
          >
            GitDiagram
          </Link>
          {" "}| Part of{" "}
          <Link
            href="/"
            className="text-cyan-600 hover:underline"
          >
            GitUnderstand
          </Link>
        </span>
      </div>
    </footer>
  );
}
