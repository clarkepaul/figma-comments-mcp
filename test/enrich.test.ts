import { describe, it, expect } from "vitest";
import { FileTreeIndex } from "../src/figma/tree.js";
import { resolveTarget } from "../src/figma/enrich.js";
import type { Comment, FileResponse } from "../src/figma/types.js";

// A small fixture tree:
//   Document
//   └ Page 1
//     └ Checkout (0,0 400x800)
//       └ CTA Button (40,700 200x60)
const file: FileResponse = {
  name: "Fixture",
  document: {
    id: "0:0",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "0:1",
        name: "Page 1",
        type: "CANVAS",
        children: [
          {
            id: "1:1",
            name: "Checkout",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 800 },
            children: [
              {
                id: "1:360",
                name: "CTA Button",
                type: "INSTANCE",
                absoluteBoundingBox: { x: 40, y: 700, width: 200, height: 60 },
              },
            ],
          },
        ],
      },
    ],
  },
};

const index = new FileTreeIndex(file);

function comment(client_meta: Comment["client_meta"]): Comment {
  return {
    id: "c1",
    file_key: "k",
    parent_id: "",
    user: { handle: "client" },
    created_at: "2026-06-15T10:00:00Z",
    message: "change this",
    client_meta,
  };
}

describe("FileTreeIndex", () => {
  it("builds breadcrumb paths excluding the document root", () => {
    expect(index.path("1:360")).toBe("Page 1 / Checkout / CTA Button");
    expect(index.path("1:1")).toBe("Page 1 / Checkout");
  });

  it("hit-tests to the deepest containing node", () => {
    // Inside the button.
    expect(index.hitTest(120, 730)?.id).toBe("1:360");
    // Inside the frame but outside the button.
    expect(index.hitTest(10, 10)?.id).toBe("1:1");
    // Outside everything.
    expect(index.hitTest(9999, 9999)).toBeUndefined();
  });
});

describe("resolveTarget", () => {
  it("resolves a FrameOffset directly (not inferred)", () => {
    const t = resolveTarget(comment({ node_id: "1:360", node_offset: { x: 5, y: 5 } }), index);
    expect(t).toMatchObject({
      nodeId: "1:360",
      name: "CTA Button",
      path: "Page 1 / Checkout / CTA Button",
      inferred: false,
    });
  });

  it("resolves a bare Vector via hit-test and flags it inferred", () => {
    const t = resolveTarget(comment({ x: 120, y: 730 }), index);
    expect(t).toMatchObject({ nodeId: "1:360", inferred: true });
  });

  it("handles a node_id missing from the tree", () => {
    const t = resolveTarget(comment({ node_id: "9:9", node_offset: { x: 0, y: 0 } }), index);
    expect(t).toMatchObject({ nodeId: "9:9", name: "(unknown node)", inferred: false });
  });

  it("returns null when there is no usable client_meta", () => {
    expect(resolveTarget(comment(null), index)).toBeNull();
  });

  it("returns null when a Vector falls outside every node", () => {
    expect(resolveTarget(comment({ x: 99999, y: 99999 }), index)).toBeNull();
  });
});
