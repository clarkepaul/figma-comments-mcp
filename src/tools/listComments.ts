import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { formatThreadList } from "../format.js";
import { safe, text, json } from "./helpers.js";

const inputSchema = {
  file: z
    .string()
    .describe("Figma file URL (any figma.com/design|file/<KEY>/... form) or a bare file key."),
  include_resolved: z
    .boolean()
    .optional()
    .describe("Include resolved threads. Default false (open threads only)."),
  as_markdown: z
    .boolean()
    .optional()
    .describe("Request comment text as markdown (as_md=true). Default true."),
  raw: z
    .boolean()
    .optional()
    .describe("Return raw enriched JSON instead of compact text blocks. Default false."),
};

export function registerListComments(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "list_comments",
    {
      title: "List Figma comments",
      description:
        "List comment threads on a Figma file, grouped by thread and enriched with the design " +
        "node each thread is pinned to (layer name + breadcrumb path + node id). Defaults to " +
        "open threads only. Coordinate-only pins are resolved heuristically and flagged [inferred].",
      inputSchema,
    },
    safe(async ({ file, include_resolved, as_markdown, raw }) => {
      const { threads } = await service.getEnrichedThreads(file, {
        includeResolved: include_resolved ?? false,
        asMarkdown: as_markdown ?? true,
      });

      if (raw) {
        return json(
          threads.map((et) => ({
            root: et.thread.root,
            replies: et.thread.replies,
            target: et.target,
          })),
        );
      }

      const header = `${threads.length} thread(s)${include_resolved ? "" : " (open only)"}:\n`;
      return text(header + "\n" + formatThreadList(threads));
    }),
  );
}
