# Kiro Session Context — DeepBook Hedging Bot

Context file cho Kiro sessions tiếp theo. Đọc file này trước khi làm việc với plugin.

---

## Project Layout

```
/Users/longphu/p/hackathon/SUI/me/profile/          ← Main project (React + Vite)
├── plugins/sui-deepbook-hedging-bot/                ← Plugin chính
│   ├── plugin.tsx          (3890 lines) — Main component, all strategies
│   ├── types.ts            (99 lines)  — Interfaces, constants, StrategyDeps
│   ├── utils.ts            (64 lines)  — Formatters, keypairFromSecret, findBal
│   ├── sdk.ts              (87 lines)  — DeepBookClient factories, signAndExecute
│   ├── strategies/
│   │   ├── index.ts        — Barrel export
│   │   └── margin.ts       (432 lines) — executeMarginCycle, cleanupMarginPositions
│   └── style.css           — Dark OLED theme
├── docs/deepbook/                                   ← Documentation
│   ├── README.md           — Index
│   ├── margin-trading.md   — Margin Manager technical guide
│   ├── hedging-bot.md      — Bot architecture
│   ├── api-reference.md    — DeepBook API reference
│   ├── balance-manager.md  — Balance Manager guide
│   ├── trading-strategies.md — Strategy comparison
│   ├── plugins.md          — All plugins overview
│   └── SESSION-CONTEXT.md  — THIS FILE
└── sui-deepbook-hedging-bot.html                    ← Standalone HTML entry

/Users/longphu/p/hackathon/SUI/airdrop/depbuk-hedging/  ← Reference implementation
├── src/lib/server/bot/
│   ├── deepbook.ts              — DeepBookService façade
│   ├── deepbook-execution.ts    — Order submission (limit, market, close PTBs)
│   ├── deepbook-cleanup.ts      — Cancel, withdraw, repay-and-withdraw
│   ├── deepbook-margin-state.ts — Manager discovery, state, orders
│   ├── deepbook-shared.ts       — Pure helpers
│   ├── deepbook-context.ts      — SdkBundle type definition
│   ├── deepbook-market-data.ts  — Orderbook, price, estimators
│   ├── runtime-cycle-executor.ts — Single cycle execution
│   ├── runtime.ts               — Bot runtime lifecycle
│   ├── config.ts                — Settings validation, encryption
│   └── db.ts                    — Database (cycles, orders, logs)
└── src/lib/bot-settings-defaults.ts — Default config values
```

---

## Build & Run

```bash
cd /Users/longphu/p/hackathon/SUI/me/profile
bun run build          # tsc -b && vite build
bun run dev            # vite dev server
# Open: http://localhost:5173/sui-deepbook-hedging-bot.html
```

---

## Margin Strategy — How It Works

### Cycle Flow (SUI_USDC example)

```
1. Auto-topup: transfer SUI between wallets if one is low on gas
2. Auto-rebalance: A swap SUI→USDC if short on quote, B swap USDC→SUI if short on base
3. Fetch: orderbook + ticker + pool constraints (parallel)
4. Calculate: qty, deposit amounts, safe bid/ask prices
5. A OPEN: depositQuote + borrowQuote(2×) + POST_ONLY BID  (1 PTB)
6. B OPEN: depositBase + borrowBase(2×) + POST_ONLY ASK    (1 PTB)
7. HOLD: 150-210s (interest accrues → points)
8. A CLOSE: cancel + settle + repayBase + repayQuote + withdraw  (multiple txs)
9. B CLOSE: cancel + settle + repayBase + repayQuote + withdraw  (multiple txs)
10. Repeat (max 3 cycles)
```

### Key Config (from depbuk-hedging defaults)

| Param | Value |
|-------|-------|
| pool | SUI_USDC |
| notionalUsd | 4 |
| holdMinSec / holdMaxSec | 150 / 210 |
| maxCycles | 3 |
| borrowFactor | 2 (hardcoded) |
| strategy | margin |

### Points Earning

Margin limit orders earn points via:
1. Interest paid on borrowed amount
2. POST_ONLY maker volume
3. Hold duration
4. Leverage multiplier (2×)
5. Both open + hold + close count

---

## SDK Usage

### DeepBookClient Config

```typescript
// For margin operations — DON'T pass packageIds (let SDK auto-resolve from network)
new DeepBookClient({
  client, address, network: 'mainnet',
  coins: mainnetCoins, pools: mainnetPools,
  marginManagers: { main: { address: mmId, poolKey: 'SUI_USDC' } },
})

// For swaps — minimal config
new DeepBookClient({ client, address, network: 'mainnet' })
```

**CRITICAL**: Passing `packageIds` explicitly causes `marginPools` to default to `{}` → `getMarginPool('USDC')` fails. Omit `packageIds` for margin operations.

### Swap Return Values

`swapExactQuoteForBase` / `swapExactBaseForQuote` return **3 coins** (base, quote, deep). Must `transferObjects([...result], addr)` all 3 or get `UnusedValueWithoutDrop` error.

### MarginManager Methods

```typescript
// Deposit + borrow
db.marginManager.depositQuote({ managerKey: 'main', amount })(tx)
db.marginManager.borrowQuote('main', amount)(tx)

// Repay (no amount = repay all) — ABORTS if no debt exists (code 10)
db.marginManager.repayBase('main')(tx)
db.marginManager.repayQuote('main')(tx)

// Withdraw (amount=0 does NOT mean "all" — ABORTS with code 8)
// Must query state first and pass exact amount × 0.999
db.marginManager.withdrawBase('main', exactAmount)(tx)

// State query
const state = await db.getMarginManagerState('main')
// Returns: { baseAsset, quoteAsset, baseDebt, quoteDebt, ... } (all strings)
```

### PoolProxy Methods

```typescript
db.poolProxy.updateCurrentPrice(poolKey)(tx)
db.poolProxy.placeLimitOrder({ poolKey, marginManagerKey, clientOrderId, price, quantity, isBid, orderType, selfMatchingOption, payWithDeep })(tx)
db.poolProxy.cancelAllOrders('main')(tx)
db.poolProxy.withdrawSettledAmounts('main')(tx)
```

---

## Known Issues & Solutions

### 1. POST_ONLY Cross (abort code 5)
**Cause**: Bid >= best ask due to stale orderbook data.
**Fix**: Offset bid/ask by 3+ ticks. Retry up to 3 times with fresh orderbook, increasing offset to 5 ticks.

### 2. Withdraw Abort (code 8)
**Cause**: Withdraw amount > available, or withdrawing from empty MM.
**Fix**: Query `getMarginManagerState` first, only withdraw if assets > 0, use `amount * 0.999`.

### 3. Repay Abort (code 10)
**Cause**: Calling repay when no debt exists.
**Fix**: Each repay in separate tx with try/catch. Skip if no debt.

### 4. Cross-Asset Debt
**Cause**: MM has SUI asset but USDC debt (or vice versa). Can't repay without the right token.
**Fix**: Check wallet balance → if insufficient, swap from the other token → deposit → repay.

### 5. InsufficientCoinBalance
**Cause**: Wallet doesn't have enough tokens for deposit.
**Fix**: Auto-rebalance before cycle: A swaps SUI→USDC, B swaps USDC→SUI. Cap deposit to 95% of available.

### 6. Gas Exhaustion
**Cause**: Both wallets run out of SUI for gas after many cycles.
**Fix**: Auto-topup: transfer 0.3 SUI from the richer wallet. Threshold: 0.2 SUI minimum.

### 7. Margin Pool Not Found
**Cause**: Passing `packageIds` to DeepBookClient makes `marginPools` default to `{}`.
**Fix**: Don't pass `packageIds` — let SDK auto-resolve from network name.

---

## Refactoring Status

### Extracted (standalone, tested):
- `types.ts` — All interfaces, constants, StrategyDeps
- `utils.ts` — Pure formatters, keypairFromSecret, findBal, fetchAllBalances
- `sdk.ts` — makeMarginDb, makeSwapDb, makeBalanceDb, makePlainDb, signAndExecute, buildSwapBuy/Sell
- `strategies/margin.ts` — executeMarginCycle, cleanupMarginPositions (receives deps via params)

### Still inline in plugin.tsx:
- `cleanupMargin` useCallback — should be replaced with `cleanupMarginPositions` from strategies
- `executeMarginCycle` useCallback — should be replaced with wrapper calling `_executeMarginCycle`
- `executeMakerCycle`, `executeVolumeCycle`, `executeCycle` — not yet extracted
- `autoBalance` — not yet extracted
- `ensureBalanceManager`, `ensureMarginManager` — not yet extracted
- All UI components (SetupTab, DashboardTab, AccountsTab) — not yet extracted

### Next steps:
1. Wire `strategies/margin.ts` into plugin.tsx (replace inline with import)
2. Extract maker/volume/directional strategies
3. Extract `ensureMarginManager` into sdk.ts
4. Extract UI tabs into components/

---

## Test Wallets

| Wallet | Address | Role |
|--------|---------|------|
| A (Long) | `0x9dd6ccf4b1e3e7efd843b57ca0440afd53da70ecf8eb8bab82306fef0ad37673` | Deposits quote (USDC), borrows quote, BID |
| B (Short) | `0x2b21f7093294e78bf2dc7341ddd785c5b5913e34aa14094ada2b4ade655270ff` | Deposits base (SUI), borrows base, ASK |

### Margin Managers Created

| Account | MM ID | Pool |
|---------|-------|------|
| A | `0x69bac1016f5747ad31f7878e44b913c90809452787b5933e49fce45a12b3eca6` | SUI_USDC |
| B | `0x406b96c2d99ad1b84b4f9028bffc780f8dc861e9d59f76454b81d852fe92655e` | SUI_USDC |

Stored in browser localStorage as `hb_mmA` / `hb_mmB`.

---

## depbuk-hedging Reference

Source: `/Users/longphu/p/hackathon/SUI/airdrop/depbuk-hedging/`

Key differences from our plugin:
- Server-side (SvelteKit) vs client-side (browser)
- Uses `DeepBookConfig` + individual contracts (`MarginManagerContract`, `PoolProxyContract`) vs `DeepBookClient` wrapper
- Has database persistence (cycles, orders, logs)
- Has Pyth oracle price updates (`appendLatestPythUpdates`) for DeepTrade-style PTBs
- Has sophisticated close flow: market orders + repay in single PTB
- Has `notional_auto_reduce_floor_pct` for auto-reducing notional when funding short
- Has `maker_reprice_seconds` + `force_market_close_seconds` for order management

Key config values to match:
```
notional_size_usd: 4
min_hold_seconds: 150
max_hold_seconds: 210
max_cycles: 3
account_a_borrow_quote_factor: 2
account_b_borrow_base_factor: 2
open_order_execution_mode: 'limit'
close_order_execution_mode: 'limit'
min_gas_reserve_sui: 0.15
```
