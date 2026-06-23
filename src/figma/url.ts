// Parse a Figma file key (and optional node-id) from a URL or bare key.

export interface ParsedFigmaRef {
  fileKey: string;
  /** Normalized node id (e.g. "1:360") if present in the URL, else undefined. */
  nodeId?: string;
}

const URL_KEY_RE = /figma\.com\/(?:design|file|board|proto)\/([A-Za-z0-9]+)/i;
const BARE_KEY_RE = /^[A-Za-z0-9]{8,}$/;

/** Figma URLs encode node ids as "1-360"; the REST API expects "1:360". */
export function normalizeNodeId(raw: string): string {
  return raw.trim().replace(/-/g, ":");
}

function extractNodeId(input: string): string | undefined {
  const match = input.match(/[?&]node-id=([^&]+)/i);
  if (!match) return undefined;
  return normalizeNodeId(decodeURIComponent(match[1]));
}

/**
 * Accepts a full Figma URL or a bare file key and returns the file key plus any
 * node-id found in the URL. Throws a clear error if no key can be found.
 */
export function parseFigmaRef(input: string): ParsedFigmaRef {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(URL_KEY_RE);
  if (urlMatch) {
    return { fileKey: urlMatch[1], nodeId: extractNodeId(trimmed) };
  }

  if (BARE_KEY_RE.test(trimmed)) {
    return { fileKey: trimmed };
  }

  throw new Error(
    `Could not extract a Figma file key from "${input}". ` +
      `Provide a full Figma URL (https://www.figma.com/design/<KEY>/...) or a bare file key.`,
  );
}

/** Convenience: just the file key. */
export function parseFileKey(input: string): string {
  return parseFigmaRef(input).fileKey;
}
