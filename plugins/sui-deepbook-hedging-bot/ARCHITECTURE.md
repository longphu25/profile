# sui-deepbook-hedging-bot — Plugin Architecture

## Overview

Client-side browser bot chạy margin hedging cycles trên DeepBook v3.
Import 2 private keys → auto-create MarginManager → open/hold/close cycles → earn points.

**Entry**: `sui-deepbook-hedging-bot.html` → `plugin.tsx`
**Stack**: React + @mysten/sui v2 + @mysten/deepbook-v3 + Vite
**Build**: `bun run build` (tsc -b && vite build)

---

## File Structure

```
plugins/sui-deepbook-hedging-bot/
│
├── plugin.tsx           (3421 lines) — Main React component + plugin export
│   ├── State: keys, config, bot lifecycle, balances, UI tabs
│   ├── Inline strategies: directional, maker, volume (not yet wired to extracted)
│   ├── Wired: margin strategy (delegates to strategies/margin.ts)
│   ├── Bot control: start(), stop(), autoBalance()
│   ├── Manager setup: ensureBalanceManager(), ensureMarginManager()
│   └── UI: 3 tabs (setup, dashboard, accounts) + left sidebar (orderbook)
│
├── types.ts             (99 lines) — Shared types & constants
│   ├── INDEXER, RPC — endpoint URLs
│   ├── BotStage, BotStrategy, BotConfig — bot state types
│   ├── LogEntry, CycleRecord, OBLevel, WalletBalance, MmBalances
│   ├── DEFAULT_CONFIG — default bot settings (matches depbuk-hedging)
│   └── StrategyDeps — dependency injection interface for strategies
│
├── utils.ts             (64 lines) — Pure helper functions
│   ├── formatUsd, formatOBPrice, formatQty, shortAddr, randRange
│   ├── keypairFromSecret — parse suiprivkey/base64/keystore formats
│   ├── findBal — parse balance from suix_getAllBalances response
│   └── fetchAllBalances — fetch all coin balances for an address
│
├── sdk.ts               (87 lines) — DeepBook SDK factories
│   ├── makeClient — SuiGrpcClient factory
│   ├── makeSwapDb — DeepBookClient for swaps (no managers)
│   ├── makeMarginDb — DeepBookClient with MarginManager
│   ├── makeBalanceDb — DeepBookClient with BalanceManager
│   ├── makePlainDb — DeepBookClient with packageIds
│   ├── signAndExecute — sign + execute + wait for propagation
│   ├── buildSwapBuy — swap quote→base PTB
│   └── buildSwapSell — swap base→quote PTB
│
├── strategies/
│   ├── index.ts         (4 lines) — barrel export
│   ├── margin.ts        (432 lines) — ✅ WIRED INTO plugin.tsx
│   │   ├── executeMarginCycle — full cycle: topup → rebalance → open → hold → close
│   │   └── cleanupMarginPositions — cancel + repay (with auto-swap) + withdraw
│   ├── directional.ts   (153 lines) — extracted, ready to wire
│   │   └── executeDirectionalCycle — trend-follow with 2 wallets
│   ├── volume.ts        (92 lines) — extracted, ready to wire
│   │   └── executeVolumeCycle — 1 wallet buy+sell for volume points
│   └── maker.ts         (172 lines) — extracted, ready to wire
│       └── executeMakerCycle — 2 wallets + BalanceManagers, POST_ONLY
│
├── hooks/
│   ├── index.ts         (2 lines) — barrel export
│   ├── useMarketData.ts (71 lines) — extracted, ready to wire
│   │   └── useMarketData — price, orderbook, markets polling
│   └── useWalletData.ts (142 lines) — extracted, ready to wire
│       └── useWalletData — balances, MM state, tx history, orders
│
├── components/
│   ├── index.ts         (2 lines) — barrel export
│   └── DashboardTab.tsx (135 lines) — extracted, ready to wire
│       └── DashboardTab — status, stats, hold progress, history, logs
│
├── style.css            — Dark OLED theme (Fira Code/Sans)
└── ARCHITECTURE.md      — THIS FILE
```

---

## Wiring Status

| Module | Extracted | Wired into plugin.tsx |
|--------|-----------|----------------------|
| types.ts | ✅ | ✅ imported |
| utils.ts | ✅ | ✅ imported |
| sdk.ts | ✅ | ⬜ (plugin still has inline signAndExec, buildSwap*) |
| strategies/margin.ts | ✅ | ✅ cleanupMargin + executeMarginCycle delegate |
| strategies/directional.ts | ✅ | ⬜ inline executeCycle still in plugin.tsx |
| strategies/volume.ts | ✅ | ⬜ inline executeVolumeCycle still in plugin.tsx |
| strategies/maker.ts | ✅ | ⬜ inline executeMakerCycle still in plugin.tsx |
| hooks/useMarketData.ts | ✅ | ⬜ inline fetch* still in plugin.tsx |
| hooks/useWalletData.ts | ✅ | ⬜ inline fetch* still in plugin.tsx |
| components/DashboardTab.tsx | ✅ | ⬜ inline JSX still in plugin.tsx |

**To wire remaining modules**: replace inline code in plugin.tsx with imports.
Each extracted module receives dependencies via params (no React hook coupling).

---

## Strategy Architecture

All strategies follow the same pattern:

```typescript
interface StrategyDeps {
  network, config, addLog, signAndExec,
  setStage, setCurrentPrice, setOrderPrices,
  setTotalVolume, setTotalPnl, setHistory,
  setHoldStart, setHoldEnd,
  stageRef, cycleRef, setCycleNum,
}

// Each strategy is a plain async function:
async function executeXxxCycle(deps: XxxDeps): Promise<void>
```

**Margin** (primary strategy):
```
1. Auto-topup SUI gas between wallets
2. Auto-rebalance: swap tokens so A has quote, B has base
3. Fetch orderbook + ticker + pool constraints (parallel)
4. Calculate qty, deposits, safe bid/ask prices
5. A: depositQuote + borrowQuote(2×) + POST_ONLY BID  (1 PTB, retry on cross)
6. B: depositBase + borrowBase(2×) + POST_ONLY ASK    (1 PTB, retry on cross)
7. Hold 150-210s (interest accrues → points)
8. Close: cancel + repay + withdraw per account
9. On error: cleanupMarginPositions (auto-swap + repay + withdraw)
```

---

## SDK Critical Notes

```typescript
// ❌ DON'T pass packageIds for margin — causes marginPools = {}
new DeepBookClient({ ..., packageIds: mainnetPackageIds, marginManagers: {...} })

// ✅ DO let SDK auto-resolve from network
new DeepBookClient({ ..., network: 'mainnet', marginManagers: {...} })

// ❌ Swap returns 3 coins — must transfer ALL
const coin = db.deepBook.swapExactQuoteForBase({...})(tx)
tx.transferObjects([coin], addr) // WRONG — UnusedValueWithoutDrop

// ✅ Spread all return values
const result = db.deepBook.swapExactQuoteForBase({...})(tx)
tx.transferObjects([...result], addr)

// ❌ withdrawBase('main', 0) does NOT mean "withdraw all" — aborts with code 8
// ✅ Query state first, withdraw exact amount × 0.999
const state = await db.getMarginManagerState('main')
db.marginManager.withdrawBase('main', parseFloat(state.baseAsset) * 0.999)(tx)

// ❌ repayBase('main') aborts with code 10 if no debt
// ✅ Each repay in separate tx with try/catch
```

---

## Key State in plugin.tsx

| State | Type | Purpose |
|-------|------|---------|
| `mmIdA/B` | string | Margin Manager IDs (localStorage `hb_mmA/B`) |
| `mmIdARef/BRef` | Ref | Sync ref for async access (React state is async) |
| `bmIdA/B` | string | Balance Manager IDs (localStorage `hb_bmA/B`) |
| `keypairARef/BRef` | Ref<Ed25519Keypair> | Signing keypairs |
| `stageRef` | Ref<BotStage> | Current bot stage (for async checks) |
| `cycleRef` | Ref<number> | Current cycle number |
| `intervalRef` | Ref<Interval> | Bot loop interval handle |

---

## UI Tabs

| Tab | Content | Lines in plugin.tsx |
|-----|---------|---------------------|
| **Setup** | Key import (paste/keystore/vault), config form, pool selector, start/stop | ~430 lines |
| **Dashboard** | Status dot, stats grid, hold progress, history table, logs | ~235 lines |
| **Accounts** | Per-wallet balances, MM state (asset/debt), BM balances, tx history, Force Close button | ~540 lines |

Left sidebar (always visible): Mini orderbook (15 asks + mid + 15 bids) with order markers.

---

## Related Docs

- `docs/deepbook/SESSION-CONTEXT.md` — Full session context for Kiro
- `docs/deepbook/error-log.md` — 15 errors encountered + fixes
- `docs/deepbook/margin-trading.md` — Margin Manager technical guide
- `docs/deepbook/hedging-bot.md` — Bot architecture overview
