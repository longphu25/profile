# Yosuku DeepBook Predict SDK Notes

Source reviewed on 2026-06-10:

- GitHub: <https://github.com/yosuku-lab/predict-sdk>
- npm package: `@yosuku/deepbook-predict`
- Observed repo HEAD: `fa6f5a347585578b5c9ef9d9467a106e3ca96301`
- Latest observed tag: `v0.2.0`

## Why It Matters

`@yosuku/deepbook-predict` is a TypeScript SDK layer for DeepBook Predict. It
fills gaps that are not covered by `@mysten/deepbook-v3`: SVI pricing, digital
option probability, DeepBook Predict PTB builders, market/range key builders,
typed indexer access, and on-chain quote verification via `devInspect`.

This is directly relevant to Predict Club because our current preview and
execution plan needs the same boundary:

- Off-chain preview from oracle state, SVI and forward.
- On-chain quote verification from `predict::get_trade_amounts`.
- PTB construction for mint, range mint, redeem and manager operations.
- Consistent scaling between human USD, 1e9-scaled strikes/prices and 6-decimal
  DUSDC.

## Package Shape

Install shape from the repo README:

```bash
npm install @yosuku/deepbook-predict @mysten/sui
```

Important package facts:

- Package name: `@yosuku/deepbook-predict`
- Previous name: `@yosuku/predict`
- Peer dependency: `@mysten/sui ^2.17.0`
- Runtime target: DeepBook Predict testnet
- Main exports: `PredictClient`, `PredictIndexer`, PTB builders, scaling helpers
- Pricing subpath: `@yosuku/deepbook-predict/pricing`

The SDK bakes in a verified testnet config for package/object IDs, DUSDC, PLP,
clock and indexer server. Treat those IDs as testnet snapshots, not durable
mainnet truth.

## Pricing Model

The SDK reconstructs the DeepBook Predict price from the indexer's SVI surface:

```text
w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))
k = ln(strike / forward)
d2 = (ln(forward / strike) - w / 2) / sqrt(w)
price_up = N(d2)
```

The SDK then applies the DeepBook Predict spread model around the fair price.
The important implementation detail from its changelog is that asks are clamped,
then each side's bid is derived from the opposite ask so the book does not cross
in deep ITM/OTM wings.

Observed constants in `src/pricing.ts`:

```text
BASE_SPREAD = 0.02
MIN_SPREAD = 0.005
MIN_ASK = 0.01
MAX_ASK = 0.99
UTIL_MULT = 2.0
```

For Predict Club, this confirms that a hard-coded multiplier is not acceptable
for payout preview. The preview should derive probability and indicative price
from `latest_svi`, `forward`, selected direction/range and amount.

## On-Chain Quote Verification

The SDK exposes `quoteOnChain` / `getTradeAmountsOnChain`, which builds a
read-only transaction kind and calls JSON-RPC `sui_devInspectTransactionBlock`
against:

```text
predict::get_trade_amounts(predict, oracle, key, quantity, clock)
```

The return values are decoded as:

- `mintCost`: DUSDC base units needed to open the position.
- `redeemPayout`: DUSDC base units for closing/redeeming the position.

This matches our current Predict Club direction: use off-chain SVI for fast UI
preview, then use `devInspect` as the authoritative quote for execution review
and error handling.

## Indexer Endpoints And Fields

The SDK deliberately exposes only endpoints observed to return useful data:

- `/status`
- `/oracles`
- `/oracles/:id/state`
- `/oracles/:id/prices/latest`
- `/oracles/:id/svi/latest`
- `/positions/minted`
- `/positions/redeemed`
- `/managers`
- `/managers/:id/positions`
- `/predicts/:id/vault/summary`

Important field notes:

- `oracleState()` returns `{ oracle, latest_price, latest_svi, ask_bounds }`.
- The server returns many numeric fields as JS numbers, not strings.
- Manager positions use a `{ minted, redeemed }` envelope.
- `?status=` does not filter `/oracles` server-side; filter active/settled
  status client-side.
- `?owner=` does filter `/managers` server-side.

## Scaling Rules

The SDK's scaling notes match the assumptions we should keep in Predict Club:

| Domain | Scaling |
|--------|---------|
| Strike / spot / forward / SVI params | 1e9-scaled on-chain |
| DUSDC balances/cost/payout | 6 decimals |
| One contract | `1_000_000` base units = 1 DUSDC max payout |
| Human USD strike | `usd * 1_000_000_000` |

Helpers to mirror or import:

- `usdToScaled(63000)` for strike input.
- `scaledToUsd(value)` for strike/spot/forward display.
- `contracts(1)` for one $1 max-payout contract.
- `dusdc(value)` for micro-DUSDC display.

## Predict Club Integration Plan

1. Evaluate whether to depend on `@yosuku/deepbook-predict` directly or port a
   small subset into our domain layer.
2. If depending directly, pin the version and keep testnet IDs configurable so
   the app can follow DeepBook Predict deployments.
3. Replace duplicated local payout preview math with SDK pricing primitives or
   parity tests against them.
4. Add a `quoteOnChain` adapter around our existing Sui client and JSON-RPC
   endpoint for execution review.
5. Add tests that compare our preview output with SDK `quote()` for representative
   strikes: deep OTM, near ATM, deep ITM and range cases.
6. Keep UI copy clear: off-chain preview is indicative; `devInspect` quote is
   the execution gate.

## Open Questions

- The SDK covers UP/DOWN and `mintRange` builders, but Predict Club still needs
  a local UX mapping for ABOVE/RANGE/BELOW and capped payout display.
- We need to verify whether the SDK's baked testnet deployment matches the
  oracle IDs currently used by Predict Club.
- Range fair value should be checked against the SDK's range builder/key logic
  before replacing our current range preview code.
- The package claims browser-safe on-chain quote support; we should still test
  it in our Vite/browser bundle before using it in production UI code.
