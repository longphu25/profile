# Setup

This page records repo-level setup for agents and local documentation search.

## Agent Harness

Read these docs first when starting documentation or implementation work:

1. `docs/README.md`
2. `docs/HARNESS.md`
3. `docs/FEATURE_INTAKE.md`
4. `docs/ARCHITECTURE.md`
5. `docs/TEST_MATRIX.md`
6. `docs/ORGANIZATION.md`

Use these folders consistently:

- `docs/product/`: stable product truth.
- `docs/stories/`: scoped plans, story packets, and roadmap slices.
- `docs/decisions/`: durable tradeoffs and architecture decisions.
- `docs/demo/`: small repository-harness flow example.
- `docs/templates/`: reusable formats for stories, decisions, and validation.

Keep root-level repo maps and shared plugin/runtime architecture in `docs/`
root. See `docs/ORGANIZATION.md` before moving documentation files.

## RTK

RTK is installed and configured for Codex.

```bash
rtk --version
rtk init -g --codex
rtk gain
```

Current observed binary:

```text
/usr/local/bin/rtk
```

## QMD

QMD is installed and configured for simple local docs search.

```bash
qmd --version
qmd collection list
qmd search "plugin architecture" -c profile-docs
qmd get qmd://profile-docs/ARCHITECTURE.md
qmd update
```

Current collection:

```text
profile-docs
Path: docs/
Mask: **/*.md
```

This collection intentionally includes both English `.md` files and Vietnamese
`*.vi.md` translations.

Use `qmd search` and `qmd get` for normal work. Do not run `qmd query`,
`qmd vsearch`, or `qmd embed` unless a task explicitly requires local models.

## QMD MCP

Codex global config contains:

```toml
[mcp_servers.qmd]
command = "qmd"
args = [ "mcp" ]
enabled = true
```

The MCP `query` tool defaults to reranking. If using that tool, pass
`rerank: false` to keep the setup model-free. Prefer CLI `qmd search` for
ordinary docs lookup.

Restart Codex after changing `~/.codex/config.toml` so the MCP server list is
reloaded.

Kiro workspace MCP config is stored in:

```text
.kiro/settings/mcp.json
```

Kiro steering files:

```text
.kiro/steering/harness-factory.md
.kiro/steering/qmd.md
.kiro/steering/rtk.md
```

Project-local Harness Factory skill:

```text
.agents/skills/harness-factory/SKILL.md
```

## QMD Model Policy

Cached QMD GGUF model files were removed from:

```text
~/.cache/qmd/models/
```

`qmd status` can still display upstream default model URLs. That does not mean
models are present locally. Check the cache directory if in doubt.
