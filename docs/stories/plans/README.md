# Story Plans Index

This folder collects story-sized planning material for the DeepBook / Predict /
TaskOS direction. It lives under `docs/stories/` because these files describe
candidate work slices, roadmap order, and implementation packets.

## Files

| File | Purpose |
|---|---|
| [01-deepbook-predict-hackathon.md](01-deepbook-predict-hackathon.md) | Submission plan for DeepBook Predict Command Center. |
| [02-deepbook-predict-ux.md](02-deepbook-predict-ux.md) | UX plan to reduce user actions and improve first-time user experience. |
| [03-deepbook-app-suite-trend-predict.md](03-deepbook-app-suite-trend-predict.md) | DeepBook multi-app roadmap with gamification and Trend Predict. |
| [04-deepbook-static-plugin-split.md](04-deepbook-static-plugin-split.md) | Recommended static HTML page and plugin split strategy. |
| [05-commander-taskos.md](05-commander-taskos.md) | Commander / TaskOS product model for mission-based interaction. |
| [06-work-breakdown.md](06-work-breakdown.md) | Work packages, priorities, and implementation sequencing. |
| [07-hashi-suilink-later.md](07-hashi-suilink-later.md) | Later-stage Hashi + SuiLink BTC credit onboarding plan. |
| [08-deepbook-predict-user-assist.md](08-deepbook-predict-user-assist.md) | Predict user-assistance layer combining BTC market context, guided trade, PLP risk, and keeper prompts. |
| [09-predict-manager-bot-architecture.md](09-predict-manager-bot-architecture.md) | Non-custodial bot architecture for user PredictManager monitoring, user-signed PTBs, keepers, and future vault automation. |
| [10-interactive-predict-position-chart.md](10-interactive-predict-position-chart.md) | Interactive Predict chart for click-to-select binary strikes, drag-to-select ranges, and minted position overlays. |
| [11-deepbook-suite-modular-refactor.md](11-deepbook-suite-modular-refactor.md) | Refactor plan for `deepbook.html`, reusable plugin modules, thin Predict plugin entry, clean architecture, and chart integration. |
| [12-deepbook-predict-standalone-chart-trading.md](12-deepbook-predict-standalone-chart-trading.md) | Standalone `deepbook-predict.html` plan with BTC-chart-style host, wallet wiring, chart trade popup, DUSDC preview, and existing-position overlays. |
| [13-predict-club-community.md](13-predict-club-community.md) | Predict Club community workflow plan with leader proposals, member self-sign execution, clean architecture, and future group vault boundary. |
| [14-predict-club-contract-integration.md](14-predict-club-contract-integration.md) | Next steps for deploying predict-club contracts to testnet, wiring codegen bindings into the plugin, and completing the end-to-end escrow + exchange flow. |
| [15-swap-scallop-integration.md](15-swap-scallop-integration.md) | Swap and Scallop integration plan for Predict Club funding routes. |
| [16-predict-club-wallet-profile-popup.md](16-predict-club-wallet-profile-popup.md) | Implemented wallet profile popup for Predict Club, including shared Predict context, popup performance fixes, and Fast Refresh guardrails. |
| [17-scallop-plugin-extraction.md](17-scallop-plugin-extraction.md) | Extract Scallop borrow into standalone `sui-scallop` plugin, mount into predict-club via Host Component Registry. |
| [18-predict-club-quick-predict.md](18-predict-club-quick-predict.md) | Quick Predict entry flow for faster round creation and prediction actions. |
| [19-predict-club-ui-roadmap.md](19-predict-club-ui-roadmap.md) | Step-by-step roadmap for finishing the Predict Club interface, data contracts, risk/exposure, wallet UX, portfolio/vaults, funding, lifecycle, tests, and docs. |
| [20-swap-multi-route-aggregator.md](20-swap-multi-route-aggregator.md) | Multi-route swap aggregator plan for best-execution funding across DeepBook and other Sui liquidity sources. |
| [21-predict-club-ui-redesign.md](21-predict-club-ui-redesign.md) | Predict Club UI redesign (R1-R8): multi-region `next/` cockpit layout, superseded by plan 22. |
| [22-predict-club-cockpit-rebuild.md](22-predict-club-cockpit-rebuild.md) | Chart-king pro cockpit rebuild (C0-C7): one focal chart, docked action rail, custom SVG king chart, mobile hero + sheet. |
| [23-predict-vol-surface-studio.md](23-predict-vol-surface-studio.md) | Decision-support terminal: a dedicated vol-surface Studio (IV heatmap + smile + mispricing/IV-vs-realized/arb-free edge) plus a cockpit mispricing badge and deploy-ready CORS fix. |

## Recommended Build Order

1. Build the DeepBook shell and navigation model.
2. Add Mission Control and recommended actions.
3. Improve Predict UX with guided trade.
4. Add gamified quests and local achievements.
5. Add Trend Predict signal lab and backtest workflow.
6. Expand into Commander TaskOS command routing.
7. Add Hashi + SuiLink BTC credit onboarding after the DeepBook shell is stable.
8. Add the Predict Assistant layer to guide new users through fund, trade, monitor, and claim decisions.
9. Add non-custodial bot support for PredictManager monitoring and settled-position keeper flows.
10. Add interactive chart-based position picking and position overlays for binary and range Predict positions.
11. Refactor the DeepBook Suite and Predict plugin into reusable clean-architecture modules before broader sub-plugin splitting.
12. Add the standalone DeepBook Predict page with chart-click DUSDC trade popup and wallet-scoped position overlays.
13. Add Predict Club as a community coordination page with leader-confirmed rounds, indicator consensus, and member self-sign execution.
14. Deploy predict-club contracts to testnet, wire TypeScript bindings into the plugin, and complete the end-to-end escrow + exchange funding flow.
15. Integrate swap and Scallop funding routes where they are safe and wallet-signed.
16. Maintain the Predict Club wallet profile popup and keep the Fast Refresh split between provider, context core, and hook files.
17. Extract Scallop borrow into standalone `sui-scallop` plugin and mount back into predict-club via Host Component Registry for cross-plugin reuse.
18. Keep Quick Predict aligned with the main Predict Club flow so shortcuts do not bypass risk or quote checks.
19. Execute the Predict Club UI roadmap in phases: data contract, decision strip, risk/exposure, wallet/address UX, portfolio/vaults, funding, lifecycle, and tests/docs hardening.
20. Add a multi-route swap aggregator for best-execution funding across DeepBook and other Sui liquidity sources.
21. Redesign the Predict Club UI into a multi-region `next/` cockpit (R1-R8), later superseded by plan 22.
22. Rebuild the cockpit chart-king and pro-first (C0-C7): one focal price chart, a single docked action rail, custom SVG king chart, mobile hero + action sheet.
23. Add the decision-support layer: a dedicated vol-surface Studio (IV heatmap + smile + mispricing/IV-vs-realized/arb-free edge), a cockpit mispricing badge, and a deploy-ready CORS fix.
