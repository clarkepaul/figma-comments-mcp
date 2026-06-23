import type { Comment } from "./types.js";

export interface Thread {
  root: Comment;
  replies: Comment[];
}

export function isResolved(comment: Comment): boolean {
  return !!comment.resolved_at && comment.resolved_at.trim() !== "";
}

/**
 * Group a flat comment list into threads: roots (no parent_id) with their
 * replies (referencing parent_id) attached and sorted by creation time.
 * Roots are sorted numerically by order_id (the pin number shown in the UI).
 */
export function buildThreads(
  comments: Comment[],
  options: { includeResolved?: boolean } = {},
): Thread[] {
  const repliesByParent = new Map<string, Comment[]>();
  const roots: Comment[] = [];

  for (const comment of comments) {
    if (comment.parent_id && comment.parent_id.trim() !== "") {
      const list = repliesByParent.get(comment.parent_id) ?? [];
      list.push(comment);
      repliesByParent.set(comment.parent_id, list);
    } else {
      roots.push(comment);
    }
  }

  const filteredRoots = options.includeResolved
    ? roots
    : roots.filter((r) => !isResolved(r));

  filteredRoots.sort((a, b) => orderId(a) - orderId(b));

  return filteredRoots.map((root) => ({
    root,
    replies: (repliesByParent.get(root.id) ?? []).sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    ),
  }));
}

function orderId(c: Comment): number {
  const n = Number(c.order_id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
