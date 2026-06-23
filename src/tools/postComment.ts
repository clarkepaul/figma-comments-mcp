import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { parseFigmaRef, normalizeNodeId } from "../figma/url.js";
import type { PostCommentBody } from "../figma/client.js";
import { safe, text, json, errorResult } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
  message: z.string().min(1).describe("Comment text (markdown supported)."),
  node_id: z
    .string()
    .optional()
    .describe("Pin the comment to this node (FrameOffset). Provide node_id or x/y, not both."),
  x: z.number().optional().describe("Absolute canvas X (Vector pin). Use with y."),
  y: z.number().optional().describe("Absolute canvas Y (Vector pin). Use with x."),
  dry_run: z
    .boolean()
    .optional()
    .describe("Preview only without posting. Default true; pass false to actually post."),
};

export function registerPostComment(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "post_comment",
    {
      title: "Post a new Figma comment",
      description:
        "Place a new pinned comment on a file, attached to a node (node_id) or at absolute " +
        "coordinates (x/y). Writes to a shared file — defaults to dry_run preview; pass " +
        "dry_run:false to actually post.",
      inputSchema,
    },
    safe(async ({ file, message, node_id, x, y, dry_run }) => {
      const { fileKey } = parseFigmaRef(file);

      let client_meta: unknown;
      if (node_id) {
        client_meta = { node_id: normalizeNodeId(node_id), node_offset: { x: 0, y: 0 } };
      } else if (typeof x === "number" && typeof y === "number") {
        client_meta = { x, y };
      } else {
        return errorResult(
          new Error("Provide either node_id, or both x and y, to position the comment."),
        );
      }

      const body: PostCommentBody = { message, client_meta };

      if (dry_run !== false) {
        return json({
          dry_run: true,
          action: "post_comment",
          file_key: fileKey,
          would_post: body,
          note: "Pass dry_run:false to actually post this comment.",
        });
      }

      const posted = await service.client.postComment(fileKey, body);
      return text(`Comment posted (id ${posted.id}).`);
    }),
  );
}
