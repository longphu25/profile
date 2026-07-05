# QMD Setup

QMD is configured for simple local docs search.

## Collection

- Name: `profile-docs`
- Path: `docs/`
- Mask: `**/*.md`
- Scope: English source docs and Vietnamese `*.vi.md` translations.
- Indexed files: **270** Markdown files under `docs/` (must match `find docs -name '*.md' | wc -l`)
- Contexts (folder hints for search ranking):

| QMD path | Topics |
|----------|--------|
| `qmd://profile-docs/` | Harness root: INDEX, HARNESS, product, bilingual policy |
| `qmd://profile-docs/telegram/` | Mini App, auto-login, Turso/Convex, ROADMAP |
| `qmd://profile-docs/btc-chart/` | Chart plugin, Trade Setup, ML, WASM, Turso coins |
| `qmd://profile-docs/agents/` | Grok VPS, GitHub workers, Cursor IDE |
| `qmd://profile-docs/decisions/` | ADRs (telegram-data-backend, exchange backend, …) |
| `qmd://profile-docs/stories/` | Story plans, STATUS.md (plan 24 telegram) |

Check health (counts must match):

```bash
find docs -name '*.md' | wc -l
bun run docs:status
qmd collection show profile-docs
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
bun run docs:index    # qmd update + restore folder contexts (scripts/qmd-profile-docs-context.sh)
bun run docs:context  # re-apply contexts only (after fresh QMD install)
bun run docs:status   # file counts and pending embeds
```

Folder contexts are stored in `~/.cache/qmd/index.sqlite`, not in git. Run
`bun run docs:context` on a new machine after `qmd collection add` for profile-docs.

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

After adding, moving, or deleting docs, run:

```bash
bun run docs:index
find docs -name '*.md' | wc -l   # should equal profile-docs file count in docs:status
```

If counts diverge, run `qmd update` again. Do not expect search hits until the
index reports the same file total as `find`.

## RTK pairing

In Kiro/Codex shells, prefix heavy commands with `rtk` per `.kiro/steering/rtk.md`:

```bash
rtk qmd search "trade setup confluence" -c profile-docs
rtk qmd get qmd://profile-docs/btc-chart/trade-setup.md
```

BM25 search (`qmd search`) does not need local GGUF models. Skip `qmd embed` unless
you explicitly want vector search (`qmd vsearch`).
