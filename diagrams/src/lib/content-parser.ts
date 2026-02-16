const SEPARATOR = "================================================";

export interface ContentBlock {
  path: string;
  content: string;
}

/**
 * Parse file content blocks from the ingest digest output.
 *
 * The format per file block is:
 *   SEPARATOR
 *   TYPE: path
 *   SEPARATOR
 *   <content>
 *
 * Where TYPE is FILE, DIRECTORY, or SYMLINK.
 */
export function parseContentBlocks(content: string): ContentBlock[] {
  if (!content) return [];
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    // Look for a separator line
    if (lines[i]!.trim() === SEPARATOR) {
      // Next line should be the file path (e.g., "FILE: src/main.py")
      const pathLine = lines[i + 1]?.trim() ?? "";
      let filePath: string | null = null;

      if (
        pathLine.startsWith("FILE:") ||
        pathLine.startsWith("DIRECTORY:") ||
        pathLine.startsWith("SYMLINK:")
      ) {
        filePath = pathLine.split(":").slice(1).join(":").trim();
      }

      if (filePath) {
        // Skip past: separator, path line, separator
        i += 2;
        // The next line should be another separator
        if (i < lines.length && lines[i]!.trim() === SEPARATOR) {
          i += 1;
        }

        // Collect content lines until the next separator (or end)
        const contentLines: string[] = [];
        while (i < lines.length && lines[i]!.trim() !== SEPARATOR) {
          contentLines.push(lines[i]!);
          i++;
        }

        const fileContent = contentLines.join("\n").trim();
        if (fileContent) {
          blocks.push({ path: filePath, content: fileContent });
        }
        // Don't increment i — the while loop will pick up the next separator
        continue;
      }
    }

    i++;
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
