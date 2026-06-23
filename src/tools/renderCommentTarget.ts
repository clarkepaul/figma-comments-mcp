import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { safe, errorResult, type ToolResult } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
  comment_id: z
    .string()
    .optional()
    .describe("Comment id whose pinned node should be rendered. Provide this or node_id."),
  node_id: z
    .string()
    .optional()
    .describe("Explicit node id to render (e.g. '1:360'). Takes precedence over comment_id."),
  scale: z
    .number()
    .min(0.01)
    .max(4)
    .optional()
    .describe("Render scale. Default 2."),
};

export function registerRenderCommentTarget(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "render_comment_target",
    {
      title: "Render a Figma comment's target node",
      description:
        "Resolve the design node a comment is pinned to (or an explicit node_id), render it via " +
        "the Figma images API, and return the temporary image URL plus the rendered image so it " +
        "can be viewed. Useful for visually grounding an ambiguous comment.",
      inputSchema,
    },
    safe(async ({ file, comment_id, node_id, scale }): Promise<ToolResult> => {
      if (!comment_id && !node_id) {
        return errorResult(new Error("Provide either comment_id or node_id."));
      }

      const { fileKey, nodeId, target } = await service.resolveRenderNodeId(file, {
        nodeId: node_id,
        commentId: comment_id,
      });

      if (!nodeId) {
        return errorResult(
          new Error(
            comment_id
              ? `Could not resolve a target node for comment "${comment_id}" (unpinned or coordinates outside any node).`
              : "No node id resolved.",
          ),
        );
      }

      const images = await service.client.getImages(fileKey, [nodeId], scale ?? 2, "png");
      if (images.err) {
        return errorResult(new Error(`Figma images API error: ${images.err}`));
      }

      const url = images.images[nodeId];
      const targetLabel = target
        ? `${target.path || target.name} (node ${nodeId})${target.inferred ? " [inferred]" : ""}`
        : `node ${nodeId}`;

      if (!url) {
        return {
          content: [
            {
              type: "text",
              text:
                `Target: ${targetLabel}\n` +
                `The node rendered to null (it may be invisible or have 0 opacity), so no image is available.`,
            },
          ],
        };
      }

      const content: ToolResult["content"] = [
        { type: "text", text: `Target: ${targetLabel}\nImage URL (temporary): ${url}` },
      ];

      // Best-effort fetch of the bytes so the image can be viewed inline.
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          content.push({
            type: "image",
            data: buf.toString("base64"),
            mimeType: res.headers.get("content-type") ?? "image/png",
          });
        }
      } catch {
        // Keep the URL-only result if the download fails.
      }

      return { content };
    }),
  );
}
