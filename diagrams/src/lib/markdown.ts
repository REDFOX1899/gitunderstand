export function renderMarkdownToHtml(markdown: string): string {
  const html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang: string, code: string) => {
        const langLabel = lang
          ? `<span class="absolute top-2 right-12 text-[10px] text-stone-400 font-mono uppercase">${lang}</span>`
          : "";
        return `<div class="relative my-3">${langLabel}<pre class="bg-stone-900 text-stone-100 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed"><code>${code}</code></pre></div>`;
      },
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-stone-200 px-1 rounded text-xs font-mono">$1</code>',
    )
    // Headers
    .replace(
      /^#### (.+)$/gm,
      '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="font-bold text-base mt-4 mb-1">$1</h3>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>',
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>',
    )
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="ml-8">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // HR
    .replace(/^---$/gm, '<hr class="my-3 border-stone-300">')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, "<br>");

  return `<p class="my-2">${html}</p>`;
}
