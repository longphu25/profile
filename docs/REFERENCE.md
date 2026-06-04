# Reference

This page collects external references and repo-level reference docs that should
be checked before changing documentation, setup, or agent workflow.

## External References

| Reference | Use for |
| --- | --- |
| https://github.com/hoangnb24/harness-experimental | Agent-ready repository harness structure: `HARNESS.md`, `FEATURE_INTAKE.md`, `ARCHITECTURE.md`, `TEST_MATRIX.md`, `product/`, `stories/`, `decisions/`, and `templates/`. |
| https://github.com/rtk-ai/rtk | RTK CLI proxy and Codex hook setup. |
| https://github.com/tobi/qmd | QMD local docs search and MCP server setup. |
| https://docs.sui.io/onchain-finance/deepbook-predict/ | DeepBook Predict protocol overview, manager flow, oracle lifecycle, vault, and Predict transaction context. |
| https://docs.sui.io/develop/publish-upgrade-packages/versioning#example-escrow-swap | Sui escrow swap example for atomic P2P exchange patterns. |
| https://docs.scallop.io/scallop-lend/start | Scallop bridge assets to Sui and user onboarding. |
| https://docs.scallop.io/protocol/oracles | Scallop oracle model and oracle freshness considerations. |
| https://docs.scallop.io/integrations/contract-integration/borrowing-function | Scallop borrowing flow and obligation-based integration. |
| https://docs.scallop.io/integrations/contract-integration/liquidation-function | Scallop liquidation flow and oracle update requirement. |

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
| `product/predict-club.md` | Predict Club product contract, roles, lifecycle, UI contract, and interface model. |
| `product/predict-club-architecture.md` | Predict Club architecture diagrams, planned file structure, and validation map. |
| `product/predict-club-escrow-contract.md` | Move contract plan for time-locked SUI escrow and generic USDC/DUSDC escrow exchange. |
| `product/predict-club-funding.md` | Funding Router for SUI, USDC, Scallop borrow, bridge handoff, and DUSDC escrow. |
| `stories/plans/13-predict-club-community.md` | Predict Club implementation story with clean architecture, SOLID, design patterns, diagrams, and validation. |
| `decisions/predict-club-architecture.md` | Hybrid custody decision and V2 group vault policy boundary. |
| `decisions/predict-club-funding-escrow.md` | P2P escrow decision for USDC to DUSDC club funding. |

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
- Added Predict Club product, story, and architecture decision docs based on the
  Harness task loop.
- Added Predict Club Funding Router and escrow exchange docs covering DeepBook
  SUI to USDC, Scallop borrow/liquidation/oracles, bridge handoff, and
  USDC-to-DUSDC P2P offers.
- Added Predict Club escrow contract planning docs covering time-locked SUI
  escrow, epoch release, approval caps, and generic `EscrowOffer<OfferT, WantT>`.
