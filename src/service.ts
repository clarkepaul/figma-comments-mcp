import type { Config } from "./config.js";
import { FigmaClient } from "./figma/client.js";
import { TreeCache } from "./figma/tree.js";
import { resolveTarget, type TargetNode } from "./figma/enrich.js";
import { buildThreads, isResolved, type Thread } from "./figma/threads.js";
import { parseFigmaRef } from "./figma/url.js";
import type { Comment } from "./figma/types.js";
import type { EnrichedThread } from "./format.js";

/**
 * High-level operations shared by the MCP tools and the CLI. Owns the Figma
 * client and the file-tree cache so enrichment fetches the tree at most once
 * per TTL window.
 */
export class CommentsService {
  readonly client: FigmaClient;
  private readonly tree: TreeCache;

  constructor(
    readonly config: Config,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.client = new FigmaClient(config.token, fetchImpl);
    this.tree = new TreeCache(this.client, config.treeTtlMs, config.treeDepth);
  }

  /** Fetch comments, group into threads, and enrich each root with its target node. */
  async getEnrichedThreads(
    file: string,
    opts: { includeResolved?: boolean; asMarkdown?: boolean } = {},
  ): Promise<{ fileKey: string; threads: EnrichedThread[] }> {
    const { fileKey } = parseFigmaRef(file);
    const comments = await this.client.listComments(fileKey, opts.asMarkdown ?? true);
    const threads = buildThreads(comments, { includeResolved: opts.includeResolved });

    const enriched = threads.length > 0 ? await this.enrich(fileKey, threads) : [];
    return { fileKey, threads: enriched };
  }

  /** A single thread (root + replies) for one comment id, enriched + reactions. */
  async getThread(
    file: string,
    commentId: string,
  ): Promise<{ fileKey: string; enriched: EnrichedThread } | null> {
    const { fileKey } = parseFigmaRef(file);
    const comments = await this.client.listComments(fileKey, true);

    const target = comments.find((c) => c.id === commentId);
    if (!target) return null;

    // The root is either this comment or its parent.
    const rootId = target.parent_id && target.parent_id.trim() !== ""
      ? target.parent_id
      : target.id;
    const root = comments.find((c) => c.id === rootId);
    if (!root) return null;

    const replies = comments
      .filter((c) => c.parent_id === rootId)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

    const thread: Thread = { root, replies };
    const [enriched] = await this.enrich(fileKey, [thread]);
    return { fileKey, enriched };
  }

  /** Counts + grouping by target frame/page for the opening overview. */
  async getSummary(file: string): Promise<{
    fileKey: string;
    total: number;
    open: number;
    resolved: number;
    openThreads: EnrichedThread[];
    byGroup: Map<string, number>;
  }> {
    const { fileKey } = parseFigmaRef(file);
    const comments = await this.client.listComments(fileKey, true);

    const allThreads = buildThreads(comments, { includeResolved: true });
    const total = allThreads.length;
    const resolved = allThreads.filter((t) => isResolved(t.root)).length;
    const open = total - resolved;

    const openOnly = allThreads.filter((t) => !isResolved(t.root));
    const openThreads = openOnly.length > 0 ? await this.enrich(fileKey, openOnly) : [];

    const byGroup = new Map<string, number>();
    for (const et of openThreads) {
      const key = groupKey(et.target);
      byGroup.set(key, (byGroup.get(key) ?? 0) + 1);
    }

    return { fileKey, total, open, resolved, openThreads, byGroup };
  }

  /**
   * Resolve a node id to render: explicit node_id wins, otherwise the target of
   * the given comment. Returns null if nothing resolvable.
   */
  async resolveRenderNodeId(
    file: string,
    opts: { nodeId?: string; commentId?: string },
  ): Promise<{ fileKey: string; nodeId: string | null; target: TargetNode | null }> {
    const { fileKey } = parseFigmaRef(file);
    if (opts.nodeId) {
      return { fileKey, nodeId: opts.nodeId, target: null };
    }
    if (opts.commentId) {
      const comments = await this.client.listComments(fileKey, true);
      const comment = comments.find((c) => c.id === opts.commentId);
      if (!comment) return { fileKey, nodeId: null, target: null };
      const index = await this.tree.get(fileKey);
      const target = resolveTarget(comment, index);
      return { fileKey, nodeId: target?.nodeId ?? null, target };
    }
    return { fileKey, nodeId: null, target: null };
  }

  /** Look up the root comment id for a given comment id (replies map to their root). */
  async rootIdFor(fileKey: string, commentId: string): Promise<string | null> {
    const comments = await this.client.listComments(fileKey, true);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return null;
    return comment.parent_id && comment.parent_id.trim() !== ""
      ? comment.parent_id
      : comment.id;
  }

  private async enrich(fileKey: string, threads: Thread[]): Promise<EnrichedThread[]> {
    const index = await this.tree.get(fileKey);
    return threads.map((thread) => ({
      thread,
      target: resolveTarget(thread.root, index),
    }));
  }
}

function groupKey(target: TargetNode | null): string {
  if (!target) return "(unpinned)";
  // First breadcrumb segment is the page/top frame.
  const first = target.path.split(" / ")[0];
  return first || target.name;
}

export type { Comment };
