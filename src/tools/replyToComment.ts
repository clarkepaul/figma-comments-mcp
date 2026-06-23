import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { parseFigmaRef } from "../figma/url.js";
import { safe, text, json } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
  comment_id: z
    .string()
    .describe("Comment id to reply to. A reply id is resolved to its root automatically."),
  message: z.string().min(1).describe("Reply text (markdown supported)."),
  dry_run: z
    .boolean()
    .optional()
    .describe("Preview only without posting. Default true; pass false to actually post."),
};

export function registerReplyToComment(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "reply_to_comment",
    {
      title: "Reply to a Figma comment",
      description:
        "Post a reply to a comment thread. Writes to a shared file — defaults to dry_run preview; " +
        "pass dry_run:false to actually post. (The REST API has no resolve endpoint; a reply or " +
        "reaction is the machine-writable 'addressed' signal.)",
      inputSchema,
    },
    safe(async ({ file, comment_id, message, dry_run }) => {
      const { fileKey } = parseFigmaRef(file);
      const rootId = await service.rootIdFor(fileKey, comment_id);
      if (!rootId) {
        return text(`No comment with id "${comment_id}" was found on this file.`);
      }

      if (dry_run !== false) {
        return json({
          dry_run: true,
          action: "reply_to_comment",
          file_key: fileKey,
          would_post: { comment_id: rootId, message },
          note: "Pass dry_run:false to actually post this reply.",
        });
      }

      const posted = await service.client.postComment(fileKey, {
        comment_id: rootId,
        message,
      });
      return text(`Reply posted (id ${posted.id}) to thread ${rootId}.`);
    }),
  );
}
