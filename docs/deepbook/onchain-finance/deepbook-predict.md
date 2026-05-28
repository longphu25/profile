# DeepBook Predict

> **Testnet only** — DeepBook Predict is currently a Testnet integration target. Mainnet launch is planned. Package IDs will change at launch.

## Overview

DeepBook Predict is an **expiry-based prediction market** on Sui where every strike and expiry is priced against an on-chain SVI volatility surface. Users mint binary positions (UP/DOWN) or vertical ranges, and a shared vault takes the opposite side of every trade. LPs supply quote assets to the vault and receive `PLP` LP shares.

This is **not** a typical event-betting market — it's a real options-like protocol with rolling sub-hour expiries on BTC.

## When to use it

- Build prediction-market frontends with vol-aware pricing
- Run vol-arb bots between Predict and external option markets
- Provide liquidity (LP) to earn yield on a hedged book
- Compose with `deepbook_margin` and `iron_bank` for leveraged strategies

## Core concepts

### 4 main shared objects

```
Predict (singleton)
├── Holds vault balances, pricing config, risk config
├── Quote-asset allowlist
├── Oracle strike grids
├── Withdrawal-limiter config
└── PLP TreasuryCap

PredictManager (per user)
├── Wraps a BalanceManager
├── Stores deposited quote balances
├── Tracks binary position quantities (table keyed by MarketKey)
└── Tracks vertical range quantities (table keyed by RangeKey)

OracleSVI (per asset+expiry)
├── Spot price
├── Forward price
├── SVI volatility parameters
├── Lifecycle status
├── Last update timestamp
└── Settlement price (after expiry)

Vault (inside Predict)
├── Accepted quote asset balances
├── Mark-to-market liability
├── Maximum payout
└── Compact settled-oracle state
```

## Position types

### Binary positions

Key: `(oracle_id, expiry, strike, is_up)`

```move
struct MarketKey has copy, drop, store {
  oracle_id: ID,
  expiry: u64,
  strike: u64,
  direction: u8,  // 0 = up, 1 = down
}
```

- **UP position** — pays if `settlement_price > strike`
- **DOWN position** — pays if `settlement_price < strike`
- Priced from oracle fair price + protocol spread + utilization adjustment

### Vertical ranges

Key: `(oracle_id, expiry, lower_strike, higher_strike)`

```move
struct RangeKey has copy, drop, store {
  oracle_id: ID,
  expiry: u64,
  lower_strike: u64,
  higher_strike: u64,
}
```

- Pays when `settlement_price ∈ (lower_strike, higher_strike]`
- Priced as a single bounded instrument
- More capital-efficient than binary for range-bound views

## Oracle lifecycle

```
Inactive → Active → Pending Settlement → Settled
```

| State | Mints allowed | Redeems allowed | Updates allowed |
|-------|---------------|-----------------|-----------------|
| Inactive | ❌ | ❌ | ❌ |
| Active | ✅ | ✅ (live price) | ✅ |
| Pending Settlement | ❌ | ✅ (live price) | First post-expiry freezes price |
| Settled | ❌ | ✅ (settlement price) | ❌ |

## SVI volatility surface

The oracle stores 5 SVI parameters that model the entire smile:

```
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
IV(K) = √(w(k) / T) × 100%
```

Where:
- `k = ln(K/F)` — log-moneyness (K = strike, F = forward)
- `a` — overall variance level (vertical shift)
- `b` — slope (controls wing steepness)
- `ρ` — skew (-1 to 1, negative = put skew)
- `m` — horizontal shift of smile minimum
- `σ` — curvature at vertex (ATM smoothness)
- `T` — time to expiry in years

### On-chain parameter encoding

| Parameter | Format | Decode |
|-----------|--------|--------|
| `a`, `b`, `m`, `sigma` | integer | `÷ 1e6` |
| `rho` | integer + `rho_negative` bool | `÷ 1e9`, negate if flag |
| `spot`, `forward`, `strike` | integer | `÷ 1e9` (USD) |

### Butterfly arbitrage check

For 3 consecutive strikes K₁ < K₂ < K₃:

```
IV_expected(K₂) = w·IV(K₁) + (1−w)·IV(K₃)
where w = (K₃ − K₂) / (K₃ − K₁)
```

Violation flagged if `IV(K₂) > IV_expected × 1.02`. Indicates potential arbitrage opportunity.

## Vault accounting

```
vault_value = vault_balance − total_MTM
PLP_share_price = vault_value / total_PLP_supply
utilization = total_MTM / vault_value
max_payout_utilization = total_max_payout / vault_balance
available_liquidity = vault_balance − total_max_payout
```

### LP share calculation

```
new_shares = deposit_amount × (total_PLP_supply / vault_value)
```

First supplier receives shares 1:1 with deposit amount. Later suppliers receive proportional to vault value.

### Vault risk

The vault takes the **opposite side** of every trade — it's a counterparty. LP risk:

- BTC moves against open positions → MTM increases → vault value drops → PLP price drops
- Crash scenarios: many DOWN binaries become ITM → vault pays out → PLP loses

## User flow

### Trader flow

```
1. Get oracle data from public Predict server
2. Select active oracle and strike (must align to tick_size)
3. Create or find a PredictManager
4. Deposit DUSDC into the manager
5. Preview mint amount via server
6. Submit mint_position or mint_range transaction
7. (Optional) Redeem before expiry against live oracle
8. After settlement: redeem against settlement price
```

### LP flow

```
1. Check vault summary (balance, utilization, share price)
2. Call predict::supply with DUSDC amount
3. Receive PLP shares proportional to vault value
4. Earn yield from vault PnL (oppositional to trader losses)
5. Withdraw by burning PLP — subject to available liquidity
```

## Pricing and risk

### Pricing components

```
mint_cost = oracle_fair_price + protocol_spread + utilization_adjustment
```

- **oracle_fair_price** — derived from SVI surface
- **protocol_spread** — bid/ask spread set by governance
- **utilization_adjustment** — increases as vault utilization rises

### Risk enforcement

After every mint, the vault asserts:

```
total_MTM ≤ max_total_exposure_pct × vault_balance
```

If a mint would exceed this, the transaction aborts. This protects LPs from over-exposure.

### Ask bounds

- **Global ask bounds** — protocol-wide max ask price for any oracle
- **Per-oracle ask bounds** — tighter limits per oracle (set by oracle cap)

Mints with post-spread ask prices outside these bounds are rejected.

## Strike validation

```
strike >= min_strike  AND  (strike − min_strike) % tick_size == 0
```

Example oracle:
- `min_strike` = `50_000_000_000_000` (= $50,000)
- `tick_size` = `1_000_000_000` (= $1)

Valid strikes: $50,000, $50,001, $51,000, $75,000, etc.
Invalid: $49,500 (below min), $50,000.50 (not aligned).

## Contract IDs (testnet, predict-testnet-4-16)

```
Predict Package:        0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
Predict Object:         0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
Predict Registry:       0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
Quote Asset (DUSDC):    0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
PLP Coin Type:          {package}::plp::PLP
Public Server:          https://predict-server.testnet.mystenlabs.com
```

## Public server endpoints

### Protocol & market state

- `GET /status` — server health
- `GET /predicts/:id/state` — protocol config
- `GET /predicts/:id/oracles` — list oracles
- `GET /oracles/:id/state` — oracle detail (spot, forward, SVI)
- `GET /predicts/:id/quote-assets` — accepted quote assets
- `GET /oracles/:id/ask-bounds` — resolved ask bounds

### Vault & LP data

- `GET /predicts/:id/vault/summary` — vault metrics
- `GET /predicts/:id/vault/performance?range=ALL` — PLP share price history
- `GET /lp/supplies` — supply history
- `GET /lp/withdrawals` — withdrawal history

### Manager & portfolio

- `GET /managers` — all PredictManagers
- `GET /managers/:id/summary` — manager summary
- `GET /managers/:id/positions/summary` — open positions
- `GET /managers/:id/pnl?range=ALL` — manager PnL

### History

- `GET /oracles/:id/prices` — price history
- `GET /oracles/:id/svi` — SVI parameter history
- `GET /positions/minted` — global mint history
- `GET /positions/redeemed` — global redeem history
- `GET /ranges/minted`, `GET /ranges/redeemed` — range history
- `GET /trades/:oracle_id` — trades per oracle

## On-chain function reference

### Manager creation

```move
public fun predict::create_manager(ctx: &mut TxContext): ID
```

Creates a shared `PredictManager`, returns its `ID`. **The actual object is shared** — must be queried via indexer or events to use in subsequent transactions.

### Mint binary

```move
public fun predict::mint<T>(
  predict: &mut Predict,
  manager: &mut PredictManager,
  oracle: &OracleSVI,
  market_key: MarketKey,
  amount: u64,
  clock: &Clock,
  ctx: &mut TxContext,
)
```

`market_key` must be constructed via `market_key::new(oracle_id, expiry, strike, direction)`.

### Mint range

```move
public fun predict::mint_range<T>(
  predict: &mut Predict,
  manager: &mut PredictManager,
  oracle: &OracleSVI,
  range_key: RangeKey,
  amount: u64,
  clock: &Clock,
  ctx: &mut TxContext,
)
```

`range_key` must be constructed via `range_key::new(oracle_id, expiry, lower, higher)`.

### Redeem

```move
public fun predict::redeem<T>(...)
public fun predict::redeem_range<T>(...)
public fun predict::redeem_permissionless(...)  // for settled positions
```

### Vault operations

```move
public fun predict::supply<T>(...)    // DUSDC → PLP
public fun predict::withdraw<T>(...)  // PLP → DUSDC
public fun predict::compact_settled_oracle(...)  // gas-saving optimization
```

## Live event monitoring

Subscribe to these events for low-latency oracle updates:

- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

Filter by `package = PREDICT_PACKAGE`.

## Common pitfalls

### Manager not found in same PTB

`create_manager` returns an `ID`, not the object reference. The actual `PredictManager` is shared. **You cannot use it in the same PTB.** Split into two transactions:

```
TX 1: predict::create_manager → wait for indexer → fetch manager_id
TX 2: tx.object(manager_id) → predict::mint_range(...)
```

### Strike must align to tick

```typescript
// ❌ Wrong — random USD value
const strikeRaw = Math.floor(75000.5 * 1e9)  // not aligned

// ✅ Correct — snap to tick
const minStrike = 50_000_000_000_000
const tickSize = 1_000_000_000
const aligned = minStrike + Math.round((75000 * 1e9 - minStrike) / tickSize) * tickSize
```

### Type argument required

`mint`, `mint_range`, `supply`, `withdraw` are generic over `T`. Always pass:

```typescript
typeArguments: [DUSDC_TYPE]
```

### Clock object

All trading functions require the system Clock at `0x6`:

```typescript
arguments: [..., tx.object('0x6')]
```

## TypeScript SDK

The standard `@mysten/deepbook-v3` SDK does NOT yet include Predict bindings. You must build PTBs manually:

```typescript
import { Transaction } from '@mysten/sui/transactions'

const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const DUSDC_TYPE = '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'

// Mint range position
const tx = new Transaction()
tx.setSender(walletAddress)

const rangeKey = tx.moveCall({
  target: `${PREDICT_PACKAGE}::range_key::new`,
  arguments: [
    tx.pure.id(oracleId),
    tx.pure.u64(expiry),
    tx.pure.u64(lowerStrikeRaw),
    tx.pure.u64(upperStrikeRaw),
  ],
})

tx.moveCall({
  target: `${PREDICT_PACKAGE}::predict::mint_range`,
  typeArguments: [DUSDC_TYPE],
  arguments: [
    tx.object(PREDICT_ID),
    tx.object(managerId),
    tx.object(oracleId),
    rangeKey[0],
    tx.pure.u64(amountRaw),
    tx.object('0x6'),
  ],
})
```

## Composability examples

### PLP + Hedge Vault

Supply DUSDC to vault for yield. Buy OTM DOWN binaries to cap left-tail drawdown. Net position = "PLP yield minus crash insurance."

```
Capital: $5,000
- 80% supply to PLP (earn yield)
- 20% buy DOWN binaries at -10% strikes (insurance)

If BTC stable: earn PLP yield, hedge expires worthless
If BTC crashes: hedge pays out, offsets PLP loss
```

### Three-Protocol Margin Loop

Stack iron_bank + deepbook_margin + predict in one PTB:

```
1. iron_bank::deposit(USDC) → USDsui shares
2. deepbook_margin::borrow(USDsui as collateral) → dUSDC
3. predict::mint_range(dUSDC) × N positions
4. At settlement: payouts repay margin, remaining = profit
```

Liquidation path: if LTV breaches threshold, close predict → repay margin → withdraw iron_bank.

## Limitations

- Testnet only (mainnet IDs will change)
- DUSDC required (request via tally form)
- Only BTC oracles currently active (sub-hour expiries)
- No client-side mint preview — pricing computed on-chain only
- LP risk uncapped on the upside (vault takes all trader gains)
- Single oracle per expiry — no multi-leg strategies yet

## Related

- [DeepBookV3](./deepbookv3.md) — quote asset (DUSDC) borrows from this layer
- [DeepBook Margin](./deepbook-margin.md) — composable for leverage
- [Closed-Loop Token](./closed-loop-token.md) / [PAS](./pas.md) — DUSDC could be CLT/PAS in future
- [SDK Reference](./sdk-reference.md) — code examples
- [Plugin source](../../plugins/sui-deepbook-predict/) — full reference implementation
- [Test token request](https://tally.so/r/Xx102L)
