# QMD Setup

QMD is configured for simple local docs search.

## Collection

- Name: `profile-docs`
- Path: `docs/`
- Mask: `**/*.md`
- Scope: English source docs and Vietnamese `*.vi.md` translations.
- Context (collection root): Sui profile harness, btc-chart, Predict Club,
  Telegram Mini App, Turso, Convex, stories, and ADRs.

Check health:

```bash
bun run docs:status
qmd ls profile-docs/telegram
```

## Preferred Commands

```bash
qmd search "plugin architecture" -c profile-docs
qmd search "telegram auto-login Turso Convex" -c profile-docs
qmd get qmd://profile-docs/telegram/TECHNICAL.md
qmd get qmd://profile-docs/decisions/telegram-data-backend.md
qmd update
```

Repo shortcuts:

```bash
bun run docs:index    # re-index all collections (includes profile-docs)
bun run docs:status   # file counts and pending embeds
```

Use `qmd search` for BM25 keyword search and `qmd get` for retrieval. Avoid
`qmd query`, `qmd vsearch`, and `qmd embed` unless a task explicitly needs local
models.

## MCP

Codex global MCP config includes:

```toml
[mcp_servers.qmd]
command = "qmd"
args = [ "mcp" ]
enabled = true
```

If using the MCP `query` tool, pass `rerank: false` to avoid loading a reranker
model.

## Kiro MCP

Kiro workspace MCP config lives at:

```text
.kiro/settings/mcp.json
```

It exposes the same server:

```json
{
  "mcpServers": {
    "qmd": {
      "command": "/Users/longphu/.bun/bin/qmd",
      "args": ["mcp"],
      "disabled": false
    }
  }
}
```

Kiro steering also includes `.kiro/steering/qmd.md`, which tells Kiro to use
QMD for documentation lookup before broad filesystem search.

## Maintenance

Run this after adding, translating, moving, or deleting docs:

```bash
qmd update
qmd status
```

The `profile-docs` collection should include all Markdown files under `docs/`,
including `*.vi.md` translations.

After adding docs under `docs/telegram/`, `docs/decisions/`, or `docs/stories/`,
run `bun run docs:index` before expecting search hits.

## RTK pairing

In Kiro/Codex shells, prefix heavy commands with `rtk` per `.kiro/steering/rtk.md`:

```bash
rtk qmd search "trade setup confluence" -c profile-docs
rtk qmd get qmd://profile-docs/btc-chart/trade-setup.md
```

BM25 search (`qmd search`) does not need local GGUF models. Skip `qmd embed` unless
you explicitly want vector search (`qmd vsearch`).
