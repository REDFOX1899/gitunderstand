const SEPARATOR = "================================================";

export interface ContentBlock {
  path: string;
  content: string;
}

export function parseContentBlocks(content: string): ContentBlock[] {
  if (!content) return [];
  const blocks: ContentBlock[] = [];
  const parts = content.split(SEPARATOR);

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    let filePath: string | null = null;
    let contentStart = 0;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j]!.trim();
      if (
        line.startsWith("FILE:") ||
        line.startsWith("DIRECTORY:") ||
        line.startsWith("SYMLINK:")
      ) {
        filePath = line.split(":").slice(1).join(":").trim();
        contentStart = j + 1;
        break;
      }
    }

    if (filePath) {
      const fileContent = lines.slice(contentStart).join("\n").trim();
      if (fileContent) {
        blocks.push({ path: filePath, content: fileContent });
      }
    }
  }

  return blocks;
}

export function findFileContent(
  content: string,
  filePath: string,
): string | null {
  if (!content || !filePath) return null;
  const blocks = parseContentBlocks(content);
  const block = blocks.find(
    (b) => b.path === filePath || b.path.endsWith(filePath),
  );
  return block?.content ?? null;
}
