import { describe, it, expect } from "vitest";
import { buildThreads, isResolved } from "../src/figma/threads.js";
import type { Comment } from "../src/figma/types.js";

function c(partial: Partial<Comment> & { id: string }): Comment {
  return {
    file_key: "k",
    parent_id: "",
    user: { handle: "u" },
    created_at: "2026-06-15T10:00:00Z",
    message: "m",
    ...partial,
  };
}

const comments: Comment[] = [
  c({ id: "r2", order_id: "2", message: "second" }),
  c({ id: "r1", order_id: "1", message: "first" }),
  c({ id: "rep1b", parent_id: "r1", created_at: "2026-06-15T12:00:00Z", message: "later reply" }),
  c({ id: "rep1a", parent_id: "r1", created_at: "2026-06-15T11:00:00Z", message: "early reply" }),
  c({ id: "r3", order_id: "3", message: "resolved one", resolved_at: "2026-06-16T00:00:00Z" }),
];

describe("buildThreads", () => {
  it("sorts roots by order_id and groups replies chronologically", () => {
    const threads = buildThreads(comments);
    expect(threads.map((t) => t.root.id)).toEqual(["r1", "r2"]); // r3 resolved, hidden
    const r1 = threads[0];
    expect(r1.replies.map((rep) => rep.id)).toEqual(["rep1a", "rep1b"]);
  });

  it("hides resolved roots by default", () => {
    expect(buildThreads(comments).some((t) => t.root.id === "r3")).toBe(false);
  });

  it("includes resolved roots when requested", () => {
    const threads = buildThreads(comments, { includeResolved: true });
    expect(threads.map((t) => t.root.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("does not treat replies as roots", () => {
    const ids = buildThreads(comments, { includeResolved: true }).map((t) => t.root.id);
    expect(ids).not.toContain("rep1a");
  });
});

describe("isResolved", () => {
  it("treats empty/whitespace resolved_at as unresolved", () => {
    expect(isResolved(c({ id: "x", resolved_at: "" }))).toBe(false);
    expect(isResolved(c({ id: "x", resolved_at: "  " }))).toBe(false);
    expect(isResolved(c({ id: "x", resolved_at: null }))).toBe(false);
    expect(isResolved(c({ id: "x", resolved_at: "2026-06-16T00:00:00Z" }))).toBe(true);
  });
});
