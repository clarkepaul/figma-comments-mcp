import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Repo root is one level up from this test/ directory.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function gitFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

// Secret patterns we never want committed. Kept specific to avoid false positives
// on ordinary code.
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Figma tokens: PAT (figd_), OAuth access (figu_), refresh (figr_), older (figoa_).
  { name: "Figma token", re: /fig(?:d|u|r|oa)_[A-Za-z0-9_-]{20,}/ },
  // A non-empty, quoted literal assigned to FIGMA_TOKEN (hardcoded secret).
  { name: "hardcoded FIGMA_TOKEN literal", re: /FIGMA_TOKEN\s*[:=]\s*['"][^'"\s]+['"]/ },
  // Common foreign secret prefixes.
  { name: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/ },
  { name: "GitHub fine-grained PAT", re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
];

// Only scan files that ship or could carry a leaked secret. The test/ directory is
// skipped because this very file necessarily contains the patterns above.
function shouldScan(path: string): boolean {
  if (path.startsWith("test/")) return false;
  if (path.startsWith("src/")) return true;
  if (path === "README.md" || path === ".env.example") return true;
  return /\.(json|ya?ml|md|toml|env\.example)$/.test(path);
}

describe("no committed secrets", () => {
  const files = gitFiles().filter(shouldScan);

  it("has files to scan (sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no token-shaped strings in tracked source", () => {
    const hits: string[] = [];
    for (const rel of files) {
      let text: string;
      try {
        text = readFileSync(join(repoRoot, rel), "utf8");
      } catch {
        continue; // not a readable text file
      }
      for (const { name, re } of SECRET_PATTERNS) {
        const m = re.exec(text);
        if (m) hits.push(`${rel}: ${name} (matched "${m[0].slice(0, 12)}…")`);
      }
    }
    expect(hits, `Possible secret(s) found:\n${hits.join("\n")}`).toEqual([]);
  });
});

describe("env files are not tracked", () => {
  const tracked = gitFiles();

  it("does not track .env or .env.local", () => {
    const leaked = tracked.filter((f) => /^\.env(\.local)?$/.test(f));
    expect(leaked, `These env files are committed: ${leaked.join(", ")}`).toEqual([]);
  });

  it(".gitignore still ignores .env", () => {
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
  });
});
