# DeepBook Suite Modular Refactor + Interactive Predict Chart

## Summary

Refactor `deepbook.html` into the main reusable DeepBook Suite shell while splitting the current large Predict plugin into smaller domain modules and reusable sub-plugins.

This plan connects the prior Predict Assistant, Predict Manager bot architecture, range-aware data, and interactive chart plans into an implementation sequence.

Primary goals:

- Keep `deepbook.html` as the main user-facing suite.
- Keep `sui-deepbook-predict.html` working as a focused Predict demo.
- Reduce `plugins/sui-deepbook-predict/plugin.tsx` into a thin plugin entry.
- Extract shared domain, data, chart, and transaction logic for reuse across DeepBook pages and plugins.
- Add interactive chart-based position selection and minted-position overlays.

## Current Context

Existing entry points:

- `deepbook.html` loads `src/deepbook/main.tsx`.
- `src/deepbook/DeepBookSuite.tsx` owns DAppKit, SuiHostAPI, grouped nav, lazy plugin loading, and Shadow DOM rendering.
- `sui-deepbook-predict.html` remains the focused Predict page.
- `plugins/sui-deepbook-predict/plugin.tsx` is still large and owns orchestration, data fetching, inline panels, transaction logic, and tab routing.

Existing reusable pieces:

- `src/sui-dashboard/sui-host.ts` for wallet/shared data/actions.
- `src/plugins/ShadowContainer.tsx` for style isolation.
- `plugins/sui-deepbook-predict/components/*` for many tabs.
- `plugins/sui-deepbook-predict/strategies/*` for pure strategy simulations.
- `plugins/sui-deepbook-predict/oracleService.ts` and hooks for shared oracle state.
- `docs/stories/plans/10-interactive-predict-position-chart.md` for chart interaction behavior.

## Target Architecture

Use a clean architecture split:

```text
plugins/sui-deepbook-predict/
  plugin.tsx                  # thin entry: register component only
  app/
    PredictPluginRoot.tsx     # composition, providers, tab routing
    predictTabs.ts            # tab config
  domain/
    constants.ts
    types.ts
    strike.ts                 # snap/validate strike and range
    svi.ts                    # SVI, fair value, butterfly checks
    positions.ts              # range netting, overlay mapping
  data/
    predictRepository.ts      # Predict server endpoints
    managerRepository.ts      # manager/portfolio/range reads
    walletRepository.ts       # DUSDC coin reads
  application/
    usePredictMarket.ts
    useTradeForm.ts
    usePositionOverlays.ts
    tradeActions.ts           # build PTBs; no React
  presentation/
    market/
    trade/
    portfolio/
    surface/
    vault/
    keeper/
    chart/
    shared/
  style.css
```

DeepBook Suite shell split:

```text
src/deepbook/
  DeepBookSuite.tsx           # shell composition only
  config/
    plugins.ts                # DeepBookPluginDef registry
    nav.ts
  components/
    DeepBookWorkspace.tsx     # plugin load/render/error states
    DeepBookNav.tsx
    WalletBar.tsx
    RightRail.tsx
  MissionControl.tsx
```

## Key Changes

### Suite Shell

- Move plugin registry and nav groups out of `DeepBookSuite.tsx`.
- Create a reusable workspace component for lazy-loading plugins and rendering them inside `ShadowContainer`.
- Keep wallet connection and transaction signing at the suite/page host level.
- Keep standalone pages working; do not remove `sui-deepbook-predict.html` or `sui-deepbook-hedging-bot.html`.

### Predict Plugin

- Convert `plugin.tsx` into a minimal plugin entry:
  - import `PredictPluginRoot`
  - validate `SuiHostAPI`
  - initialize services/hooks host
  - register `SuiDeepBookPredict`
  - cleanup on unmount
- Move inline helpers and duplicate constants into domain modules.
- Move Predict server fetches into repositories.
- Move transaction construction out of components into action services.
- Keep React panels focused on rendering and dispatching user intent.

### Interactive Position Chart

- Add a reusable `PredictPositionChart`.
- Use chart clicks to fill binary strike and infer `UP` or `DOWN`.
- Use range drag to fill lower/upper strikes.
- Overlay open binary and range positions.
- Treat chart actions as state selection only; execution remains wallet-signed.

### Range-Aware Data

- Add position overlay data service that merges:
  - `/managers/:manager_id/positions/summary`
  - `/ranges/minted?manager_id=...`
  - `/ranges/redeemed?manager_id=...`
  - oracle-scoped range endpoints when rendering oracle-level charts
- Do not rely on `/positions/minted` or `/trades/:oracle_id` for range positions.
- Surface data quality state when range data fails or is delayed.

## Implementation Sequence

### Step 1 — Low-Risk Suite Extraction

Start here.

- Extract `src/deepbook/config/plugins.ts` and `src/deepbook/config/nav.ts`.
- Extract `DeepBookWorkspace`, `DeepBookNav`, `WalletBar`, and `RightRail`.
- Keep behavior identical.
- Verify `deepbook.html` and plugin loading still work.

Reason:

- It reduces shell complexity without touching Predict transaction behavior.
- It gives a stable reusable plugin workspace before splitting Predict.

### Step 2 — Predict Domain/Data Extraction

- Move constants, SVI math, strike snapping, fair value, range netting, and Predict server fetches into pure modules.
- Keep UI behavior unchanged.
- Add narrow unit-like tests where practical for pure functions.

Reason:

- This creates reusable building blocks for chart overlays and sub-plugins.

Status:

- Completed in `plugins/sui-deepbook-predict/domain/*` and `plugins/sui-deepbook-predict/data/*`.
- `types.ts`, `sdk.ts`, and `strategies/svi.ts` now act as compatibility exports so existing imports continue to work.
- `PortfolioTab`, `GuidedTrade`, `KeeperTab`, `MarginLoopTab`, `ArbTab`, `oracleService`, and `usePredictData` now consume repositories/domain helpers instead of duplicating Predict server calls or SVI/range logic.
- Added `plugins/sui-deepbook-predict/domain/domain.test.js` for strike snapping, range netting, and fair-value bounds.

### Step 3 — Thin Predict Plugin Entry

- Move `PredictContent` into `app/PredictPluginRoot.tsx`.
- Move tab config into `app/predictTabs.ts`.
- Ensure `plugin.tsx` only registers the component and lifecycle hooks.

Reason:

- This directly addresses the large `plugin.tsx` problem while preserving the current UX.

Status:

- Completed with `plugins/sui-deepbook-predict/plugin.tsx` reduced to the plugin lifecycle and component registration entry.
- Moved the Predict React root to `plugins/sui-deepbook-predict/app/PredictPluginRoot.tsx`.
- Moved primary/advanced tab config to `plugins/sui-deepbook-predict/app/predictTabs.ts`.
- Added `setPredictPluginHost` so lifecycle wiring remains in `plugin.tsx` while React composition stays in the app layer.
- Fixed Shepherd type imports in `hooks/useTour.ts` so the extracted root can typecheck.

### Step 4 — Interactive Predict Chart

- Add `lightweight-charts@4.2.0` as a dependency during implementation.
- Build `PredictPositionChart` and `usePositionOverlays`.
- Embed the chart above the Trade form.
- Add a read-only overlay mode in Portfolio after Trade chart works.

Reason:

- The chart depends on the domain/data split from steps 2-3.

Status:

- Trade chart integration completed with `plugins/sui-deepbook-predict/components/chart/PredictPositionChart.tsx`.
- Added `plugins/sui-deepbook-predict/application/usePositionOverlays.ts` to merge binary positions and range positions for oracle-level overlays.
- Chart click in binary mode fills strike and infers UP/DOWN from current spot.
- Chart vertical drag in range mode fills lower/upper strikes.
- Open binary and range positions render over the Trade chart using range-aware manager data.
- `lightweight-charts@4.2.0` added as a dependency.
- Portfolio read-only overlay mode remains a follow-up after the Trade chart is visually verified.

### Step 5 — Optional Sub-Plugin Split

After the root Predict plugin is stable, expose reusable sub-components as separate plugin entries if needed:

- `SuiDeepBookPredictChart`
- `SuiDeepBookPredictPortfolio`
- `SuiDeepBookPredictKeeper`
- `SuiDeepBookPredictSurface`

Reason:

- Avoid premature plugin fragmentation before shared domain modules are stable.

## Public Interfaces / Types

Shared plugin config:

```ts
interface DeepBookPluginDef {
  id: string
  componentName: string
  label: string
  src: string
  styleUrl: string
  group: 'home' | 'trade' | 'predict' | 'portfolio' | 'bots' | 'rewards' | 'advanced'
  status: 'live' | 'simulated' | 'coming-soon'
}
```

Interactive chart state:

```ts
type ChartPickMode = 'binary' | 'range'
type PositionOverlayStatus = 'open' | 'awaiting-settlement' | 'settled' | 'claimable'

type ChartPositionSelection =
  | { mode: 'binary'; strike: number; isUp: boolean }
  | { mode: 'range'; lowerStrike: number; upperStrike: number }

interface PositionOverlay {
  id: string
  kind: 'binary' | 'range'
  oracleId: string
  quantity: number
  status: PositionOverlayStatus
  strike?: number
  isUp?: boolean
  lowerStrike?: number
  upperStrike?: number
}
```

## Test Plan

- `deepbook.html` loads, wallet connect works, and grouped navigation still switches plugins.
- `sui-deepbook-predict.html` still renders focused Predict.
- Production plugin paths still resolve after `rtk bun run build`.
- `SuiDeepBookPredict` registers from thin `plugin.tsx`.
- Existing Market, Surface, Risk, Trade, Vault, Portfolio, Keeper flows still render.
- Chart click above/below spot updates binary strike and `UP/DOWN`.
- Range drag updates lower/upper strikes with snapping and validation.
- Open binary and range positions render as overlays without double-counting redeemed ranges.
- Range endpoint failure shows a clear degraded data state.
- Wallet disconnected users can plan positions but cannot execute.
- Desktop/mobile layouts avoid chart/form overlap.

## Backlog (Prioritized)

### P0 — Blocks demo or causes bugs

- [ ] 1. Visual QA chart (PredictPositionChart + PredictPluginRoot chart integration)
- [ ] 11. Chart degraded/stale data states
- [ ] 18. Regression checklist

### P1 — Improves code quality and enables next steps

- [ ] 2. Tách TradePanel ra khỏi PredictPluginRoot
- [ ] 3. Tách Vault tab ra khỏi PredictPluginRoot
- [ ] 4. Tách SurfaceStudio khỏi PredictPluginRoot
- [ ] 5. Tách PLPRiskDashboard khỏi PredictPluginRoot
- [x] 6. Nâng usePositionOverlays lên repository/service
- [ ] 7. Test usePositionOverlays
- [x] 8. Test domain/positions.ts và domain/strike.ts
- [ ] 12. Tách transaction builders khỏi UI handlers
- [ ] 13. TradePanel controlled state + action service

### P2 — Nice-to-have polish

- [ ] 9. Chuẩn hóa render-time Date.now()
- [ ] 10. Portfolio tab overlay read-only
- [ ] 16. Clean architecture layers (composition/application/presentation)
- [ ] 17. Click-to-select + drag-to-sculpt in Portfolio + Guided Trade
- [ ] 19. Commit rhythm docs
- [x] 20. Convert to backlog in plan 11

## Assumptions

- `deepbook.html` remains the primary suite entry.
- `sui-deepbook-predict.html` remains available for a focused Predict demo.
- Chart interactions prepare form state only.
- Range trade data remains split from binary trade endpoints for v1.
- Implementation is user-facing and should bump `package.json` minor version before commit.
