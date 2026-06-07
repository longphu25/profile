# Plan 17 — Scallop Plugin Extraction & Cross-Plugin Mount

## Status: ✅ Phase 1 & 2 Complete (v0.44.0, commit `e7d63dc`)

| Phase | Status |
|-------|--------|
| Phase 1: Create sui-scallop plugin skeleton | ✅ Done |
| Phase 2: Wire into predict-club via host | ✅ Done |
| Phase 3: Enhance standalone value | 🔲 TODO |
| Phase 4: Test & document | 🔲 TODO |

## Goal

Extract the Scallop borrow functionality from `predict-club` into a standalone
`sui-scallop` plugin. Mount it back into predict-club via the Host Component
Registry pattern, enabling reuse across other pages/plugins.

## Motivation

- **Reusability:** Other plugins (sui-deepbook-predict, wallet-profile) could
  embed Scallop borrow/health without depending on predict-club
- **Separation of concerns:** Scallop SDK initialization, obligation management,
  and health monitoring are domain-independent
- **Plugin boundary:** Scallop has its own API, rates, and lifecycle — deserves
  its own plugin like `sui-lending` (read-only) vs `sui-scallop` (write)
- **Testing:** Independent unit tests without predict-club context

## Architecture

```
plugins/sui-scallop/              ← New standalone plugin
├── plugin.tsx                    ← Registers ScallopBorrow, ScallopHealthBadge
├── domain/
│   └── policies.ts              ← canBorrowSafely, MIN_HEALTH_FACTOR
├── infrastructure/
│   └── scallopGateway.ts        ← getHealthFactor, buildBorrowUsdcTx
├── application/
│   └── borrowUsdc.ts            ← Use case with health check
├── presentation/
│   ├── ScallopBorrowPanel.tsx   ← Full borrow UI (collateral input, rates, execute)
│   └── ScallopHealthBadge.tsx   ← Compact health factor badge for embedding
└── style.css

plugins/predict-club/
├── infrastructure/
│   └── scallopGateway.ts        ← DELETE (moved)
├── application/
│   └── borrowUsdc.ts            ← DELETE (moved)
├── domain/
│   └── policies.ts              ← REMOVE canBorrowSafely (moved)
└── presentation/
    └── ModalLayer.tsx            ← Use host.getComponent('ScallopBorrow')
```

## Mount Strategy: Host Component Registry (Option A)

### sui-scallop registers

```typescript
// plugins/sui-scallop/plugin.tsx
const ScallopPlugin: Plugin = {
  name: 'SuiScallop',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-scallop/style.css'],

  init(host: HostAPI) {
    host.registerComponent('ScallopBorrow', ScallopBorrowPanel)
    host.registerComponent('ScallopHealthBadge', ScallopHealthBadge)
    host.log('SuiScallop plugin initialized')
  },
  mount() {},
  unmount() {},
}
```

### predict-club consumes

```typescript
// In ModalLayer.tsx, for 'scallop-borrow' modal:
const ScallopBorrow = host?.getComponent('ScallopBorrow') as ComponentType<ScallopBorrowPanelProps> | null

if (ScallopBorrow) {
  return <ScallopBorrow
    walletAddress={address}
    signAndExecute={(tx) => host.signAndExecuteTransaction(tx)}
    onSuccess={(digest) => { store.setToast(`Borrowed — ${digest.slice(0,12)}…`); setModal(null) }}
    onError={(err) => store.setToast(err)}
    maxCollateralSui={balances.sui - 1.5}
  />
} else {
  // Fallback: show "Install SuiScallop plugin" message
}
```

### Page load order

```typescript
// src/predict-club/PredictClubPage.tsx
const SCALLOP_PLUGIN: PluginEntry = {
  id: 'sui-scallop', name: 'SuiScallop',
  src: pluginPath('sui-scallop'),
  styleUrl: '/plugins/sui-scallop/style.css',
}

// Load in order: wallet → scallop → predict-club
for (const entry of [WALLET_PLUGIN, SCALLOP_PLUGIN, PREDICT_PLUGIN]) { ... }
```

## Interface Contract

```typescript
// Props passed from predict-club → ScallopBorrowPanel
interface ScallopBorrowPanelProps {
  walletAddress: string
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  onSuccess?: (digest: string) => void
  onError?: (error: string) => void
  maxCollateralSui?: number  // capped by caller (e.g. balance - gas reserve)
}

// Props for ScallopHealthBadge
interface ScallopHealthBadgeProps {
  walletAddress: string
  className?: string
}
```

## Communication Pattern

**Data flow:** One-way via props (parent → child).
No shared state needed — predict-club passes `signAndExecute` callback,
Scallop plugin executes and reports back via `onSuccess`/`onError`.

**Balance refresh:** After `onSuccess`, predict-club refreshes wallet balances
via existing `fetchWalletBalances` polling (already 30s interval + triggered on tx).

## Tasks (Ordered)

### Phase 1: Create sui-scallop plugin skeleton

- [ ] Create `plugins/sui-scallop/` directory
- [ ] Move `scallopGateway.ts` from predict-club/infrastructure
- [ ] Move `borrowUsdc.ts` from predict-club/application  
- [ ] Move `canBorrowSafely` + `MIN_HEALTH_FACTOR` from predict-club/domain/policies
- [ ] Create `plugin.tsx` with init/mount/unmount
- [ ] Create `ScallopBorrowPanel.tsx` (extract from ModalLayer ScallopBorrowBody)
- [ ] Create `ScallopHealthBadge.tsx` (compact health factor display)
- [ ] Create `style.css`
- [ ] Verify build passes

### Phase 2: Wire into predict-club via host

- [ ] Add `SCALLOP_PLUGIN` entry to `PredictClubPage.tsx` load sequence
- [ ] Update ModalLayer to use `host.getComponent('ScallopBorrow')`
- [ ] Remove old `scallopGateway.ts` and `borrowUsdc.ts` from predict-club
- [ ] Remove `canBorrowSafely` from predict-club policies (keep other policies)
- [ ] Add fallback UI when scallop plugin not loaded
- [ ] Verify build passes

### Phase 3: Enhance standalone value

- [ ] Add Scallop market data fetch (borrow APY display)
- [ ] Add obligation list for existing positions
- [ ] Add health factor polling (every 30s when modal open)
- [ ] Add liquidation price estimate
- [ ] Wire `ScallopHealthBadge` into FundingRouterPanel

### Phase 4: Test & document

- [ ] Unit test `borrowUsdc` use case
- [ ] Unit test `canBorrowSafely` policy
- [ ] Integration test: plugin load order + component resolution
- [ ] Update docs/INDEX.md with sui-scallop plugin entry
- [ ] Update plugin-catalog docs

## Affected Files

| Action | File |
|--------|------|
| CREATE | `plugins/sui-scallop/plugin.tsx` |
| CREATE | `plugins/sui-scallop/domain/policies.ts` |
| CREATE | `plugins/sui-scallop/infrastructure/scallopGateway.ts` |
| CREATE | `plugins/sui-scallop/application/borrowUsdc.ts` |
| CREATE | `plugins/sui-scallop/presentation/ScallopBorrowPanel.tsx` |
| CREATE | `plugins/sui-scallop/presentation/ScallopHealthBadge.tsx` |
| CREATE | `plugins/sui-scallop/style.css` |
| MODIFY | `src/predict-club/PredictClubPage.tsx` (add plugin entry) |
| MODIFY | `plugins/predict-club/presentation/ModalLayer.tsx` (use host component) |
| MODIFY | `plugins/predict-club/presentation/PredictClubContext.tsx` (remove borrowUsdc action) |
| DELETE | `plugins/predict-club/infrastructure/scallopGateway.ts` |
| DELETE | `plugins/predict-club/application/borrowUsdc.ts` |
| MODIFY | `plugins/predict-club/domain/policies.ts` (remove canBorrowSafely) |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Plugin load order matters | Scallop loads before predict-club; fallback UI if missing |
| Props interface change breaks | Type-checked at compile time via shared types |
| Scallop SDK init is slow | Lazy init (first call), cached singleton |
| sui-lending plugin overlap | sui-lending = read-only market data; sui-scallop = write (borrow/repay) |

## Validation

- [ ] `bun run build` passes with no predict-club errors
- [ ] Scallop borrow button still works in predict-club modal
- [ ] ScallopHealthBadge renders in FundingRouterPanel
- [ ] Removing sui-scallop plugin shows graceful fallback (not crash)
- [ ] sui-scallop plugin works standalone on other pages (e.g. deepbook-predict)
