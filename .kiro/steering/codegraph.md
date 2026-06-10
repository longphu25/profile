---
inclusion: always
---

# CodeGraph Policy

This workspace provides CodeGraph through the configured MCP server.

Use CodeGraph for source-code search, symbol lookup, and impact tracing before
falling back to shell search.

## Rule

Prefer `codegraph` MCP queries when you need to inspect source, find
definitions, trace references, or understand cross-file impact.

Use `rg` only for lightweight file discovery or when CodeGraph is unavailable.

## Notes

- Keep the local index current after major source changes.
- The index lives in `.codegraph/` and is ignored by Git.
- Docs lookup still uses `qmd`; CodeGraph is for source/code exploration.
