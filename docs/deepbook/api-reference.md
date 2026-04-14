# DeepBook v3 — API & SDK Reference

Technical reference cho tất cả DeepBook integrations trong project.

---

## DeepBook Indexer REST API

Public indexer, không cần auth. Read-only.

**Base URLs:**
```
Mainnet: https://deepbook-indexer.mainnet.mystenlabs.com
Testnet: https://deepbook-indexer.testnet.mystenlabs.com
```

### Endpoints

#### `GET /get_pools`
Danh sách tất cả pools.

```json
[{
  "pool_id": "0x1109...",
  "pool_name": "SUI_USDC",
  "base_asset_symbol": "SUI",
  "quote_asset_symbol": "USDC",
  "base_asset_decimals": 9,
  "quote_asset_decimals": 6,
  "min_size": 1000000,
  "lot_size": 100000,
  "tick_size": 10000
}]
```

**Used by:** pool-explorer, swap, orderbook, history, hedging-bot

#### `GET /ticker`
Current prices per pool. Returns `Record<pool_name, TickerEntry>`.

```json
{
  "SUI_USDC": { "last_price": 0.9439 },
  "DEEP_SUI": { "last_price": 0.03058 }
}
```

**Used by:** price-feed, swap, hedging-bot

#### `GET /summary`
24h stats per pool. Returns array.

```json
[{
  "trading_pairs": "SUI_USDC",
  "last_price": 0.9439,
  "price_change_percent_24h": 3.87,
  "quote_volume": 8710294.88,
  "highest_bid": 0.9438,
  "lowest_ask": 0.9440,
  "highest_price_24h": 0.964,
  "lowest_price_24h": 0.8998
}]
```

**Used by:** hedging-bot (volatility ranking), pool-explorer

#### `GET /orderbook/:pool`
Level 2 orderbook.

Query params: `level=2&depth=20`

```json
{
  "timestamp": "...",
  "bids": [["0.9438", "1500.5"], ["0.9437", "2300.0"]],
  "asks": [["0.9440", "800.2"], ["0.9441", "1200.0"]]
}
```

**Used by:** orderbook, swap, hedging-bot (mini orderbook)

#### `GET /ohclv/:pool`
OHLCV candle data.

Query params: `resolution=60` (minutes)

**Used by:** price-feed (sparkline charts)

#### `GET /trades/:pool`
Recent trades per pool.

Query params: `limit=50`

```json
[{
  "price": 0.03047,
  "base_volume": 400.0,
  "quote_volume": 12.188,
  "taker_is_bid": true,
  "maker_fee": 0.0,
  "taker_fee": 0.0,
  "maker_fee_is_deep": false,
  "taker_fee_is_deep": false,
  "timestamp": 1776150606508,
  "digest": "3Ak3nF8..."
}]
```

**Used by:** history

#### `GET /portfolio/:address`
Margin positions, collateral, LP for a balance manager.

```json
{
  "margin_positions": [{
    "pool": "SUI_USDC",
    "base_asset": 100.5,
    "quote_asset": 50.2,
    "base_debt": 0,
    "quote_debt": 10.5,
    "risk_ratio": 0.15,
    "net_value_usd": 85.3
  }],
  "collateral_balances": [...],
  "lp_positions": [...],
  "summary": { "total_equity_usd": 100, "total_debt_usd": 10, "net_value_usd": 90 }
}
```

**Used by:** portfolio, margin-manager

#### `GET /orders/:pool/:balance_manager`
Open orders for a specific manager.

**Used by:** margin-manager

#### `GET /get_points`
DeepBook points (currently returns empty — program may be inactive).

**Used by:** portfolio (points badge)

---

## DeepBook v3 SDK (`@mysten/deepbook-v3`)

On-chain operations via TypeScript SDK.

### Setup

```typescript
import {
  DeepBookClient,
  mainnetCoins, mainnetPools, mainnetPackageIds,
  testnetCoins, testnetPools, testnetPackageIds,
} from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: 'https://fullnode.mainnet.sui.io:443',
})

const dbClient = new DeepBookClient({
  client,
  address: walletAddress,
  network: 'mainnet',
  coins: mainnetCoins,
  pools: mainnetPools,
  packageIds: mainnetPackageIds,
})
```

### Swap Operations

```typescript
const tx = new Transaction()

// Buy base (spend quote → receive base)
dbClient.deepBook.swapExactQuoteForBase({
  poolKey: 'DEEP_SUI',
  amount: 10.0,      // quote amount (SUI)
  deepAmount: 0,      // DEEP fee (0 = pay in quote)
  minOut: 300.0,      // minimum base received
})(tx)

// Sell base (spend base → receive quote)
dbClient.deepBook.swapExactBaseForQuote({
  poolKey: 'DEEP_SUI',
  amount: 300.0,      // base amount (DEEP)
  deepAmount: 0,
  minOut: 9.5,        // minimum quote received
})(tx)
```

### Pool Key Validation

```typescript
function isSdkPool(poolKey: string, network: 'mainnet' | 'testnet'): boolean {
  const pools = network === 'mainnet' ? mainnetPools : testnetPools
  return poolKey in pools
}
```

Not all indexer pools are in the SDK. SDK pools (mainnet):
`SUI_USDC`, `DEEP_SUI`, `DEEP_USDC`, `WAL_SUI`, `WAL_USDC`,
`WUSDT_USDC`, `WUSDC_USDC`, `NS_SUI`, `NS_USDC`, etc.

---

## Fee Structure

| Type | Fee | Notes |
|------|-----|-------|
| Maker | **0** | Free for limit/POST_ONLY orders |
| Taker | ~0.025% | Paid in DEEP or quote token |
| DEEP stakers | Reduced taker | Stake DEEP for fee discount |

Hedging bot uses maker orders → **zero fees**.

---

## Sui JSON-RPC Endpoints Used

### `suix_getAllBalances`
Get all coin balances for an address.

```typescript
const res = await fetch(RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'suix_getAllBalances',
    params: [address],
  }),
})
// Result: [{ coinType: "0x2::sui::SUI", totalBalance: "10000000000", coinObjectCount: 3 }]
```

**Used by:** hedging-bot (keystore picker, funding check)

### Transaction Building

```typescript
import { Transaction } from '@mysten/sui/transactions'

const tx = new Transaction()
tx.setSender(senderAddress)

// Split and transfer SUI
const [coin] = tx.splitCoins(tx.gas, [amountInMist])
tx.transferObjects([coin], recipientAddress)

// Build and sign
const built = await tx.build({ client })
const sig = await keypair.signTransaction(built)
await client.executeTransactionBlock({
  transactionBlock: built,
  signature: [sig.signature],
})
```

---

## RPC URLs

```
Mainnet: https://fullnode.mainnet.sui.io:443
Testnet: https://fullnode.testnet.sui.io:443
Devnet:  https://fullnode.devnet.sui.io:443
```

---

## Explorer URLs

```
Mainnet: https://suiscan.xyz/mainnet/tx/{digest}
Testnet: https://suiscan.xyz/testnet/tx/{digest}
```
