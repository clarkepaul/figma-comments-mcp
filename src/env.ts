import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Load KEY=VALUE pairs from a `.env` at the package root into process.env,
 * without overriding variables that are already set (explicit env wins).
 * Silently does nothing if the file is absent. Keeps the Figma token in a
 * local, gitignored file instead of the MCP registration config.
 */
export function loadDotenv(): void {
  // This module lives in dist/ at runtime; the .env sits one level up.
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env");

  let text: string;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
