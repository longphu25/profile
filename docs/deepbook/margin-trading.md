# DeepBook Margin Trading — Technical Guide

Tài liệu kỹ thuật về margin trading trên DeepBook v3.
Ported từ depbuk-hedging strategy vào plugin `sui-deepbook-hedging-bot`.

---

## Margin Manager vs Balance Manager

| | Balance Manager | Margin Manager |
|---|---|---|
| Object type | `BalanceManager` | `MarginManager<BaseCoin, QuoteCoin>` |
| Borrow | ❌ Không | ✅ Borrow base/quote từ margin pool |
| Leverage | 1× | Tùy chỉnh (2×, 3×...) |
| Interest | Không | Trả interest trên borrowed amount |
| Points | Volume only | Volume + interest + leverage + duration |
| SDK class | `BalanceManagerContract` | `MarginManagerContract` + `PoolProxyContract` |
| Order placement | `deepBook.placeLimitOrder()` | `poolProxy.placeLimitOrder()` |
| Cancel | `deepBook.cancelAllOrders()` | `poolProxy.cancelAllOrders()` |

### Tại sao dùng Margin Manager?

Từ DeepBook FAQ:
- *"Leveraged positions earn more points"*
- *"Duration of the order, and how much interest is paid"*
- *"Margin limit orders earn points even if they don't fill, because you paid interest"*

→ Margin Manager kiếm points qua **5 kênh**:
1. **Margin borrowing** → trả interest → points
2. **POST_ONLY limit orders** → maker volume → points
3. **Hold duration** → giữ position lâu → points
4. **Leverage 2×** → risk cao hơn → points nhiều hơn
5. **Cả open + hold + close** đều tính points

---

## Architecture — depbuk-hedging Strategy

```
Account A (Long)                    Account B (Short)
┌─────────────────────┐            ┌─────────────────────┐
│ MarginManager        │            │ MarginManager        │
│ borrow_quote_factor=2│            │ borrow_base_factor=2 │
│                      │            │                      │
│ 1. depositQuote      │            │ 1. depositBase       │
│ 2. borrowQuote (2×)  │            │ 2. borrowBase (2×)   │
│ 3. POST_ONLY BID     │            │ 3. POST_ONLY ASK     │
│    (buy at bid)      │            │    (sell at ask)      │
│                      │            │                      │
│ Interest accrues...  │            │ Interest accrues...  │
│ → POINTS             │            │ → POINTS             │
│                      │            │                      │
│ 4. cancelAllOrders   │            │ 4. cancelAllOrders   │
│ 5. withdrawSettled   │            │ 5. withdrawSettled   │
│ 6. repayQuote        │            │ 6. repayBase         │
│ 7. withdraw assets   │            │ 7. withdraw assets   │
└─────────────────────┘            └─────────────────────┘
```

### Cycle Flow

```
OPEN → HOLD (earn interest) → CLOSE → repeat
```

| Phase | Account A (Long) | Account B (Short) |
|-------|-------------------|-------------------|
| OPEN | depositQuote + borrowQuote(2×) + BID POST_ONLY | depositBase + borrowBase(2×) + ASK POST_ONLY |
| HOLD | Interest accrues on borrowed quote | Interest accrues on borrowed base |
| CLOSE | cancelAll + withdrawSettled + repayQuote + withdraw | cancelAll + withdrawSettled + repayBase + withdraw |

---

## SDK API — MarginManagerContract

### Tạo Margin Manager

```typescript
const tx = new Transaction()
const { manager, initializer } = dbClient.marginManager
  .newMarginManagerWithInitializer(poolKey)(tx)
dbClient.marginManager.shareMarginManager(poolKey, manager, initializer)(tx)
await signAndExec(keypair, tx, 'mainnet')
// Parse marginManagerId từ objectChanges
```

### Config DeepBookClient với Margin Manager

```typescript
const dbClient = new DeepBookClient({
  client, address: walletAddress, network: 'mainnet',
  coins: mainnetCoins,
  pools: mainnetPools,
  packageIds: mainnetPackageIds,
  marginManagers: {
    main: { address: marginManagerId, poolKey: 'SUI_USDC' }
  },
})
```

### Deposit + Borrow

```typescript
const tx = new Transaction()

// Deposit collateral
dbClient.marginManager.depositQuote({ managerKey: 'main', amount: 5.0 })(tx)
// hoặc
dbClient.marginManager.depositBase({ managerKey: 'main', amount: 10.0 })(tx)

// Borrow (leverage)
dbClient.marginManager.borrowQuote('main', 5.0)(tx)  // borrow 5 USDC
dbClient.marginManager.borrowBase('main', 10.0)(tx)   // borrow 10 SUI
```

### Place Margin Limit Order (POST_ONLY)

```typescript
import { OrderType, SelfMatchingOptions } from '@mysten/deepbook-v3'

const tx = new Transaction()

// Update price oracle trước khi đặt order
dbClient.poolProxy.updateCurrentPrice(poolKey)(tx)

// Place POST_ONLY limit order
dbClient.poolProxy.placeLimitOrder({
  poolKey: 'SUI_USDC',
  marginManagerKey: 'main',
  clientOrderId: Date.now().toString(),
  price: 3.50,
  quantity: 10,
  isBid: true,  // BUY
  orderType: OrderType.POST_ONLY,
  selfMatchingOption: SelfMatchingOptions.CANCEL_TAKER,
  payWithDeep: false,
})(tx)
```

### Repay Debt

```typescript
const tx = new Transaction()

// Repay all (không truyền amount)
dbClient.marginManager.repayQuote('main')(tx)  // repay all quote debt
dbClient.marginManager.repayBase('main')(tx)   // repay all base debt

// Repay specific amount
dbClient.marginManager.repayQuote('main', 5.0)(tx)
dbClient.marginManager.repayBase('main', 10.0)(tx)
```

### Withdraw Assets

```typescript
const tx = new Transaction()

// Withdraw (amount = 0 → withdraw all available)
const baseCoin = dbClient.marginManager.withdrawBase('main', 0)(tx)
const quoteCoin = dbClient.marginManager.withdrawQuote('main', 0)(tx)
tx.transferObjects([baseCoin, quoteCoin], walletAddress)
```

### Cancel Orders

```typescript
const tx = new Transaction()
dbClient.poolProxy.cancelAllOrders('main')(tx)
dbClient.poolProxy.withdrawSettledAmounts('main')(tx)
```

### Query State

```typescript
// Manager state (via devInspect)
const tx = new Transaction()
dbClient.marginManager.managerState(poolKey, marginManagerId)(tx)
// Returns: managerId, poolId, riskRatio, baseAsset, quoteAsset,
//          baseDebt, quoteDebt, basePythPrice, ...

// Calculate assets
dbClient.marginManager.calculateAssets(poolKey, marginManagerId)(tx)
// Returns: [baseAssetAmount, quoteAssetAmount]

// Check debts
dbClient.marginManager.calculateDebts(poolKey, coinKey, marginManagerId)(tx)
```

---

## Close Flow — Chi tiết kỹ thuật

### Đơn giản (plugin hiện tại)

Mỗi account thực hiện 2 transactions:

**TX 1: Cancel + Repay**
```typescript
const tx = new Transaction()
dbClient.poolProxy.cancelAllOrders('main')(tx)
dbClient.poolProxy.withdrawSettledAmounts('main')(tx)
dbClient.marginManager.repayQuote('main')(tx)  // A: repay quote
// hoặc
dbClient.marginManager.repayBase('main')(tx)   // B: repay base
await signAndExec(keypair, tx)
```

**TX 2: Withdraw**
```typescript
const tx = new Transaction()
const base = dbClient.marginManager.withdrawBase('main', 0)(tx)
const quote = dbClient.marginManager.withdrawQuote('main', 0)(tx)
tx.transferObjects([base, quote], walletAddress)
await signAndExec(keypair, tx)
```

### Nâng cao (depbuk-hedging — single PTB)

depbuk-hedging gộp tất cả vào 1 PTB cho mỗi account:

```
1. appendLatestPythUpdates     ← Pyth oracle price update
2. cancelAllConditionalOrders  ← TP/SL orders
3. withdrawSettledAmounts
4. cancelAllOrders
5. updateCurrentPrice
6. place_market_order          ← market close (nếu cần)
7. repay_base / repay_quote    ← repay(None) = repay all
8. calculateAssets             ← get remaining amounts
9. withdraw base               ← raw moveCall
10. withdraw quote
11. transferObjects            ← send coins to wallet
```

Ưu điểm: 1 tx thay vì 2-3 tx, atomic, ít gas hơn.
Nhược điểm: phức tạp hơn, cần raw moveCall cho withdraw.

---

## depbuk-hedging — Config Reference

| Param | Default | Mô tả |
|-------|---------|-------|
| `network` | mainnet | mainnet / testnet |
| `pool_key` | SUI_USDC | Trading pair |
| `notional_size_usd` | 4 | USD value per cycle |
| `min_hold_seconds` | 150 | Min hold time |
| `max_hold_seconds` | 210 | Max hold time |
| `max_cycles` | 3 | Stop after N cycles |
| `account_a_borrow_quote_factor` | 2 | A: borrow 2× quote |
| `account_b_borrow_base_factor` | 2 | B: borrow 2× base |
| `open_order_execution_mode` | limit | limit / market |
| `close_order_execution_mode` | limit | limit / market |
| `slippage_tolerance` | 0.005 | 0.5% |
| `maker_reprice_seconds` | 30 | Reprice nếu order chưa fill |
| `force_market_close_seconds` | 20 | Force market close nếu limit chưa fill |
| `auto_swap_enabled` | true | Auto swap cho residual debt |
| `min_gas_reserve_sui` | 0.15 | Giữ lại cho gas |

---

## depbuk-hedging — Module Architecture

```
src/lib/server/bot/
├── deepbook.ts                  # Public façade (DeepBookService)
├── deepbook-context.ts          # Internal dependency contract (SdkBundle)
├── deepbook-shared.ts           # Pure helpers (no side effects)
├── deepbook-market-data.ts      # Orderbook, price, estimators
├── deepbook-margin-state.ts     # Manager discovery, state, orders
├── deepbook-execution.ts        # Order submission (limit, market, close PTBs)
├── deepbook-cleanup.ts          # Cancel, withdraw, repay-and-withdraw
├── runtime.ts                   # Bot runtime (lifecycle, loop)
├── runtime-cycle-executor.ts    # Single cycle execution
├── runtime-snapshot.ts          # State snapshot, sizing, blocking
├── runtime-shared.ts            # Shared utilities
├── runtime-context.ts           # Runtime context interface
├── config.ts                    # Settings validation, encryption
├── db.ts                        # Database (cycles, orders, logs)
└── types.ts                     # Type definitions
```

### SdkBundle

depbuk-hedging tạo SDK bundle với cả 4 contracts:

```typescript
type SdkBundle = {
  config: DeepBookConfig
  deepbook: DeepBookContract
  marginManager: MarginManagerContract
  marginTPSL: MarginTPSLContract
  poolProxy: PoolProxyContract
}
```

Plugin dùng `DeepBookClient` (wrapper) thay vì tạo từng contract riêng.
`DeepBookClient` expose tất cả: `.marginManager`, `.poolProxy`, `.deepBook`, `.marginTPSL`.

---

## Funding Calculation

### Account A (Long — borrow quote)

```
longFundingFactor = max(account_a_borrow_quote_factor, 1)  // = 2
longCollateralUsd = notionalUsd / longFundingFactor         // = $2
longDepositBase = longCollateralUsd / midPrice              // deposit SUI as collateral
longBorrowQuote = notionalUsd - longCollateralUsd           // = $2 borrowed USDC
```

### Account B (Short — borrow base)

```
shortFundingFactor = max(account_b_borrow_base_factor, 1)   // = 2
shortDepositQuote = notionalUsd / shortFundingFactor         // = $2 USDC collateral
shortBorrowBase = quantity                                   // borrow full base qty
```

### Ví dụ: $10 notional, SUI_USDC, SUI price = $3.50

```
Account A (Long):
  collateral = $10 / 2 = $5 → deposit 1.43 SUI
  borrow = $5 USDC
  order: BID 2.86 SUI @ $3.50 (POST_ONLY)

Account B (Short):
  collateral = $10 / 2 = $5 USDC
  borrow = 2.86 SUI
  order: ASK 2.86 SUI @ $3.50 (POST_ONLY)
```

---

## Points Earning — So sánh

| Method | Points Source | Estimate |
|--------|-------------|----------|
| Swap (no margin) | Volume only | ~1 pt / $1 volume |
| Balance Manager + limit | Volume + maker | ~1 pt / $1 volume |
| **Margin Manager + limit** | Volume + interest + leverage + duration | **Nhiều hơn đáng kể** |

### Tại sao Margin > Balance Manager

1. **Interest paid** → trực tiếp tính points (dù order không fill)
2. **Leverage 2×** → risk multiplier → points multiplier
3. **Duration** → giữ position lâu → tích lũy interest → tích lũy points
4. **Cả open + hold + close** đều tính (không chỉ fill event)

---

## Mainnet Margin Pool IDs

Margin pools là nơi borrow/lend tokens. Khác với trading pools.

```typescript
import { mainnetMarginPools } from '@mysten/deepbook-v3'
// mainnetMarginPools['SUI'].address = '0x...'
// mainnetMarginPools['USDC'].address = '0x...'
```

Margin Registry ID (dùng cho repay, withdraw):
```
MARGIN_REGISTRY_ID: từ mainnetPackageIds.MARGIN_REGISTRY_ID
MARGIN_PACKAGE_ID: từ mainnetPackageIds.MARGIN_PACKAGE_ID
```

---

## Lỗi thường gặp

### 1. `withdraw_with_proof` not ready
**Nguyên nhân:** Withdraw ngay sau cancel, settlement chưa xong.
**Fix:** Tách thành 2 tx: (1) cancel + repay, (2) withdraw. Hoặc thêm delay.

### 2. Repay fails — insufficient assets
**Nguyên nhân:** Manager không đủ assets để repay full debt (do interest accrued).
**Fix:** Deposit thêm từ wallet trước khi repay. depbuk-hedging dùng `ensureWalletAssetForResidualRepay` + auto swap.

### 3. POST_ONLY cross error
**Nguyên nhân:** Bid price >= best ask (hoặc ask price <= best bid) → order would cross.
**Fix:** Đặt bid dưới best bid, ask trên best ask. depbuk-hedging dùng `makerBidPrice` / `makerAskPrice` helpers.

### 4. Margin Manager not found
**Nguyên nhân:** MM là shared object, cần query registry.
**Fix:** `marginManager.getMarginManagerIds(owner)` hoặc parse từ create tx.

### 5. Object version conflict
**Nguyên nhân:** 2 tx dùng cùng MarginManager quá nhanh.
**Fix:** Delay giữa các tx, hoặc gộp vào 1 PTB.
