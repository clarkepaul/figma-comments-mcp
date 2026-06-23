# Contributing

Thanks for your interest in improving **figma-comments-mcp**! Contributions of all
sizes are welcome — bug reports, docs, and code.

## Development setup

```bash
git clone https://github.com/junsimon/figma-comments-mcp.git
cd figma-comments-mcp
npm install
cp .env.example .env   # then add your FIGMA_TOKEN
```

Node 20+ is required (see `.nvmrc`).

## Workflow

```bash
npm run typecheck   # tsc --noEmit — must pass
npm test            # vitest — must pass
npm run build       # compile to dist/
npm run dev         # run the server from source via tsx
npm run cli -- "<figma url>"   # run the CLI from source
```

Before opening a pull request, make sure `npm run typecheck`, `npm test`, and
`npm run build` all pass. CI runs the same checks on Node 20.

## Guidelines

- **Keep tool output compact.** The Figma node tree is large; tools should return
  enriched summaries, not raw API dumps (except behind a `raw`/`--json` flag).
- **Pure logic gets a unit test.** URL parsing, enrichment, and threading live in
  small pure functions with fixtures in `test/` — extend them when you change that
  logic. Live API calls are verified manually with a real token.
- **Never commit secrets.** `.env` is gitignored; keep it that way. Don't paste
  tokens into issues, PRs, or test fixtures.
- **Match the existing style.** TypeScript, ESM, explicit types on exported APIs,
  small single-purpose modules.

## Reporting bugs

Open an issue with the steps to reproduce, the tool/CLI command you ran, and the
output. **Redact your token and any private file contents.**

## Releasing (maintainers)

1. Bump the version in `package.json` (semver).
2. Tag the release: `git tag vX.Y.Z && git push --tags`.
