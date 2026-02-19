import { describe, it, expect } from "vitest";
import { parseGitHubUrl, isParseError } from "./github-url";

describe("parseGitHubUrl", () => {
  describe("valid full URLs", () => {
    it("parses https://github.com/user/repo", () => {
      const result = parseGitHubUrl("https://github.com/user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses http://github.com/user/repo", () => {
      const result = parseGitHubUrl("http://github.com/user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses URL with trailing slash", () => {
      const result = parseGitHubUrl("https://github.com/user/repo/");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses URL with www prefix", () => {
      const result = parseGitHubUrl("https://www.github.com/user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("strips .git suffix", () => {
      const result = parseGitHubUrl("https://github.com/user/repo.git");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("ignores subpaths (tree/main/src)", () => {
      const result = parseGitHubUrl("https://github.com/fastapi/fastapi/tree/main/src");
      expect(result).toEqual({ username: "fastapi", repo: "fastapi" });
    });

    it("ignores query params", () => {
      const result = parseGitHubUrl("https://github.com/user/repo?tab=readme");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("ignores fragment", () => {
      const result = parseGitHubUrl("https://github.com/user/repo#readme");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("handles hyphens and dots in names", () => {
      const result = parseGitHubUrl("https://github.com/tom-draper/api-analytics");
      expect(result).toEqual({ username: "tom-draper", repo: "api-analytics" });
    });

    it("handles underscores and dots in repo names", () => {
      const result = parseGitHubUrl("https://github.com/user/my_repo.js");
      expect(result).toEqual({ username: "user", repo: "my_repo.js" });
    });
  });

  describe("no-protocol URLs", () => {
    it("parses github.com/user/repo", () => {
      const result = parseGitHubUrl("github.com/user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses www.github.com/user/repo", () => {
      const result = parseGitHubUrl("www.github.com/user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses github.com/user/repo with subpath", () => {
      const result = parseGitHubUrl("github.com/user/repo/pulls");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });
  });

  describe("shorthand format", () => {
    it("parses user/repo", () => {
      const result = parseGitHubUrl("user/repo");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("parses fastapi/fastapi", () => {
      const result = parseGitHubUrl("fastapi/fastapi");
      expect(result).toEqual({ username: "fastapi", repo: "fastapi" });
    });

    it("parses user/repo with trailing slash", () => {
      const result = parseGitHubUrl("user/repo/");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("strips .git from shorthand", () => {
      const result = parseGitHubUrl("user/repo.git");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });
  });

  describe("whitespace handling", () => {
    it("trims leading/trailing whitespace", () => {
      const result = parseGitHubUrl("  https://github.com/user/repo  ");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });

    it("trims shorthand whitespace", () => {
      const result = parseGitHubUrl("  user/repo  ");
      expect(result).toEqual({ username: "user", repo: "repo" });
    });
  });

  describe("error cases", () => {
    it("rejects empty string", () => {
      const result = parseGitHubUrl("");
      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.error).toBe("Please enter a GitHub repository URL");
      }
    });

    it("rejects whitespace-only string", () => {
      const result = parseGitHubUrl("   ");
      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.error).toBe("Please enter a GitHub repository URL");
      }
    });

    it("rejects GitLab URL", () => {
      const result = parseGitHubUrl("https://gitlab.com/user/repo");
      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.error).toBe("Only GitHub repositories are supported");
      }
    });

    it("rejects Bitbucket URL", () => {
      const result = parseGitHubUrl("https://bitbucket.org/user/repo");
      expect(isParseError(result)).toBe(true);
      if (isParseError(result)) {
        expect(result.error).toBe("Only GitHub repositories are supported");
      }
    });

    it("rejects single word", () => {
      const result = parseGitHubUrl("justarepo");
      expect(isParseError(result)).toBe(true);
    });

    it("rejects bare domain", () => {
      const result = parseGitHubUrl("github.com");
      expect(isParseError(result)).toBe(true);
    });

    it("rejects github.com with only username", () => {
      const result = parseGitHubUrl("https://github.com/user");
      expect(isParseError(result)).toBe(true);
    });

    it("rejects random URL", () => {
      const result = parseGitHubUrl("https://example.com/something");
      expect(isParseError(result)).toBe(true);
    });
  });

  describe("isParseError helper", () => {
    it("returns true for error results", () => {
      expect(isParseError({ error: "test" })).toBe(true);
    });

    it("returns false for success results", () => {
      expect(isParseError({ username: "u", repo: "r" })).toBe(false);
    });
  });
});
