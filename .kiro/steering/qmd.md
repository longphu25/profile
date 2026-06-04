---
inclusion: always
---

# QMD MCP Policy

This workspace provides QMD through `.kiro/settings/mcp.json`.

Use the `qmd` MCP server for repo documentation lookup before broad filesystem
searches when the task involves docs, architecture, product plans, decisions, or
domain knowledge.

Project collection:

- `profile-docs`

Preferred lookup pattern:

1. Search within `profile-docs`.
2. Read the relevant matched document.
3. Fall back to shell search only when QMD does not return enough context.

For shell commands, still follow the RTK policy and prefix commands with `rtk`.
