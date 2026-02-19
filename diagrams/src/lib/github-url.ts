type ParseSuccess = { username: string; repo: string };
type ParseError = { error: string };
export type ParseResult = ParseSuccess | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return "error" in result;
}

/**
 * Parse a GitHub repository from various input formats.
 *
 * Supports:
 *  - Full URL: https://github.com/user/repo
 *  - No protocol: github.com/user/repo
 *  - Shorthand: user/repo
 *  - With subpaths: https://github.com/user/repo/tree/main/src
 *  - With .git suffix: https://github.com/user/repo.git
 *  - With trailing slash, query params, fragments
 */
export function parseGitHubUrl(input: string): ParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { error: "Please enter a GitHub repository URL" };
  }

  // Check for non-GitHub hosted URLs
  const nonGithubHosts = ["gitlab.com", "bitbucket.org", "codeberg.org", "sr.ht"];
  for (const host of nonGithubHosts) {
    if (trimmed.includes(host)) {
      return { error: "Only GitHub repositories are supported" };
    }
  }

  // Try to extract user/repo from various formats
  let pathPart: string | null = null;

  // Format 1: Full URL — https://github.com/user/repo[/...]
  const fullUrlMatch = /^https?:\/\/(?:www\.)?github\.com\/([^?#]+)/i.exec(trimmed);
  if (fullUrlMatch?.[1]) {
    pathPart = fullUrlMatch[1];
  }

  // Format 2: No protocol — github.com/user/repo[/...]
  if (!pathPart) {
    const noProtocolMatch = /^(?:www\.)?github\.com\/([^?#]+)/i.exec(trimmed);
    if (noProtocolMatch?.[1]) {
      pathPart = noProtocolMatch[1];
    }
  }

  // Format 3: Shorthand — user/repo (must be exactly two path segments with valid chars)
  if (!pathPart) {
    const shorthandMatch = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/.exec(trimmed);
    if (shorthandMatch?.[1] && shorthandMatch?.[2]) {
      return {
        username: shorthandMatch[1],
        repo: shorthandMatch[2].replace(/\.git$/, ""),
      };
    }
  }

  // Extract user/repo from the path portion
  if (pathPart) {
    // Remove trailing slash
    pathPart = pathPart.replace(/\/+$/, "");

    // Split and take first two segments
    const segments = pathPart.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] && segments[1]) {
      const username = segments[0];
      const repo = segments[1].replace(/\.git$/, "");

      // Validate characters
      if (/^[a-zA-Z0-9_.-]+$/.test(username) && /^[a-zA-Z0-9_.-]+$/.test(repo)) {
        return { username, repo };
      }
    }
  }

  return {
    error: "Please enter a valid GitHub URL (e.g., https://github.com/user/repo) or shorthand (user/repo)",
  };
}
