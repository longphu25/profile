# Swap & Scallop Integration — Assessment for Predict Club

## Current State

### Available Swap Plugins

| Plugin | File | Network | Pools | Status |
|--------|------|---------|-------|--------|
| **sui-swap** | `plugins/sui-swap/plugin.tsx` | Mainnet + Testnet | All DeepBook v3 pools (SUI_USDC, etc.) | ✅ Working |
| **sui-wal-swap** | `plugins/sui-wal-swap/plugin.tsx` | Mainnet only | WAL_SUI, WAL_USDC | ✅ Working |

### Available Scallop Integration

| Component | Location | Status |
|-----------|----------|--------|
| **sui-lending** plugin | `plugins/sui-lending/plugin.tsx` | ✅ Read-only market data |
| **Scallop SDK** | `@scallop-io/sui-scallop-sdk@3.0.2` | ✅ Installed |
| **Predict Club funding types** | `plugins/predict-club/domain/types.ts` | ✅ Types defined |
| **Funding recommender** | `plugins/predict-club/application/recommendFundingRoute.ts` | ✅ Logic, no execution |

---

## What Can Be Reused for Predict Club

### 1. DeepBook Swap (SUI → USDC)

**Reuse from `sui-swap` plugin:**

```typescript
import { DeepBookClient, testnetCoins, testnetPools, testnetPackageIds } from '@mysten/deepbook-v3'

// Swap SUI → USDC (member funding route)
const dbClient = new DeepBookClient({ client, address, network: 'testnet', ... })
const tx = new Transaction()
dbClient.deepBook.swapExactBaseForQuote({
  poolKey: 'SUI_USDC',
  amount: suiAmount,      // SUI to sell
  deepAmount: 0,
  minOut: minUsdc,        // min USDC received (slippage protection)
})(tx)
```

**Key logic already solved:**
- Orderbook-based output estimation (`estimateSwapOutput`)
- Slippage protection (min received calculation)
- DeepBookClient instantiation per network
- Price impact calculation from orderbook depth

### 2. Scallop Borrow (SUI collateral → USDC loan)

**Available SDK (`@scallop-io/sui-scallop-sdk`):**

```typescript
import { Scallop } from '@scallop-io/sui-scallop-sdk'

const scallop = new Scallop({ networkType: 'testnet' })
const builder = await scallop.createScallopBuilder()

// Create obligation + deposit SUI + borrow USDC
const tx = builder.createTxBlock()
await tx.openObligationEntry()
await tx.depositCollateral(suiCoin, 'sui')
await tx.borrow(usdcAmount, 'usdc')
const result = tx.build()
```

**Available operations (from SDK types):**
- `ScallopBuilder` — transaction construction
- `ScallopClient` — obligation management
- `ScallopQuery` — market data, pool rates, obligation health
- `ScallopIndexer` — historical data

**Available from `sui-lending` plugin:**
- Market data API: `https://sdk.api.scallop.io/api/market/migrate`
- Pool rates (supply/borrow APY)
- Collateral factors, liquidation thresholds
- Already formatted for display

### 3. USDC → DUSDC Exchange (Club Escrow)

**Already built in `contracts/predict-club`:**

```typescript
import { createOffer, fillOffer } from '@/generated/predict-club/predict_club/exchange'

// Leader offers DUSDC, wants USDC
tx.add(createOffer({
  arguments: { market: marketId, offerCoin: dusdcCoin, wantAmount: 100_000_000n, ... },
  typeArguments: [DUSDC_TYPE, USDC_TYPE],
}))

// Member fills with USDC, receives DUSDC
tx.add(fillOffer({
  arguments: { market: marketId, offer: offerId, payment: usdcCoin },
  typeArguments: [DUSDC_TYPE, USDC_TYPE],
}))
```

---

## Implementation Plan for Predict Club Funding

### Route 1: Has DUSDC → Ready
No action needed. Member deposits directly into PredictManager.

### Route 2: Has USDC → Escrow fill
```
USDC wallet → fillOffer<DUSDC, USDC> → DUSDC → PredictManager
```
**Deps:** codegen bindings (done), published contract (TODO)

### Route 3: Has SUI → DeepBook swap + Escrow
```
SUI → DeepBook SUI_USDC swap → USDC → fillOffer → DUSDC → PredictManager
```
**Deps:** `@mysten/deepbook-v3` (installed), codegen (done)

Can be composed in single PTB:
```typescript
const tx = new Transaction()
// Step 1: swap SUI → USDC
dbClient.deepBook.swapExactBaseForQuote({ poolKey: 'SUI_USDC', ... })(tx)
// Step 2: fill escrow offer with USDC result
tx.add(fillOffer({ ... }))
// Step 3: deposit DUSDC into PredictManager (future)
```

### Route 4: Has SUI, wants to keep exposure → Scallop borrow
```
SUI collateral → Scallop borrow USDC → fillOffer → DUSDC → PredictManager
```
**Deps:** `@scallop-io/sui-scallop-sdk` (installed), needs obligation management

**Risk UI needed:**
- Health factor display
- Liquidation price warning
- Oracle freshness check

### Route 5: External assets → Bridge handoff
UI-only redirect to Wormhole/Portal bridge. No on-chain integration needed.

---

## What's Missing to Deploy

| Item | Effort | Blocking |
|------|--------|----------|
| Publish predict-club contract to testnet | 30min | P0 |
| Wire `FundingRouterPanel.tsx` with DeepBook swap execution | 2-3h | P1 |
| Wire escrow `fillOffer` into funding panel | 1-2h | P1 |
| Scallop borrow flow (obligation create + deposit + borrow) | 4-6h | P2 |
| Health monitor for Scallop positions | 2-3h | P2 |
| Multi-step PTB composition (swap+fill in one tx) | 2-3h | P1 |
| Scallop oracle freshness UI | 1h | P2 |

---

## SDK Versions & APIs

| Package | Version | Purpose |
|---------|---------|---------|
| `@mysten/deepbook-v3` | ^1.4.1 | Swap (SUI_USDC pool) |
| `@scallop-io/sui-scallop-sdk` | ^3.0.2 | Borrow USDC with SUI collateral |
| `@scallop-io/sui-kit` | ^2.0.1 | Lower-level Scallop transaction helpers |
| `@mysten/sui` | ^2.17.0 | Transaction building, RPC |
| `@mysten/codegen` | ^0.10.6 | TS bindings for predict-club contract |

## Scallop API Endpoints (from sui-lending plugin)

```
GET https://sdk.api.scallop.io/api/market/migrate
  → pools[]: { coinName, supplyApy, borrowApy, supplyCoin, borrowCoin, utilizationRate }
  → collaterals[]: { coinName, collateralFactor, liquidationFactor, liquidationPenalty }
```

## DeepBook Indexer Endpoints (from sui-swap plugin)

```
GET https://deepbook-indexer.testnet.mystenlabs.com/get_pools
  → [{ pool_id, pool_name, base_asset_symbol, quote_asset_symbol }]

GET https://deepbook-indexer.testnet.mystenlabs.com/orderbook/SUI_USDC?level=2&depth=20
  → { bids: [[price, size]], asks: [[price, size]] }

GET https://deepbook-indexer.testnet.mystenlabs.com/ticker
  → { "SUI_USDC": { last_price, base_volume, quote_volume } }
```
