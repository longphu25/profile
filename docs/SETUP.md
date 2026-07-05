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
Files: ~270 (run bun run docs:status for live count)
Context: collection-root summary for harness, btc-chart, telegram, Turso, Convex
```

Repo shortcuts:

```bash
bun run docs:index
bun run docs:status
```

This collection intentionally includes both English `.md` files and Vietnamese
`*.vi.md` translations.

Use `qmd search` and `qmd get` for normal work. Do not run `qmd query`,
`qmd vsearch`, or `qmd embed` unless a task explicitly requires local models.

## CodeGraph

CodeGraph is installed and configured for source-code search and impact tracing.

```bash
codegraph status
codegraph init -i
```

When working in source, prefer CodeGraph MCP/search over `rg` if the agent
environment supports it. Use `rg` only for lightweight file discovery or when
CodeGraph is unavailable.

The local index is stored in `.codegraph/` and is ignored by Git.

## 9Router for Codex and Kiro

The project can use the 9Router VPS as an OpenAI-compatible remote API:

```text
Base URL: http://178.63.60.20:26650/v1
Required env: NINE_ROUTER_API_KEY
```

The VPS exposes `/v1/models` and `/v1/responses`; both require an API key. It
does not expose a direct MCP endpoint at `/mcp`, so do not add it to
`.kiro/settings/mcp.json` as an MCP server.

Codex has a local profile:

```text
~/.codex/nine-router.config.toml
```

Use it from a terminal that has the key exported:

```bash
export NINE_ROUTER_API_KEY="..."
codex -p nine-router
codex exec -p nine-router "summarize this repo"
```

For Kiro, the important detail is environment inheritance. If Kiro is already
open, it will not see a new shell export. On macOS, set the env for GUI apps
before launching Kiro:

```bash
launchctl setenv NINE_ROUTER_API_KEY "..."
open -a Kiro
```

If a Kiro/Pencil Codex bridge asks for model endpoint fields, use:

```text
Base URL: http://178.63.60.20:26650/v1
API key: value from NINE_ROUTER_API_KEY
Model: a model returned by /v1/models
```

Keep the API key out of repository files. Only commit non-secret steering,
setup, or wrapper instructions.

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
