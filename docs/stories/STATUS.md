# Story Status Index

Uniform status snapshot for plans under `plans/`. Update the row when a story's
state changes. States: `planned` | `in-progress` | `done` | `unknown`.

`unknown` means the plan file has no machine-readable status field yet; add one
(`**Status:**` line) next time the story is touched.

| Story | State | Notes |
| --- | --- | --- |
| 01-deepbook-predict-hackathon | done | Hackathon predict shipped |
| 02-deepbook-predict-ux | done | UX pass shipped |
| 03-deepbook-app-suite-trend-predict | done | Suite + trend predict live |
| 04-deepbook-static-plugin-split | done | Static plugin split landed |
| 05-commander-taskos | unknown | No status field; verify before reuse |
| 06-work-breakdown | unknown | Planning doc |
| 07-hashi-suilink-later | planned | Deferred (SuiLink later) |
| 08-deepbook-predict-user-assist | unknown | Verify before reuse |
| 09-predict-manager-bot-architecture | unknown | Architecture note |
| 10-interactive-predict-position-chart | done | Position chart shipped |
| 11-deepbook-suite-modular-refactor | done | Modular refactor landed |
| 12-deepbook-predict-standalone-chart-trading | unknown | Verify before reuse |
| 13-predict-club-community | done | State: implemented |
| 14-predict-club-contract-integration | done | Contract integration landed |
| 15-swap-scallop-integration | done | Scallop swap integrated |
| 16-predict-club-wallet-profile-popup | done | State: implemented |
| 17-scallop-plugin-extraction | done | Phase 1 & 2 complete (v0.44.0) |
| 18-predict-club-quick-predict | done | All phases complete |
| 19-predict-club-ui-roadmap | in-progress | UI roadmap ongoing |
| 20-swap-multi-route-aggregator | done | Multi-route + WASM shipped (v0.52.0) |

## Recent harness/infra work not yet storied

These shipped via direct patches; create a story only if they grow:

- DeepBook swap WASM kernels (`plugins/sui-swap/wasm`) — see `docs/defi/wasm-candidates.md`
- btc-chart SMC WASM (`plugins/btc-chart/wasm`)
- predict-club indicator WASM (`plugins/predict-club/wasm`)
- predict-club RPC cache + CORS proxy + Binance ref — see `docs/defi/rpc-cors-and-wallet.md`
- Self-hosted Satoshi font — see `docs/defi/self-host-fonts.md`
