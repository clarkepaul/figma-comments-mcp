import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { parseFigmaRef } from "../figma/url.js";
import { safe, text, json } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
  comment_id: z.string().describe("Comment id to react to."),
  emoji: z
    .string()
    .optional()
    .describe("Emoji shortcode, e.g. ':white_check_mark:'. Default ':white_check_mark:'."),
  dry_run: z
    .boolean()
    .optional()
    .describe("Preview only without posting. Default true; pass false to actually react."),
};

export function registerReactToComment(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "react_to_comment",
    {
      title: "React to a Figma comment",
      description:
        "Add an emoji reaction to a comment — a lightweight 'addressed/done' marker. Writes to a " +
        "shared file — defaults to dry_run preview; pass dry_run:false to actually react.",
      inputSchema,
    },
    safe(async ({ file, comment_id, emoji, dry_run }) => {
      const { fileKey } = parseFigmaRef(file);
      const shortcode = emoji ?? ":white_check_mark:";

      if (dry_run !== false) {
        return json({
          dry_run: true,
          action: "react_to_comment",
          file_key: fileKey,
          would_react: { comment_id, emoji: shortcode },
          note: "Pass dry_run:false to actually add this reaction.",
        });
      }

      await service.client.postReaction(fileKey, comment_id, shortcode);
      return text(`Reaction ${shortcode} added to comment ${comment_id}.`);
    }),
  );
}
