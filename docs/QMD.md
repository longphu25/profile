# QMD Setup

QMD is configured for simple local docs search.

## Collection

- Name: `profile-docs`
- Path: `docs/`
- Mask: `**/*.md`
- Scope: English source docs and Vietnamese `*.vi.md` translations.

## Preferred Commands

```bash
qmd search "plugin architecture" -c profile-docs
qmd get qmd://profile-docs/ARCHITECTURE.md
qmd update
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
