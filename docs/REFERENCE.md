# Reference

This page collects external references and repo-level reference docs that should
be checked before changing documentation, setup, or agent workflow.

## External References

| Reference | Use for |
| --- | --- |
| https://github.com/hoangnb24/harness-experimental | Agent-ready repository harness structure: `HARNESS.md`, `FEATURE_INTAKE.md`, `ARCHITECTURE.md`, `TEST_MATRIX.md`, `product/`, `stories/`, `decisions/`, and `templates/`. |
| https://github.com/rtk-ai/rtk | RTK CLI proxy and Codex hook setup. |
| https://github.com/tobi/qmd | QMD local docs search and MCP server setup. |

## Repo Reference Docs

| Doc | Purpose |
| --- | --- |
| `README.md` | Documentation map and folder roles. |
| `INDEX.md` | Obsidian-style vault index. |
| `HARNESS.md` | Human-agent task loop and source hierarchy. |
| `FEATURE_INTAKE.md` | Request classification and risk lanes. |
| `ARCHITECTURE.md` | Architecture boundaries and source docs. |
| `TEST_MATRIX.md` | Validation expectations by work type. |
| `QMD.md` | Local docs search setup without local LLM model usage. |
| `SETUP.md` | Project harness, RTK, and QMD setup notes. |

## Latest Documentation Updates

- Added a Harness-style documentation layer adapted from
  `harness-experimental`.
- Added `docs/product/`, `docs/stories/`, `docs/decisions/`, and
  `docs/templates/` as stable harness folders.
- Moved DeepBook Predict planning material from `docs/plans/` to
  `docs/stories/plans/`.
- Added `docs/QMD.md` and configured QMD for simple BM25 search against
  `profile-docs`.
- Configured Codex global MCP server `qmd` with `qmd mcp`.
- Removed cached QMD GGUF model files so ordinary docs search does not depend on
  local LLM models.
- Configured RTK for Codex with `rtk init -g --codex`.
