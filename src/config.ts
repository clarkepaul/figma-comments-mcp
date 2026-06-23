// Environment-based configuration.

export interface Config {
  token: string;
  enableWrites: boolean;
  treeTtlMs: number;
  /** Max node-tree depth to fetch for enrichment. Bounds the file payload so
   * large files don't drop the connection mid-download. 0 = unbounded. */
  treeDepth: number;
}

export class ConfigError extends Error {}

/**
 * Read and validate configuration from the environment.
 * Throws ConfigError if FIGMA_TOKEN is missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.FIGMA_TOKEN?.trim();
  if (!token) {
    throw new ConfigError(
      "FIGMA_TOKEN is not set. Create a Personal Access Token in Figma " +
        "(Settings -> Security -> Personal access tokens) with scopes " +
        "file_comments:read and file_content:read, then set FIGMA_TOKEN.",
    );
  }

  const enableWrites = /^(1|true|yes)$/i.test(env.FIGMA_ENABLE_WRITES?.trim() ?? "");

  let treeTtlMs = 60_000;
  const ttlRaw = env.FIGMA_TREE_TTL_MS?.trim();
  if (ttlRaw) {
    const parsed = Number(ttlRaw);
    if (Number.isFinite(parsed) && parsed >= 0) treeTtlMs = parsed;
  }

  let treeDepth = 4;
  const depthRaw = env.FIGMA_TREE_DEPTH?.trim();
  if (depthRaw) {
    const parsed = Number(depthRaw);
    if (Number.isInteger(parsed) && parsed >= 0) treeDepth = parsed;
  }

  return { token, enableWrites, treeTtlMs, treeDepth };
}
