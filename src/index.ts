#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadDotenv } from "./env.js";
import { loadConfig, ConfigError } from "./config.js";
import { CommentsService } from "./service.js";
import { registerListComments } from "./tools/listComments.js";
import { registerGetCommentThread } from "./tools/getCommentThread.js";
import { registerGetCommentsSummary } from "./tools/getCommentsSummary.js";
import { registerRenderCommentTarget } from "./tools/renderCommentTarget.js";
import { registerReplyToComment } from "./tools/replyToComment.js";
import { registerReactToComment } from "./tools/reactToComment.js";
import { registerPostComment } from "./tools/postComment.js";

async function main(): Promise<void> {
  loadDotenv();
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[figma-comments-mcp] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const service = new CommentsService(config);
  const server = new McpServer({
    name: "figma-comments-mcp",
    version: "0.1.0",
  });

  // Read tools (Phase 1) — always available.
  registerListComments(server, service);
  registerGetCommentThread(server, service);
  registerGetCommentsSummary(server, service);
  registerRenderCommentTarget(server, service);

  // Write tools (Phase 2) — gated behind FIGMA_ENABLE_WRITES.
  if (config.enableWrites) {
    registerReplyToComment(server, service);
    registerReactToComment(server, service);
    registerPostComment(server, service);
    console.error("[figma-comments-mcp] write tools enabled (dry_run defaults to true).");
  } else {
    console.error(
      "[figma-comments-mcp] write tools disabled. Set FIGMA_ENABLE_WRITES=true to enable.",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[figma-comments-mcp] server ready on stdio.");
}

main().catch((err) => {
  console.error("[figma-comments-mcp] fatal:", err);
  process.exit(1);
});
