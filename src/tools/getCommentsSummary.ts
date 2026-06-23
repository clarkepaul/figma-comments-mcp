import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CommentsService } from "../service.js";
import { digestLine } from "../format.js";
import { safe, text } from "./helpers.js";

const inputSchema = {
  file: z.string().describe("Figma file URL or bare file key."),
};

export function registerGetCommentsSummary(server: McpServer, service: CommentsService): void {
  server.registerTool(
    "get_comments_summary",
    {
      title: "Summarize Figma comments",
      description:
        "Opening overview of a file's comments: total / open / resolved counts, open threads " +
        "grouped by target page/frame, and a one-line digest per open thread. Use this first to " +
        "answer 'what does the client want changed?'.",
      inputSchema,
    },
    safe(async ({ file }) => {
      const summary = await service.getSummary(file);
      const lines: string[] = [];

      lines.push(
        `Comments: ${summary.total} total, ${summary.open} open, ${summary.resolved} resolved.`,
      );

      if (summary.byGroup.size > 0) {
        lines.push("\nOpen threads by target:");
        for (const [group, count] of [...summary.byGroup.entries()].sort((a, b) => b[1] - a[1])) {
          lines.push(`  - ${group}: ${count}`);
        }
      }

      if (summary.openThreads.length > 0) {
        lines.push("\nOpen threads:");
        for (const et of summary.openThreads) {
          lines.push(`  ${digestLine(et)}`);
        }
      }

      return text(lines.join("\n"));
    }),
  );
}
