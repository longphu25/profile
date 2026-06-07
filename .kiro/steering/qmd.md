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

## Search Tips for Accurate Results

Use these query patterns for best recall:

| Looking for | Query example |
|-------------|---------------|
| Predict Club product spec | `"predict-club" product round lifecycle` |
| Escrow contract design | `"escrow" contract time-locked generic` |
| Funding routes | `"funding" route USDC DUSDC swap scallop` |
| Architecture decisions | `"decision" predict-club vault custody` |
| Story/plan by number | `"plan 14" contract integration` |
| Plugin development | `"plugin" architecture shadow DOM host` |
| DeepBook swap | `"deepbook" swap SUI_USDC orderbook` |
| Scallop borrow | `"scallop" borrow collateral obligation` |
| Move contract patterns | `"escrow.move" OR "exchange" composable` |

## Key Document Paths

| Topic | Path |
|-------|------|
| Product contracts | `docs/product/predict-club*.md` |
| Architecture diagrams | `docs/product/predict-club-architecture.md` |
| Escrow contract spec | `docs/product/predict-club-escrow-contract.md` |
| Funding router | `docs/product/predict-club-funding.md` |
| Story plans (14-15) | `docs/stories/plans/14-*.md`, `docs/stories/plans/15-*.md` |
| Contract source docs | `contracts/predict-club/docs/ARCHITECTURE.md` |
| Decisions | `docs/decisions/predict-club-*.md` |
| INDEX (master map) | `docs/INDEX.md` |
