import type { FigmaClient } from "./client.js";
import type { BoundingBox, FigmaNode, FileResponse } from "./types.js";

export interface IndexedNode {
  id: string;
  name: string;
  type: string;
  box?: BoundingBox | null;
  parentId?: string;
  /** Depth from document root (document = 0). Higher = deeper. */
  depth: number;
}

/**
 * A flat, queryable index over a Figma file's node tree. Built once per file
 * fetch and reused for every comment's enrichment in the same request.
 */
export class FileTreeIndex {
  private readonly nodes = new Map<string, IndexedNode>();
  readonly fileName: string;

  constructor(file: FileResponse) {
    this.fileName = file.name;
    this.indexNode(file.document, undefined, 0);
  }

  private indexNode(node: FigmaNode, parentId: string | undefined, depth: number): void {
    this.nodes.set(node.id, {
      id: node.id,
      name: node.name,
      type: node.type,
      box: node.absoluteBoundingBox ?? null,
      parentId,
      depth,
    });
    if (node.children) {
      for (const child of node.children) {
        this.indexNode(child, node.id, depth + 1);
      }
    }
  }

  get(nodeId: string): IndexedNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Breadcrumb path to a node, excluding the synthetic document root.
   * e.g. "Page 1 / Checkout / CTA Button".
   */
  path(nodeId: string): string {
    const parts: string[] = [];
    let current = this.nodes.get(nodeId);
    while (current && current.parentId !== undefined) {
      parts.unshift(current.name);
      current = this.nodes.get(current.parentId);
    }
    return parts.join(" / ");
  }

  /**
   * Deepest node whose absolute bounding box contains the point. Used to infer
   * a target for comments pinned to bare coordinates (Vector / Region).
   */
  hitTest(x: number, y: number): IndexedNode | undefined {
    let best: IndexedNode | undefined;
    for (const node of this.nodes.values()) {
      const b = node.box;
      if (!b) continue;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        if (!best || node.depth > best.depth) best = node;
      }
    }
    return best;
  }
}

interface CacheEntry {
  index: FileTreeIndex;
  expiresAt: number;
}

/**
 * In-memory, TTL'd cache of file tree indexes keyed by file key. The tree can be
 * large, so we fetch it at most once per TTL window and reuse across comments.
 */
export class TreeCache {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly client: FigmaClient,
    private readonly ttlMs: number,
    private readonly depth: number = 0,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async get(fileKey: string): Promise<FileTreeIndex> {
    const entry = this.cache.get(fileKey);
    if (entry && entry.expiresAt > this.now()) {
      return entry.index;
    }
    const file = await this.client.getFile(fileKey, this.depth);
    const index = new FileTreeIndex(file);
    this.cache.set(fileKey, { index, expiresAt: this.now() + this.ttlMs });
    return index;
  }
}
