import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { formatThread } from "../format.js";
import { isResolved } from "../figma/threads.js";
import { safe, text } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
  comment_id: z
    .string()
    .describe("Comment id. May be a root or a reply — the full root thread is returned."),
};

export function registerGetCommentThread(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "get_comment_thread",
    {
      title: "Get a Figma comment thread",
      description:
        "Return one full comment thread (root + all replies + reactions + resolved state + " +
        "target node) for a given comment id. Accepts a reply id and resolves to its root thread.",
      inputSchema,
    },
    safe(async ({ file, comment_id }) => {
      const result = await service.getThread(file, comment_id);
      if (!result) {
        return text(`No comment with id "${comment_id}" was found on this file.`);
      }
      const { enriched } = result;
      const status = isResolved(enriched.thread.root)
        ? `resolved at ${enriched.thread.root.resolved_at}`
        : "open";
      return text(`Thread (${status}):\n\n${formatThread(enriched)}`);
    }),
  );
}
