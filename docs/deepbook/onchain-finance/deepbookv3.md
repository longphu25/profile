# DeepBookV3 — Decentralized CLOB on Sui

## Overview

DeepBookV3 is a fully on-chain Central Limit Order Book (CLOB) built on Sui. It uses Sui's parallel execution and low-fee settlement to deliver a high-performance exchange at the protocol layer. Unlike AMMs, every order is matched against a real order book.

DeepBookV3 does **not** ship a user-facing UI. It exposes Move modules and a TypeScript SDK that any DEX, wallet, or trading app can build on.

## When to use it

- Building a spot DEX or trading frontend on Sui
- Adding programmatic limit-order trading to a wallet
- Running market-making, arbitrage, or volume bots
- Composing with margin (`deepbook_margin`) or prediction (`deepbook_predict`) protocols

## Architecture (3 shared objects)

```
Pool (one per market)
├── Book   — orders + matching engine
├── State  — governance, history, accounts
└── Vault  — funds + DEEP price oracle

PoolRegistry (singleton)
└── Tracks all pools, prevents duplicates, enforces versioning

BalanceManager (one per user, reusable across pools)
└── Holds user funds for trading
```

### Pool

The main shared object. Public functions take `&mut Pool` or `&Pool`. Each Pool represents one market (e.g. `SUI/USDC`). Three internal components:

#### Book

Manages the matching engine. Holds two `BigVector<Order>` for bids and asks, plus metadata.

- `OrderInfo` — full order data with fills accumulated during matching
- `Order` — compact order stored in the book (minimum data for matching)
- `Fill` — partial or full match record

When placing an order: an `OrderInfo` is created, matched against the opposing side (accumulating fills), and any remaining quantity is converted to a compact `Order` and inserted into the book.

#### State

Stores three sub-modules:

- **Governance** — pool fees and stake requirements, voted by DEEP stakers each epoch
- **History** — aggregated volumes, fees collected, fees to burn (per-epoch and historical)
- **Account** — per-user data (volumes, stake, votes, unclaimed rebates, settled/owed balances)

Every transaction triggers `process_create` which calculates fees, updates accounts, and produces settled/owed balance tuples for the Vault to apply.

#### Vault

Manages physical token transfers between the pool and `BalanceManager`s:

```move
public fun settle_balance_manager(...) {
  // Compares balances_in vs balances_out
  // If out > in: vault deposits diff into BalanceManager
  // If in > out: vault withdraws diff from BalanceManager
  // Repeats for base, quote, DEEP
}
```

Also stores a `DeepPrice` struct with up to 100 data points from the whitelisted DEEP/USDC or DEEP/SUI pool. Used to convert trading fees into DEEP.

### BalanceManager

A reusable per-user account that holds funds. **One BalanceManager works across all pools.** Provides:

- Deposit/withdraw arbitrary coin types
- Generate proof-of-ownership for trading
- Mint capabilities: `TradeCap`, `DepositCap`, `WithdrawalCap` (delegate authority)

```move
public struct BalanceManager has key {
  id: UID,
  owner: address,
  balances: Bag,  // coin_type → Balance
}
```

### PoolRegistry

Singleton object used only at pool creation. Enforces uniqueness (no duplicate `(base, quote)` pairs) and tracks package versions.

### BigVector

Custom data structure for the order book — an on-chain B+ tree:

- Almost-constant-time access (log base `max_fan_out`)
- Insertion, removal, iteration
- Each node stored as a separate dynamic field

## DEEP token & tokenomics

DEEP is the protocol's utility token. Used for:

- **Trading fees** — pay in DEEP for ~20% lower fees vs paying in input token
- **Staking** — reduce taker fees by half (down to 0.25 bps stable / 2.5 bps volatile)
- **Governance** — vote on per-pool trade params each epoch

### Fee structure (governance-bounded)

| Pool type | Side | Min bps | Max bps |
|-----------|------|---------|---------|
| Volatile | Taker | 1 | 10 |
| Volatile | Maker | 0 | 5 |
| Stable | Taker | 0.1 | 1 |
| Stable | Maker | 0 | 0.5 |
| Whitelisted | Both | 0 | 0 |

### Voting power

```
V = min(S, V_c) + max(S - V_c, 0)
where V_c = 100,000 DEEP (cutoff)
```

Quorum = half of total voting power. Proposals/votes reset every epoch. Users can submit/vote starting the epoch after staking.

### Maker rebates

Eligible makers (sufficient DEEP staked + maker volume contributed) earn rebates:

```
Incentives_i = max[F_i × (1 + ΣF_j∈M̄ / ΣF_j∈M) × (1 - (ΣL_j - L_i) / p), 0]
```

Where `M` = makers with sufficient stake, `M̄` = those without, `F_i` = fees from maker i's volume, `L_i` = liquidity provided, `p` = phaseout point. If pool volume exceeds 28-day median, no rebates. Max rebates per epoch = total DEEP collected.

## Order placement flow

```
User submits order
  ↓
Pool.place_order_int(...)
  ↓
1. Create OrderInfo (with input params)
  ↓
2. Book.create_order
   ├── Validate inputs (quantity, price, expiry, type)
   ├── Match against opposing side → accumulate Fills
   └── If remaining qty: insert as Order into BigVector
  ↓
3. State.process_create
   ├── Update maker accounts from Fills
   ├── Calculate taker fee (stake-discounted if eligible)
   ├── Update history with collected fees
   └── Compute settled (base, quote, deep) and owed (base, quote, deep)
  ↓
4. Vault.settle_balance_manager
   └── Apply settled/owed to caller's BalanceManager
```

## Order types

```typescript
enum OrderType {
  NO_RESTRICTION = 0,  // standard limit order, can match
  IMMEDIATE_OR_CANCEL = 1,  // IOC: fill what you can, cancel rest
  FILL_OR_KILL = 2,  // FOK: fill all or none
  POST_ONLY = 3,  // never take, only make
}
```

## Self-match prevention

```typescript
enum SelfMatchingOptions {
  SELF_MATCHING_ALLOWED = 0,
  CANCEL_TAKER = 1,    // cancel new taker if matches own maker
  CANCEL_MAKER = 2,    // cancel old maker if matches own taker
}
```

## Account state

Each `Account` (1-to-1 with `BalanceManager`) tracks:

- **Settled balances** — what the pool owes the user (paid out by vault on next tx)
- **Owed balances** — what the user owes the pool (deducted by vault on next tx)
- Unclaimed maker rebates (per-epoch, claimed via `claimRebates`)
- Active stake and voted proposal
- Volumes for current epoch

## Pool examples

### Mainnet pools (selected)

| Pair | Pool key | Base scalar | Quote scalar |
|------|----------|-------------|--------------|
| SUI/USDC | `SUI_USDC` | 1e9 | 1e6 |
| DEEP/SUI | `DEEP_SUI` | 1e6 | 1e9 |
| WAL/USDC | `WAL_USDC` | 1e9 | 1e6 |
| XBTC/USDC | `XBTC_USDC` | 1e8 | 1e6 |
| WBTC/USDC | `WBTC_USDC` | 1e8 | 1e6 |

### Testnet pools

| Pair | Pool key | Notes |
|------|----------|-------|
| SUI/DBUSDC | `SUI_DBUSDC` | Use for SDK examples |
| DEEP/SUI | `DEEP_SUI` | DEEP fee-payment pool |
| DBTC/DBUSDC | `DBTC_DBUSDC` | BTC test pair |

Pool definitions ship in `@mysten/deepbook-v3` as `mainnetPools` / `testnetPools`.

## Contract IDs (mainnet)

```
DEEPBOOK_PACKAGE_ID:  0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748
REGISTRY_ID:          0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d
DEEP_TREASURY_ID:     0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe
```

## Contract IDs (testnet)

```
DEEPBOOK_PACKAGE_ID:  0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c
REGISTRY_ID:          0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1
DEEP_TREASURY_ID:     0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb
```

## TypeScript SDK quick reference

See [sdk-reference.md](./sdk-reference.md) for full API. Common patterns:

```typescript
import { DeepBookClient, mainnetPools, mainnetCoins } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'

const dbClient = new DeepBookClient({
  client: new SuiGrpcClient({ network: 'mainnet', baseUrl: '...' }),
  network: 'mainnet',
  address: walletAddress,
  pools: mainnetPools,
  coins: mainnetCoins,
  balanceManagers: { main: { address: bmId } },
})

// Place a limit order
const tx = new Transaction()
tx.add(dbClient.deepBook.placeLimitOrder({
  poolKey: 'SUI_USDC',
  balanceManagerKey: 'main',
  clientOrderId: Date.now().toString(),
  price: 1.5,
  quantity: 10,
  isBid: true,
  orderType: OrderType.NO_RESTRICTION,
  payWithDeep: true,
}))
```

## Indexer

Public DeepBookV3 Indexer endpoints:

- Mainnet: `https://deepbook-indexer.mainnet.mystenlabs.com`
- Testnet: `https://deepbook-indexer.testnet.mystenlabs.com`

Common endpoints:

| Endpoint | Returns |
|----------|---------|
| `GET /get_pools` | Pool metadata (lot_size, min_size, decimals) |
| `GET /summary` | 24h volume + price change per pool |
| `GET /ticker` | Current last_price per pool |
| `GET /orderbook/:pool?level=2&depth=N` | Bids + asks |
| `GET /trades/:pool` | Recent trades |
| `GET /historical_volume/:pool` | Historical OHLCV |
| `GET /orders/:pool/:bm_id` | User open orders |

## Common issues

### Pool not in SDK

```
Error: Pool X not in SDK
```

Make sure your `pools` config includes the pool key. Use `mainnetPools` / `testnetPools` from the SDK or define custom pools.

### Swap returns 3 coins

`swapExactBaseForQuote` and `swapExactQuoteForBase` return `[baseCoin, quoteCoin, deepCoin]`. All three must be transferred:

```typescript
// ❌ Wrong — UnusedValueWithoutDrop error
const [base] = db.deepBook.swapExactBaseForQuote(...)(tx)
tx.transferObjects([base], owner)

// ✅ Correct
const result = db.deepBook.swapExactBaseForQuote(...)(tx)
tx.transferObjects([...result], owner)
```

### Don't pass `packageIds` for margin

For margin operations, let the SDK auto-resolve:

```typescript
// ❌ Wrong — causes marginPools = {}
new DeepBookClient({ ..., packageIds: mainnetPackageIds, marginManagers: {...} })

// ✅ Correct
new DeepBookClient({ ..., network: 'mainnet', marginManagers: {...} })
```

## Related

- [DeepBook Margin](./deepbook-margin.md) — leverage on top of DeepBookV3
- [DeepBook Predict](./deepbook-predict.md) — vol-surface prediction markets
- [SDK Reference](./sdk-reference.md) — practical TypeScript API
- [Whitepaper: DeepBook Token](https://docs.sui.io/assets/files/deepbook-3e24e6e1deeb8cd860682c1fb473b597.pdf)
