# Predict Club DevInspect Pricing Notes

This note records the pricing behavior observed from the public DeepBook Predict
testnet UI at `https://predict.magicdima.xyz` on 2026-06-06. Use it as a
reference when replacing Predict Club's local payout preview with a quote path
that is closer to real execution.

## Observed Source

Inspected page:

- `https://predict.magicdima.xyz/oracles/0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951`

Observed public server calls:

- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/state`
- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/svi`
- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/svi/latest`
- `GET https://predict-server.testnet.mystenlabs.com/trades/:oracle_id`
- `GET https://predict-server.testnet.mystenlabs.com/predicts/:predict_id/oracles`
- `GET https://predict-server.testnet.mystenlabs.com/managers?owner=:wallet`

Observed testnet constants in the public bundle:

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Package ID | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict ID | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Quote asset | `DUSDC` |
| Quote decimals | `6` |
| Quote type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| PLP type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Clock ID | `0x6` |

## Pricing Path

The observed app does not use a simple `1 / probability` payout estimate for
the New Position panel. It builds a Sui transaction and calls
`devInspectTransactionBlock` to quote the all-in mint cost before a user signs.

For ABOVE and BELOW:

1. Build `market_key::new(oracle_id, expiry, strike, is_up)`.
2. Call `predict::get_trade_amounts`.
3. For execution, call `predict::mint`.

For RANGE:

1. Build `range_key::new(oracle_id, expiry, low_strike, high_strike)`.
2. Call `predict::get_range_trade_amounts`.
3. For execution, call `predict::mint_range`.

If a user has no PredictManager, the UI routes through manager creation first.
If the manager exists but has insufficient DUSDC, execution must deposit DUSDC
into the manager before minting.

## UI Price Formulas

The UI quantity input is a whole number of contracts. One contract maps to
`1_000_000` quote base units, because DUSDC uses 6 decimals.

Given:

- `contracts`: whole-number contract count from the UI.
- `mintCost`: quoted cost in DUSDC for all requested contracts.
- `grossIfWin`: `contracts * 1 DUSDC`.

The observed UI computes:

```text
contractPrice = mintCost / contracts
estimatedCost = mintCost
grossIfWin = contracts * 1 DUSDC
potentialPayout = grossIfWin - mintCost
riskReward = potentialPayout / mintCost
```

Important naming note: the observed label `Potential payout` is the potential
profit after subtracting cost, not the gross payout. In Predict Club, prefer
`Potential profit` or show both `Cost` and `Gross if win`.

Example from the inspected BTC round:

```text
Contracts: 100
Contract price: 0.7350 DUSDC
Estimated cost: 73.5019 DUSDC
Gross if win: 100.0000 DUSDC
Potential profit: 26.4981 DUSDC
Risk/Reward: 26.4981 / 73.5019 = 0.36
```

## SVI Fair-Value Formula

The same app also displays SVI parameters and can derive a fair value from the
oracle state. This is useful for explanation, validation, and fallback, but it
is not enough to reproduce the all-in execution price because the contract can
apply spread, utilization, and other risk checks.

Observed scale:

```text
a = raw_a / 1e9
b = raw_b / 1e9
rho = signed(raw_rho, rho_negative) / 1e9
m = signed(raw_m, m_negative) / 1e9
sigma = raw_sigma / 1e9
```

For strike `K` and forward `F`:

```text
k = ln(K / F)
d = k - m
w = max(a + b * (rho * d + sqrt(d * d + sigma * sigma)), 2^-52)
vol = sqrt(w)
d2 = -((k + w / 2) / vol)
aboveFair = NormalCDF(d2)
belowFair = 1 - aboveFair
rangeFair = aboveFair(lowStrike) - aboveFair(highStrike)
```

Sample from oracle
`0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951` at the
time of inspection:

```text
Displayed strike: 59,000
Raw strike: 59,000 * 1e9 = 59000000000000
Forward: 60650626321011
Spot: 60654873219100
a: 222080
b: 21762204
rho: -271513412
m: 10044882
sigma: 51985568

k ~= -0.0275925
w ~= 0.00184117
vol ~= 0.0429088
d2 ~= 0.621595
aboveFair ~= 0.732896
```

This explains why an ABOVE contract at `59,000` was shown around `0.733-0.735`
DUSDC while the oracle and SVI were updating live.

## Implementation Plan For Predict Club

1. Add `deepbookPredictPricingService` for quote preview.
   - Load oracle state from `/oracles/:id/state`.
   - Load SVI history/latest from `/oracles/:id/svi` or `/svi/latest` for
     explanation and stale-state checks.
   - Load manager state from `/managers?owner=:wallet` when a wallet is
     connected.

2. Implement a `devInspect` quote path.
   - ABOVE/BELOW: build the market key and call `predict::get_trade_amounts`.
   - RANGE: build the range key and call `predict::get_range_trade_amounts`.
   - Return `contractPrice`, `estimatedCost`, `grossIfWin`,
     `potentialProfit`, `riskReward`, and the raw quote payload.

3. Keep the local SVI function as a fair-value fallback.
   - Port `computeFairValue` and `computeRangeFairValue`.
   - Mark fallback output as `degraded: true`.
   - Show `Preview unavailable` when forward, SVI, strike, or quantity is
     invalid.

4. Update UI labels.
   - Replace `Indicative Payout` with `Potential profit` when the number is net
     profit.
   - Show `Gross if win` separately for clarity.
   - Keep `Win Probability` tied to SVI fair value and mark it as approximate
     unless confirmed by contract quote metadata.

5. Add deterministic tests.
   - Unit-test SVI normalization and ABOVE/BELOW/RANGE fair value.
   - Mock `devInspectTransactionBlock` for quote preview.
   - Add Playwright coverage for valid quote, unavailable quote, stale SVI, and
     connected wallet without manager.

## Product Guardrails

- Never present SVI fair value as a guaranteed execution quote.
- Do not show very large numbers from `1 / probability` as payout odds.
- For execution UI, prefer contract quote from `devInspect`.
- If quote preview cannot be produced, show the reason instead of fabricated
  odds.
- If `ask_bounds` are available from API state, validate the average ask against
  the min/max bounds before enabling execution.

## Portfolio And Open Contracts

Observed page:

- `https://predict.magicdima.xyz/positions`

The page title is `Portfolio`, with the description:

```text
Manager-owned BTC/DUSDC positions for the connected wallet.
```

The route uses the connected wallet address to:

1. Query the Predict server for manager events:
   `GET /managers?owner=:wallet`.
2. Pick the latest manager event whose `owner` matches the connected wallet.
3. Load the manager Move object by `manager_id`.
4. Read these fields from the manager object:
   - `balance_manager`
   - `owner`
   - `positions`
   - `range_positions`
5. Read manager DUSDC balance from the BalanceManager dynamic fields.
6. Read only the binary `positions` table for display.

The manager object already exposes both table sizes:

```text
positionsSize = manager.positions.fields.size
rangePositionsSize = manager.range_positions.fields.size
hasPositions = positionsSize > 0 || rangePositionsSize > 0
```

However, the current route only calls the binary positions loader. It does not
page through `range_positions`, so RANGE positions are known at the manager
metadata level but are not charted or listed.

Binary position row shape observed from the bundle:

```ts
interface BinaryManagerPosition {
  id: string
  oracleId: string
  expiry: number
  isUp: boolean
  strike: number
  quantity: bigint
}
```

The table shows:

- oracle link
- side: ABOVE or BELOW
- strike
- quantity
- cost preview
- PnL preview
- expiry
- settlement
- state
- close action

For active oracles, cost and live close preview use
`predict::get_trade_amounts` through `devInspect`. For settled oracles, payout
is calculated locally from `settlement_price`:

```text
ABOVE wins when settlement_price > strike
BELOW wins when settlement_price <= strike
settled redeem payout = quantity if win, else 0
```

The close flow builds one wallet-signed transaction that:

1. Calls `predict::redeem` or `predict::redeem_permissionless`.
2. Calls `predict_manager::withdraw` for the positive DUSDC payout.
3. Transfers the withdrawn DUSDC to the connected wallet.

### Why RANGE Is Not Displayed Yet

The public UI states `Range positions are not displayed yet` in both the chart
header and table helper text. The chart component only understands:

```ts
direction: 'ABOVE' | 'BELOW'
strike: number
quantity: number
upQuantity: number
downQuantity: number
```

It does not model a range key with `lowStrike` and `highStrike`. Supporting
RANGE positions requires a separate loader, chart bucket, row renderer, close
preview, and settled payout rule.

Predict Club should treat this as a real product gap rather than a cosmetic UI
issue.

Implementation plan:

1. Add `loadBinaryManagerPositions(manager.positionsTableId)`.
2. Add `loadRangeManagerPositions(manager.rangePositionsTableId)`.
3. Represent portfolio rows as a discriminated union:

   ```ts
   type PortfolioPosition =
     | { kind: 'binary'; oracleId: string; expiry: number; isUp: boolean; strike: number; quantity: bigint }
     | { kind: 'range'; oracleId: string; expiry: number; lowStrike: number; highStrike: number; quantity: bigint }
   ```

4. Use `predict::get_trade_amounts` for binary close preview.
5. Use `predict::get_range_trade_amounts` for RANGE close preview.
6. For settled RANGE payout, confirm contract semantics before shipping. The
   likely rule is `lowStrike < settlement_price <= highStrike`, but this must be
   verified against Move code or an observed settled RANGE position.
7. Update charting so binary and range positions are visually distinct.
8. Add table rows for RANGE with low/high strikes and a close action.
9. Add tests for manager with only range positions, mixed binary/range
   positions, active close preview, settled payout, and unavailable oracle
   state.

## Vaults

Observed page:

- `https://predict.magicdima.xyz/vaults`

The page is an LP interface for Predict's shared DUSDC vault. It lets a wallet
supply DUSDC liquidity and receive PLP shares, or burn PLP shares to withdraw
DUSDC.

The UI headline is:

```text
Supply DUSDC liquidity or withdraw by burning PLP shares.
```

### State Source

Vault state is read from the Predict Move object:

```text
Predict ID: 0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
```

Observed fields:

```text
treasury_cap.total_supply.fields.value -> total PLP supply
vault.balance                         -> vault DUSDC balance
vault.total_mtm                       -> estimated open position payout / mark-to-market
vault.total_max_payout                -> max payout exposure
withdrawal_limiter.available          -> limiter available
withdrawal_limiter.capacity           -> limiter capacity
withdrawal_limiter.enabled            -> limiter state
```

Derived values:

```text
vaultValue = vault.balance - vault.total_mtm
availableLiquidity = max(vault.balance - vault.total_max_payout, 0)
availableWithdrawal = min(predict::available_withdrawal(), availableLiquidity)
```

When the withdrawal limiter is disabled, `predict::available_withdrawal()` can
effectively be higher than `availableLiquidity`, so the UI still caps the
withdrawable amount by max-payout coverage.

### Wallet Position

The UI reads wallet balances for:

- DUSDC quote asset.
- PLP shares.

Wallet LP share:

```text
walletLpShare = walletPlpBalance / totalPlpSupply
```

### Supply And Withdraw Formulas

For supply, the input asset is DUSDC and estimated output is PLP:

```text
if totalPlpSupply == 0 or vaultValue <= 0:
  estimatedPlp = inputDusdc
else:
  estimatedPlp = inputDusdc * totalPlpSupply / vaultValue
```

For withdraw, the input asset is PLP and estimated output is DUSDC:

```text
if totalPlpSupply == 0:
  estimatedDusdc = 0
else:
  estimatedDusdc = inputPlp * vaultValue / totalPlpSupply
```

Validation:

- Wallet must be connected.
- Vault data must be loaded.
- Supply amount must not exceed wallet DUSDC balance.
- Withdraw amount must not exceed wallet PLP balance.
- Withdraw output must not exceed `availableWithdrawal`.

### Transactions

Supply builds a wallet-signed transaction:

```text
predict::supply<DUSDC>(predict_id, dusdc_coin, clock)
transfer returned PLP to wallet
```

Withdraw builds a wallet-signed transaction:

```text
predict::withdraw<DUSDC>(predict_id, plp_coin, clock)
transfer returned DUSDC to wallet
```

### Activity

The page reads liquidity activity from:

```text
GET https://predict-server.testnet.mystenlabs.com/lp/supplies
GET https://predict-server.testnet.mystenlabs.com/lp/withdrawals
```

The chart groups the latest 14 days of supply/withdrawal events by day. The UI
supports log and linear display. The table shows the latest 25 events.

Supply event fields used:

```text
amount
checkpoint
checkpoint_timestamp_ms
event_digest
event_index
sender
shares_minted
supplier
```

Withdrawal event fields used:

```text
amount
checkpoint
checkpoint_timestamp_ms
event_digest
event_index
sender
shares_burned
withdrawer
```

### Probe Script

This repo now includes a read-only probe script for the wallet/oracle flow:

```bash
rtk bun scripts/predict-club-probe.mjs \
  --wallet 0x70b56e23fff713cc617cc8e14f3c947e9ee9ced42547fcd952b69df4bee32f70 \
  --oracle 0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951 \
  --side above \
  --strike 59000 \
  --contracts 100
```

It reports:

- wallet SUI, DUSDC, and PLP balances
- PredictManager events for the wallet
- latest manager object tables and manager DUSDC balance
- oracle state and SVI
- vault state, PLP supply, wallet LP share, withdrawal limiter, LP activity
- SVI fair-value preview
- contract `devInspect` quote for a New Position

Observed result for the wallet above on 2026-06-06:

```text
Wallet DUSDC: 4589.999977
Wallet PLP: 9.98825
Latest manager: 0xe90434f33f278143075900b8b0e0bf5af8570808ff0d26251e259f69318975a4
Manager DUSDC: 41.750257
Binary positions size: 1
Range positions size: 0

Vault balance: 1,013,120.593474 DUSDC
Estimated open position payout: 475.684153 DUSDC
Total max payout: 1,358.041785 DUSDC
Vault value: 1,012,644.909321 DUSDC
Total PLP supply: 1,009,842.026186 PLP
Wallet LP share: about 0.0010%

New Position ABOVE 59,000, 100 contracts:
SVI fair probability: about 75.1%
Contract price: about 0.75968 DUSDC
Estimated cost: about 75.968 DUSDC
Potential profit: about 24.032 DUSDC
Risk/Reward: about 0.316
```

The exact quote changes as oracle price and SVI update.

### Predict Club Implications

- The Predict Club execution panel should show vault liquidity and max-payout
  coverage when quoting a trade.
- `availableWithdrawal` matters for LP withdraw UX, not for member trade
  signing, but the same vault state explains liquidity risk.
- PLP supply and wallet LP share can become a separate "club LP" view if the
  product later supports group liquidity provision.
- Do not mix member PredictManager DUSDC balance with wallet DUSDC balance; the
  wallet can have DUSDC while the manager still needs a deposit.
