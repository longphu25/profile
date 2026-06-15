---
inclusion: manual
---

# 9Router Codex Policy

This workspace may route Codex through the 9Router VPS when the user asks to
use 9Router or external model routing.

## Endpoint

- Base URL: `http://178.63.60.20:26650/v1`
- API shape: OpenAI-compatible `/v1/responses` and `/v1/models`
- Required env var: `NINE_ROUTER_API_KEY`
- Not an MCP server: `/mcp` is not available on this VPS

Do not store the API key in repository files.

## Codex Usage

Use the local Codex profile when running Codex through 9Router:

```bash
codex -p nine-router
codex exec -p nine-router "task"
```

If Kiro was launched before the key was exported, restart Kiro from an
environment that includes `NINE_ROUTER_API_KEY`. On macOS:

```bash
launchctl setenv NINE_ROUTER_API_KEY "..."
open -a Kiro
```

## Kiro Notes

Keep `.kiro/settings/mcp.json` focused on MCP servers such as `qmd` and `sui`.
Use 9Router as a model/provider endpoint, not as an MCP entry.

If a Kiro/Pencil Codex bridge asks for model endpoint fields, use:

- Base URL: `http://178.63.60.20:26650/v1`
- API key: value from `NINE_ROUTER_API_KEY`
- Model: a model listed by `/v1/models`
