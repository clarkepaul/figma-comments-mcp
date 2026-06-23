import type { Reaction } from "./figma/types.js";
import type { TargetNode } from "./figma/enrich.js";
import { isResolved, type Thread } from "./figma/threads.js";

export interface EnrichedThread {
  thread: Thread;
  target: TargetNode | null;
}

const EMOJI: Record<string, string> = {
  ":+1:": "👍",
  ":-1:": "👎",
  ":white_check_mark:": "✅",
  ":heavy_check_mark:": "✔️",
  ":eyes:": "👀",
  ":tada:": "🎉",
  ":heart:": "❤️",
  ":fire:": "🔥",
  ":rocket:": "🚀",
  ":thinking:": "🤔",
};

function emoji(shortcode: string): string {
  return EMOJI[shortcode] ?? shortcode;
}

function shortDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

function renderReactions(reactions?: Reaction[]): string | null {
  if (!reactions || reactions.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([e, n]) => `${emoji(e)} x${n}`);
  return `reactions: ${parts.join("  ")}`;
}

function renderTarget(target: TargetNode | null): string {
  if (!target) return "Target: (no node — unpinned or coordinates outside any node)";
  const inferred = target.inferred ? "  [inferred]" : "";
  const label = target.path || target.name;
  return `Target: ${label}  (node ${target.nodeId})${inferred}`;
}

/** One compact block per thread. */
export function formatThread(et: EnrichedThread): string {
  const { thread, target } = et;
  const root = thread.root;
  const status = isResolved(root) ? "RESOLVED" : "OPEN";
  const pin = root.order_id ? `#${root.order_id}` : `#${root.id}`;
  const lines: string[] = [];

  lines.push(`${pin}  [${status}]  @${root.user.handle}  ${shortDate(root.created_at)}`);
  lines.push(renderTarget(target));
  lines.push(`"${root.message}"`);

  for (const reply of thread.replies) {
    lines.push(`  └ reply @${reply.user.handle}: "${reply.message}"`);
  }

  const rootReactions = renderReactions(root.reactions);
  if (rootReactions) lines.push(`  ${rootReactions}`);

  return lines.join("\n");
}

export function formatThreadList(threads: EnrichedThread[]): string {
  if (threads.length === 0) return "No comments match the current filter.";
  return threads.map(formatThread).join("\n\n");
}

/** One-line digest used by the summary tool. */
export function digestLine(et: EnrichedThread): string {
  const { thread, target } = et;
  const root = thread.root;
  const pin = root.order_id ? `#${root.order_id}` : `#${root.id}`;
  const where = target ? (target.path || target.name) : "(unpinned)";
  const msg = root.message.replace(/\s+/g, " ").slice(0, 100);
  return `${pin} ${where}: ${msg}`;
}
