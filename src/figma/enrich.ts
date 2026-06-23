import type { Comment } from "./types.js";
import { hasCoords, hasNodeId } from "./types.js";
import type { FileTreeIndex } from "./tree.js";

export interface TargetNode {
  nodeId: string;
  name: string;
  type: string;
  /** Breadcrumb path, e.g. "Page 1 / Checkout / CTA Button". */
  path: string;
  /** True when the node was guessed via bounding-box hit-test (bare coords). */
  inferred: boolean;
}

/**
 * Resolve which design node a comment is pinned to.
 *
 * - client_meta with a node_id (FrameOffset / FrameOffsetRegion) -> direct lookup.
 * - client_meta with bare coords (Vector / Region) -> deepest containing node,
 *   flagged `inferred` so callers know the mapping is heuristic.
 * - otherwise -> null.
 */
export function resolveTarget(
  comment: Comment,
  index: FileTreeIndex,
): TargetNode | null {
  const meta = comment.client_meta ?? null;

  if (hasNodeId(meta)) {
    const node = index.get(meta.node_id);
    if (!node) {
      // Pin references a node that isn't in the current tree (deleted/moved).
      return {
        nodeId: meta.node_id,
        name: "(unknown node)",
        type: "UNKNOWN",
        path: "",
        inferred: false,
      };
    }
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      path: index.path(node.id),
      inferred: false,
    };
  }

  if (hasCoords(meta)) {
    const node = index.hitTest(meta.x, meta.y);
    if (!node) return null;
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      path: index.path(node.id),
      inferred: true,
    };
  }

  return null;
}
