import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "./markdown";

describe("renderMarkdownToHtml", () => {
  it("renders bold text", () => {
    const result = renderMarkdownToHtml("**bold**");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("renders italic text", () => {
    const result = renderMarkdownToHtml("*italic*");
    expect(result).toContain("<em>italic</em>");
  });

  it("renders bold+italic text", () => {
    const result = renderMarkdownToHtml("***both***");
    expect(result).toContain("<strong><em>both</em></strong>");
  });

  it("renders h1 headers", () => {
    const result = renderMarkdownToHtml("# Header");
    expect(result).toContain("<h1");
    expect(result).toContain("Header");
  });

  it("renders h2 headers", () => {
    const result = renderMarkdownToHtml("## Header 2");
    expect(result).toContain("<h2");
    expect(result).toContain("Header 2");
  });

  it("renders h3 headers", () => {
    const result = renderMarkdownToHtml("### Header 3");
    expect(result).toContain("<h3");
  });

  it("renders h4 headers", () => {
    const result = renderMarkdownToHtml("#### Header 4");
    expect(result).toContain("<h4");
  });

  it("renders inline code", () => {
    const result = renderMarkdownToHtml("use `npm install`");
    expect(result).toContain("<code");
    expect(result).toContain("npm install");
  });

  it("renders code blocks with language", () => {
    const result = renderMarkdownToHtml("```python\nprint('hello')\n```");
    expect(result).toContain("<pre");
    expect(result).toContain("<code");
    expect(result).toContain("python");
    expect(result).toContain("print('hello')");
  });

  it("renders unordered list items", () => {
    const result = renderMarkdownToHtml("- item one\n- item two");
    expect(result).toContain("<li");
    expect(result).toContain("item one");
    expect(result).toContain("item two");
  });

  it("renders ordered list items", () => {
    const result = renderMarkdownToHtml("1. first\n2. second");
    expect(result).toContain("<li");
    expect(result).toContain("first");
    expect(result).toContain("second");
  });

  it("renders horizontal rules", () => {
    const result = renderMarkdownToHtml("---");
    expect(result).toContain("<hr");
  });

  it("escapes HTML entities", () => {
    const result = renderMarkdownToHtml("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("wraps output in paragraph tags", () => {
    const result = renderMarkdownToHtml("Hello world");
    expect(result).toMatch(/^<p.*>.*<\/p>$/);
  });

  it("handles empty input", () => {
    const result = renderMarkdownToHtml("");
    expect(result).toBeDefined();
  });

  it("converts double newlines to paragraph breaks", () => {
    const result = renderMarkdownToHtml("paragraph one\n\nparagraph two");
    expect(result).toContain("</p><p");
  });
});
