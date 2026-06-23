#!/usr/bin/env node
// Debug CLI: print enriched comments for a Figma file. Reuses the same library
// the MCP server uses, so it validates the core logic against a real file.
//
//   figma-comments-cli <file-url-or-key> [--include-resolved] [--json] [--summary]

import { loadDotenv } from "./env.js";
import { loadConfig, ConfigError } from "./config.js";
import { CommentsService } from "./service.js";
import { formatThreadList, digestLine } from "./format.js";

interface CliArgs {
  file?: string;
  includeResolved: boolean;
  json: boolean;
  summary: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { includeResolved: false, json: false, summary: false };
  for (const arg of argv) {
    if (arg === "--include-resolved") args.includeResolved = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--summary") args.summary = true;
    else if (!arg.startsWith("--") && !args.file) args.file = arg;
  }
  return args;
}

async function main(): Promise<void> {
  loadDotenv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error(
      "Usage: figma-comments-cli <file-url-or-key> [--include-resolved] [--json] [--summary]",
    );
    process.exit(2);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const service = new CommentsService(config);

  if (args.summary) {
    const summary = await service.getSummary(args.file);
    if (args.json) {
      console.log(
        JSON.stringify(
          { ...summary, byGroup: Object.fromEntries(summary.byGroup) },
          null,
          2,
        ),
      );
      return;
    }
    console.log(
      `${summary.total} total, ${summary.open} open, ${summary.resolved} resolved\n`,
    );
    for (const et of summary.openThreads) console.log(digestLine(et));
    return;
  }

  const { threads } = await service.getEnrichedThreads(args.file, {
    includeResolved: args.includeResolved,
  });

  if (args.json) {
    console.log(
      JSON.stringify(
        threads.map((et) => ({
          root: et.thread.root,
          replies: et.thread.replies,
          target: et.target,
        })),
        null,
        2,
      ),
    );
    return;
  }

  console.log(formatThreadList(threads));
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
