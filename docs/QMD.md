# QMD Setup

QMD is configured for simple local docs search.

## Collection

- Name: `profile-docs`
- Path: `docs/`
- Mask: `**/*.md`

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
