# Documentation Map

This directory is organized as an agent-ready project harness, adapted from the
`harness-experimental` structure, while preserving the existing Obsidian vault
and domain deep dives.

## Start Here

- `INDEX.md`: vault-style knowledge base index.
- `REFERENCE.md`: external references and repo reference docs.
- `SETUP.md`: harness, RTK, QMD, and MCP setup.
- `HARNESS.md`: how humans and agents should use these docs during work.
- `FEATURE_INTAKE.md`: how to classify requests before implementation.
- `ARCHITECTURE.md`: architecture source-of-truth and boundary rules.
- `TEST_MATRIX.md`: validation expectations by work type.

## Harness Folders

- `product/`: current product contract and product-facing maps.
- `stories/`: story packets, roadmap slices, and historical plans.
- `decisions/`: durable decisions and tradeoffs.
- `templates/`: reusable story, decision, and validation formats.

## Domain Folders

- `deepbook/`: DeepBook trading, Predict, BTC chart, and on-chain finance docs.
- `defi/navi/`: NAVI dashboard, advisor, chatbot, MCP, and expansion docs.
- `seal/`: Seal encryption plugin and policy docs.
- `walrus/`: Walrus storage integration docs.
- `zklogin/`: zkLogin and ZK Merkle identity docs.
- `contracts/`: Move contract notes.

## Current Policy

Do not replace domain docs with a monolithic spec. Use `product/` for stable
product truth, `stories/` for scoped work, `decisions/` for why a direction was
chosen, and the existing domain folders for technical depth.

## Active Product Contracts

- `product/predict-club.md`: community DeepBook Predict coordination with
  leader-confirmed rounds, member self-sign execution, indicator consensus, and
  a future group-vault boundary.
- `product/predict-club-architecture.md`: architecture diagrams, runtime
  boundaries, planned file structure, and future Move package structure.
- `product/predict-club-escrow-contract.md`: Move package plan for time-locked
  SUI escrow and generic USDC/DUSDC exchange escrow.
- `product/predict-club-funding.md`: funding routes for members without DUSDC,
  including DeepBook SUI to USDC, Scallop borrowing, bridge handoff, and club
  escrow exchange.

## Recent Setup Updates

- Harness docs were added using `harness-experimental` as the organizing
  reference.
- `docs/plans/` was moved under `docs/stories/plans/`.
- QMD was configured for simple BM25 docs search via the `profile-docs`
  collection.
- QMD MCP was added to Codex global config as `qmd mcp`.
- QMD local GGUF model files were removed; use `qmd search` and `qmd get` for
  normal lookup.
- RTK was configured for Codex with `rtk init -g --codex`.
