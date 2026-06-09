# CodeGraph Setup

This repository can use [CodeGraph](https://github.com/colbymchenry/codegraph)
for local code search, symbol relationships, and impact exploration through MCP.

## Fresh Clone

From the repo root:

```bash
bash scripts/setup-codegraph.sh --install-cli --target=codex,kiro
```

Defaults:

- `--target=auto`
- `--location=global`
- runs `codegraph install`
- runs `codegraph init -i`

If `codegraph` is already installed:

```bash
bun run setup:codegraph
```

## Useful Commands

```bash
bun run codegraph:index
bun run codegraph:status
```

The local index is stored in `.codegraph/` and is intentionally ignored by Git.
Restart the configured agent after setup so the MCP server is loaded.
