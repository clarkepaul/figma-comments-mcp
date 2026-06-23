# figma-comments-mcp

[![CI](https://github.com/junsimon/figma-comments-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/junsimon/figma-comments-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Model Context Protocol](https://img.shields.io/badge/MCP-stdio-blue.svg)](https://modelcontextprotocol.io)

A local [MCP](https://modelcontextprotocol.io) server that lets Claude (or any MCP client) **read, understand, and act on comments in Figma _and_ FigJam** — the layer the official Figma Dev Mode MCP doesn't expose.

Works on both **Figma design files** (`figma.com/design/…`) and **FigJam boards** (`figma.com/board/…`), so it fits the whole arc of a project: design reviews, design QA, and the messy collaborative middle — workshops, brainstorms, retros, and jams where the thinking lives in pinned comments on stickies and frames.

**Why this exists:** clients, reviewers, and workshop participants leave most of their feedback as comments pinned onto the canvas. AI assistants can read the design itself — layers, screenshots, code — but not those pinned comments, so the feedback never actually makes it into the work. This server closes that gap: Claude reads the comments **and knows exactly which layer or sticky each one points to**, so _"make this blue"_ becomes _"make `Checkout / CTA Button` blue."_

The official Figma MCP gives an AI assistant the design tree, screenshots, variables, and code, but **not comments**. Clients, reviewers, and workshop participants leave most of their feedback as comments pinned onto the canvas. This server wraps the Figma REST comments API and, crucially, **resolves which node each comment is pinned to** — a layer in a design file, or a sticky/shape/section in a FigJam board (name + breadcrumb path + node id) — so feedback like _"make this blue"_ becomes actionable: _"comment on `Checkout / CTA Button` (node 1:360): make this blue."_

It composes alongside the official Figma MCP — that one reads design structure and writes design changes; this one adds the missing comment layer.

```
┌─────────┐   reads comments     ┌──────────────────────┐
│ Claude  │ ───────────────────▶ │  figma-comments-mcp  │ ──▶ Figma REST API
│ (MCP    │                      │      (this repo)     │     /v1/files/:key/comments
│ client) │ ◀─────────────────── └──────────────────────┘
│         │   reads/writes design ┌──────────────────────┐
│         │ ◀──────────────────▶  │  Figma Dev Mode MCP  │ ──▶ Figma (official)
└─────────┘                       └──────────────────────┘
```

## Contents

- [Tools](#tools)
- [Sample output](#sample-output)
- [How comment → node mapping works](#how-comment--node-mapping-works)
- [Quick start](#quick-start)
- [Register with an MCP client](#register-with-an-mcp-client)
- [CLI](#cli-for-debugging)
- [Configuration](#configuration-reference)
- [Development](#development)
- [Contributing](#contributing) · [Security](#security) · [License](#license)

## Tools

**Read (always available):**

| Tool | What it does |
|---|---|
| `get_comments_summary` | Counts (total/open/resolved), open threads grouped by target page/frame, one-line digest per open thread. Start here. |
| `list_comments` | All threads, grouped, each enriched with its target node. Open-only by default. |
| `get_comment_thread` | One full thread (root + replies + reactions + resolved state + target node). |
| `render_comment_target` | Renders the node a comment is pinned to (or an explicit `node_id`) and returns the image so the assistant can see it. |

**Write (only when `FIGMA_ENABLE_WRITES=true`, and each defaults to a `dry_run` preview):**

| Tool | What it does |
|---|---|
| `reply_to_comment` | Post a reply to a thread (e.g. "Done — changed the button to blue"). |
| `react_to_comment` | Add an emoji reaction (default `:white_check_mark:`) as a lightweight "addressed" marker. |
| `post_comment` | Place a new pinned comment at a node or coordinate. |

> **Resolution limitation:** the Figma REST API has **no endpoint to resolve a comment** — `resolved_at` can only be set in the Figma UI. Use a reply or a `:white_check_mark:` reaction as the machine-writable "addressed" signal.

## Sample output

`get_comments_summary` returns an at-a-glance overview — counts, open threads grouped by where they sit, and a one-line digest of each:

```
Comments: 12 total, 4 open, 8 resolved.

Open threads by target:
  - Checkout / Payment: 2
  - Home / Hero: 1
  - (unpinned): 1

Open threads:
  #3 Checkout / CTA Button: make this blue
  #7 Checkout / Card field: the label is cut off on mobile
  #9 Home / Hero: can we try a lighter headline?
  #11 (unpinned): overall looks great, ship it
```

`list_comments` / `get_comment_thread` return the full thread, each tied to the exact layer it's pinned to:

```
#3  [OPEN]  @jane  2026-06-10
Target: Checkout / CTA Button  (node 1:360)
"make this blue"
  └ reply @simon: "on it"
  ✅ x1
```

The `(node 1:360)` is the part the official Figma MCP can't give you: it tells the assistant precisely which layer the feedback is about.

## How comment → node mapping works

Each comment carries `client_meta` in one of four shapes:

- **FrameOffset / FrameOffsetRegion** — has a `node_id` → direct lookup of the node name, type, and breadcrumb path (a layer in Figma, a sticky/shape/section in FigJam).
- **Vector / Region** — bare absolute coordinates → the server fetches the file's node tree and returns the **deepest node whose bounding box contains the point**, flagged `[inferred]` so you know the mapping is heuristic.

The file tree is fetched once and cached in-memory (TTL, default 60s) so enrichment doesn't refetch for every comment.

## Quick start

**Requirements:** [Node](https://nodejs.org) 20+ and npm.

### 1. Create a Figma Personal Access Token

Figma → **Settings → Security → Personal access tokens**. Select these scopes when creating it:

- `file_comments:read` — read comments & reactions (required)
- `file_content:read` — read the node tree for enrichment + render images (required)
- `file_comments:write` — post replies/reactions/comments (only if you enable writes)

### 2. Install and build

```bash
git clone https://github.com/junsimon/figma-comments-mcp.git
cd figma-comments-mcp
npm install
npm run build
```

### 3. Provide the token

Copy `.env.example` to `.env` and set `FIGMA_TOKEN`:

```bash
cp .env.example .env
# edit .env and paste your token
```

The server and CLI auto-load `.env` from the project root. (Alternatively, pass
`FIGMA_TOKEN` via the MCP client's `env` block — see below.) `.env` is gitignored.

### 4. Verify with the CLI

```bash
node dist/cli.js "https://www.figma.com/design/<KEY>/<name>" --summary   # Figma design file
node dist/cli.js "https://www.figma.com/board/<KEY>/<name>" --summary     # FigJam board
```

You should see comment counts and a one-line digest per open thread. A bare file
key works too, and `/design/`, `/board/`, `/file/`, and `/proto/` URLs are all accepted.

## Register with an MCP client

The server speaks MCP over **stdio**. For Claude Code, either run:

```bash
claude mcp add figma-comments \
  -e FIGMA_ENABLE_WRITES=false \
  -- node /absolute/path/to/figma-comments-mcp/dist/index.js
```

…or add it to your MCP config (`.mcp.json` / `claude_desktop_config.json` / etc.):

```json
{
  "mcpServers": {
    "figma-comments": {
      "command": "node",
      "args": ["/absolute/path/to/figma-comments-mcp/dist/index.js"],
      "env": {
        "FIGMA_TOKEN": "<your token>",
        "FIGMA_ENABLE_WRITES": "false"
      }
    }
  }
}
```

> **Replace `/absolute/path/to/figma-comments-mcp` with the real path on your
> machine** — that string is a placeholder, not a literal value. If you copy it
> verbatim, the client will fail to start the server with
> `Error: Cannot find module '/absolute/path/to/figma-comments-mcp/dist/index.js'`.
> Run `pwd` in the cloned repo to get the path, and make sure you've built it
> (`npm run build`) so `dist/index.js` exists. The same applies to the
> `claude mcp add` command above.

If you keep the token in `.env`, you can omit `FIGMA_TOKEN` from the config above.
Set `FIGMA_ENABLE_WRITES` to `true` to expose the write tools — even then, every
write defaults to a `dry_run` preview, so the assistant must pass `dry_run:false` to
actually mutate a shared file. Restart the client after registering.

## CLI (for debugging)

```bash
node dist/cli.js "<figma file url>"                    # enriched comment blocks (open only)
node dist/cli.js "<figma file url>" --include-resolved  # include resolved
node dist/cli.js "<figma file url>" --summary           # counts + digest
node dist/cli.js "<figma file url>" --json              # raw enriched JSON
```

During development you can skip the build with `npm run cli -- "<url>"` (via `tsx`).

## Configuration reference

| Env var | Default | Purpose |
|---|---|---|
| `FIGMA_TOKEN` | — (required) | Personal Access Token. |
| `FIGMA_ENABLE_WRITES` | `false` | Register the write tools. |
| `FIGMA_TREE_TTL_MS` | `60000` | In-memory file-tree cache TTL. |
| `FIGMA_TREE_DEPTH` | `4` | Max node-tree depth fetched for pin enrichment. Bounds the payload so large files don't drop the connection. `0` = unbounded. |

All can be set in the environment or in `.env`.

## Development

```bash
npm test          # vitest — URL parsing, enrichment hit-test, threading
npm run typecheck # tsc --noEmit
npm run dev       # run the server from source via tsx
npm run cli -- "<url>"   # run the CLI from source
```

CI (GitHub Actions) runs typecheck, build, and tests on Node 20.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please don't
commit secrets or paste tokens into issues/PRs.

## Security

Keep your token in `.env` (gitignored), grant it the minimum scopes you need, and
revoke any token that leaks. The server only ever sends the token to Figma's API.
Found a vulnerability? Email simonjun@simonjun.cz rather than opening a public issue.

## License

[MIT](./LICENSE) © Šimon Jůn
