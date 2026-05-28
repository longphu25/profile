# DeepBook Margin

## Overview

DeepBook Margin extends DeepBookV3 with **leveraged trading**. Users borrow funds from a `MarginPool` to take positions larger than their collateral. A `MarginManager` wraps a standard `BalanceManager` and adds borrow/repay/risk-management capabilities.

Live on Sui Mainnet. Production-ready as of v3 (Feb 2026).

## When to use it

- Leverage long/short positions on DeepBookV3 spot pairs
- Earn yield by lending liquidity to a `MarginPool`
- Build automated trading bots that need leverage
- Compose with other DeFi protocols (e.g. Predict ranges funded by margin debt)

## Architecture (4 shared objects)

```
MarginRegistry (singleton)
└── Tracks all MarginPools and MarginManagers
└── Stores risk parameters per (base, quote) pair
└── Enables/disables margin trading per pool

MarginPool (one per asset)
├── State (supply/borrow shares, interest accrual)
├── ProtocolConfig (rates, caps, spread)
├── ProtocolFees (referral/protocol/maintainer split)
└── PositionManager (per-supplier positions)

MarginManager (one per user per pool)
├── Wraps BalanceManager (DeepBookV3)
├── Tracks borrowed shares (base or quote, not both)
└── Authorized to trade on a specific DeepBookV3 pool

PoolProxy
└── Wrapper that routes trading calls through MarginManager
```

## MarginPool

Manages liquidity for one asset. E.g. `SUI Margin Pool`, `USDC Margin Pool`. Components:

### State

Shares-based accounting:

- **Supply shares** — lender's proportional ownership of supplied assets
- **Borrow shares** — borrower's proportional debt obligation

Interest accrues continuously based on **utilization rate**:

```
Utilization Rate = Total Borrowed / Total Supplied
```

Updates on every supply, borrow, repay, or withdraw operation.

### ProtocolConfig

```
- Interest rate parameters (kink model)
- Supply cap
- Max utilization rate (e.g. 80%)
- Min borrow amount (anti-spam)
- Protocol spread (% of interest going to protocol)
```

### Interest rate model (kinked)

```
if utilization < kink (e.g. 80%):
  rate = base_rate + slope_1 × utilization
else:
  rate = base_rate + slope_1 × kink + slope_2 × (utilization - kink)
```

Below the kink: linear, moderate growth. Above the kink: steep growth, discourages over-borrowing.

### ProtocolFees split

When borrowers pay interest:

```
Protocol spread (e.g. 10%) → protocol pool
Remaining (e.g. 90%) → suppliers (proportional to shares)

Of the protocol spread:
  50% → referral fees (suppliers' referrers)
  25% → protocol treasury
  25% → pool maintainer
```

### Example

100 USDC interest paid by borrower:
- 90 USDC distributed to suppliers
- 5 USDC to referral
- 2.5 USDC to protocol treasury
- 2.5 USDC to maintainer

## MarginManager

Wraps a `BalanceManager` and adds margin operations. Each manager is **bound to one DeepBookV3 pool**.

### Borrowing constraints

- Can only borrow from **one MarginPool at a time** (either base OR quote, not both)
- Simplifies risk math — no cross-collateral complexity
- Repaying frees the slot for borrowing the other asset

### Risk ratio

```
Risk Ratio = Total Assets / Total Debt
```

Higher = healthier. Position can be liquidated when ratio falls below threshold.

### Action thresholds (typical)

| Threshold | Default | Meaning |
|-----------|---------|---------|
| Min Withdraw Risk Ratio | 2.0 | Can withdraw collateral above this |
| Min Borrow Risk Ratio | 1.25 | Can take new loans above this |
| Liquidation Risk Ratio | 1.1 | Liquidatable below this |
| Target Liquidation Risk Ratio | 1.25 | Target after partial liquidation |

### Liquidation flow

```
1. Risk Ratio falls below 1.1 (or pair-specific threshold)
2. Anyone can call MarginManager.liquidate(...)
3. Liquidator provides repayment coin
4. All open orders for the manager are cancelled
5. System computes max repayable debt
6. Collateral transferred to liquidator + reward (e.g. 5%)
7. Pool may receive an additional reward (e.g. 3%)
8. If insufficient assets: pool records bad debt
```

Liquidations can be **partial** (bring ratio back to target) or **full** (close entire position).

## MarginRegistry

Central coordination object. Stores:

- Registered margin pools per asset type
- Enabled DeepBookV3 pools (which trading pools allow margin)
- Risk parameters per `(base_pool, quote_pool)` pair
- Master list of all `MarginManager`s

## Risk parameters (mainnet)

### SUI/USDC — 5x leverage

| Parameter | Value |
|-----------|-------|
| Min Withdraw Risk Ratio | 2.0 |
| Min Borrow Risk Ratio | 1.25 |
| Liquidation Risk Ratio | 1.1 |
| Target Liquidation Risk Ratio | 1.25 |
| User Liquidation Reward | 2% |
| Pool Liquidation Reward | 3% |

### WAL/USDC and DEEP/USDC — 3x leverage

| Parameter | Value |
|-----------|-------|
| Min Withdraw Risk Ratio | 2.0 |
| Min Borrow Risk Ratio | 1.5 |
| Liquidation Risk Ratio | 1.2 |
| Target Liquidation Risk Ratio | 1.5 |
| User Liquidation Reward | 2% |
| Pool Liquidation Reward | 3% |

## Contract IDs (mainnet)

```
MARGIN_PACKAGE_ID (v3): 0xfbd322126f1452fd4c89aedbaeb9fd0c44df9b5cedbe70d76bf80dc086031377
MARGIN_REGISTRY_ID:     0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742
LIQUIDATION_PACKAGE_ID: 0xf17bff1bf21e9587acc5708714e520aa967f82f256f626938a33c4109b08adb9
```

## Contract IDs (testnet)

```
MARGIN_PACKAGE_ID:      0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6
MARGIN_REGISTRY_ID:     0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75
LIQUIDATION_PACKAGE_ID: 0x8d69c3ef3ef580e5bf87b933ce28de19a5d0323588d1a44b9c60b4001741aa24
```

## Typical lifecycle

### Trader (long with leverage)

```typescript
// 1. Create margin manager bound to SUI/USDC pool
tx.add(dbClient.marginManager.newMarginManager('SUI_USDC'))

// 2. Deposit USDC as collateral
tx.add(dbClient.marginManager.depositQuote({
  managerKey: 'main',
  amount: 1000  // 1000 USDC collateral
}))

// 3. Borrow more USDC against it (e.g. 700 more for 1.7x leverage)
tx.add(dbClient.marginManager.borrowQuote('main', 700))

// 4. Place leveraged buy order via PoolProxy
tx.add(dbClient.poolProxy.placeLimitOrder({
  poolKey: 'SUI_USDC',
  marginManagerKey: 'main',
  clientOrderId: '1',
  price: 1.5,
  quantity: 1133,  // ~1700 USDC worth at $1.5
  isBid: true,
  orderType: OrderType.NO_RESTRICTION,
  payWithDeep: false,
}))

// 5. Later: close position, repay loan, withdraw remaining
tx.add(dbClient.marginManager.repayQuote('main'))  // repay all
tx.add(dbClient.marginManager.withdrawQuote('main', remaining))
```

### Lender (supply for yield)

```typescript
// 1. Supply USDC to USDC margin pool, receive SupplierCap
const [supplierCap] = tx.add(dbClient.marginPool.supply({
  asset: 'USDC',
  amount: 10000,
}))
tx.transferObjects([supplierCap], owner)

// 2. Later: withdraw with accrued interest
tx.add(dbClient.marginPool.withdraw({
  asset: 'USDC',
  supplierCap,
  amount: 10500,  // includes interest
}))
```

## Risk considerations

### For traders

- **Leverage amplifies losses** — a 10% adverse move at 5x leverage = 50% loss
- **Interest accrual** — cost of carry erodes profits over time
- **Liquidation cost** — losing 5% to rewards on top of collateral loss
- **Oracle risk** — sudden price movements can trigger liquidation faster than you can react

### For lenders

- **Bad debt** — if liquidations don't fully cover debt, lenders absorb losses
- **Utilization risk** — high utilization may delay withdrawals (max_utilization_rate)
- **Smart contract risk** — bugs in liquidation logic could affect funds
- **Interest rate volatility** — rates fluctuate with utilization

## Indexer

```
https://deepbook-margin-indexer.mainnet.mystenlabs.com
```

Endpoints (typical):

- `GET /margin-pools` — list all margin pools
- `GET /margin-pools/:asset/state` — supply, borrow, utilization, rates
- `GET /margin-managers/:owner` — user's margin managers
- `GET /margin-managers/:id/state` — base/quote assets and debts
- `GET /liquidations` — recent liquidation events

## Common patterns

### Health monitoring

```typescript
// Check current risk ratio
const state = await dbClient.getMarginManagerState('main')
const totalAssets = parseFloat(state.baseAsset) * basePrice + parseFloat(state.quoteAsset)
const totalDebt = parseFloat(state.baseDebt) * basePrice + parseFloat(state.quoteDebt)
const riskRatio = totalAssets / totalDebt

if (riskRatio < 1.2) {
  console.warn('Position approaching liquidation!')
}
```

### Auto-rebalance before liquidation

```typescript
// If risk ratio falls below 1.3, repay some debt
if (riskRatio < 1.3) {
  // Cancel orders, withdraw settled, repay
  tx.add(dbClient.poolProxy.cancelAllOrders('main'))
  tx.add(dbClient.poolProxy.withdrawSettledAmounts('main'))
  tx.add(dbClient.marginManager.repayBase('main'))  // partial
}
```

### Liquidator bot

```typescript
// Periodically scan all margin managers
const managers = await fetch(`${MARGIN_INDEXER}/margin-managers`)
for (const m of managers) {
  const state = await dbClient.getMarginManagerState(m.id)
  const riskRatio = computeRiskRatio(state)
  if (riskRatio < 1.1) {
    // Liquidate for profit
    const tx = new Transaction()
    tx.add(dbClient.marginManager.liquidate({
      poolKey: m.pool,
      marginManagerId: m.id,
      repayAmount: ...,
    }))
  }
}
```

## Related

- [DeepBookV3](./deepbookv3.md) — base CLOB layer
- [DeepBook Predict](./deepbook-predict.md) — composable with margin (Three-Protocol Loop)
- [SDK Reference](./sdk-reference.md) — full TypeScript API
- [Risk Ratio docs](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/risk-ratio)


---

## Tài liệu tham khảo (References)

### Official Sui docs

- [DeepBook Margin Overview](https://docs.sui.io/onchain-finance/deepbook-margin/)
- [Design](https://docs.sui.io/onchain-finance/deepbook-margin/design)
- [Margin Risks](https://docs.sui.io/onchain-finance/deepbook-margin/margin-risks)
- [Contract Information](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information)
- [Risk Ratio](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/risk-ratio)
- [Margin SDK](https://docs.sui.io/onchain-finance/deepbook-margin-sdk/)
- [Margin Indexer](https://docs.sui.io/onchain-finance/deepbook-margin/deepbook-margin-indexer)

### CLI tools

- **[mcxross/deepbook-cli](https://github.com/mcxross/deepbook-cli)** — Includes full margin trading flow:
  - `deepbook margin pools` — discover margin pools
  - `deepbook margin managers` — list user's margin managers
  - `deepbook margin deposit/market/limit/position/close` — full lifecycle
  - `--leverage`, `--reduce-only`, `--no-pay-with-deep`, `--dry-run` flags
  - Auto-selects compatible manager or creates one in tx
- **[mcxross/skills](https://github.com/mcxross/skills)** — `deepbook-cli` skill for AI agents

### Source

- [DeepBookV3 source (margin module)](https://github.com/MystenLabs/deepbookv3/tree/main/packages/deepbook/sources)
- [TypeScript SDK source](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3/src/transactions) — see `marginManager.ts`, `marginPool.ts`, `marginLiquidations.ts`, `poolProxy.ts`
