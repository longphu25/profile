# Predict Club DeepBook Data Contract

This document defines the DeepBook Predict data that Predict Club needs for
oracle selection, pricing preview, contract quote display, portfolio summary,
and vault summary.

## Sources

Predict Club currently depends on three data surfaces:

- Predict Testnet server:

```text
https://predict-server.testnet.mystenlabs.com
```

- Sui Testnet RPC for wallet, object, balance, and `devInspect` reads.
- Local Predict Club state for V1 member pledges and demo escrow offers.

## Predict Server Endpoints

Required:

```text
GET /predicts/:predict_id/oracles
GET /oracles/:oracle_id/state
GET /oracles/:oracle_id/prices
GET /oracles/:oracle_id/svi/latest
GET /oracles/:oracle_id/svi
```

Optional when available:

```text
GET /oracles/:oracle_id/vaults
GET /managers/:manager_id/positions
```

If optional endpoints are not available or not stable, use Sui object reads and
`devInspect` where the package exposes read functions.

## Oracle State

Predict Club needs:

| Field | Purpose |
| --- | --- |
| `oracle_id` | selected oracle id |
| `status` | active/stale/closed gating |
| `expiry` | round expiry and quote validation |
| `latest_price.spot` | decision strip spot display |
| `latest_price.forward` | fair value and contract quote input |
| `latest_price.onchain_timestamp` | freshness check |
| `latest_svi` | win probability and degraded fallback |

Price values from the observed API are scaled by `1e9`:

```text
spotUsd = latest_price.spot / 1e9
forwardUsd = latest_price.forward / 1e9
```

SVI values are normalized by `1e9`, with explicit negative flags for signed
parameters:

```text
a = raw.a / 1e9
b = raw.b / 1e9
rho = (raw.rho_negative ? -1 : 1) * raw.rho / 1e9
m = (raw.m_negative ? -1 : 1) * raw.m / 1e9
sigma = raw.sigma / 1e9
```

## Pricing Preview

The UI has two related but different pricing concepts:

- contract quote: executable values from Predict Move functions via
  `devInspect`
- local fair value: probability and fallback explanation derived from SVI

Contract quote should drive:

- contract price
- estimated cost
- gross if win
- potential profit
- risk/reward

SVI fair value should drive:

- win probability
- degraded preview when quote is unavailable
- explanatory comparison between quote and fair value

Rules:

- Do not present SVI-only payout as guaranteed executable odds.
- If quote fails, show `Preview unavailable` or a degraded preview with reason.
- Keep raw Move aborts out of the main UI.

## Quote Inputs

Binary quote requires:

- oracle id
- direction: above or below
- strike
- amount or contract count
- manager or wallet context when required by the Move function

Range quote requires:

- oracle id
- lower strike
- upper strike
- amount or contract count
- manager or wallet context when required by the Move function

Validation:

- strike must be positive
- lower strike must be below upper strike
- forward must be positive
- expiry must be in the future
- oracle must be active
- SVI must be present for probability display

## Quote Error Mapping

The UI should map low-level errors into short reasons:

| Low-level symptom | User-facing reason |
| --- | --- |
| Move abort in pricing config | Contract quote rejected this strike or price |
| missing SVI | SVI unavailable |
| missing forward | Forward price unavailable |
| stale timestamp | Oracle data is stale |
| insufficient balance | Not enough DUSDC |
| liquidity cap failure | Vault liquidity is insufficient |
| unsupported position shape | Position type unsupported in this UI |

## Portfolio Data

Predict Club needs wallet-scoped positions:

- binary positions
- range positions
- open/settled/claimable status
- strike or range
- expiry
- entry cost
- potential payout
- oracle id
- manager id

Implementation rule:

- Range positions should be shown even if the UI cannot fully parse every
  field. Use an explicit unsupported/details-unavailable row instead of hiding
  them.

## Vault Data

Predict Club needs:

- available liquidity
- total liquidity
- max payout
- utilization
- total MTM when available
- available withdrawal when available
- wallet PLP balance
- wallet LP share

If a field cannot be resolved from server or chain reads, show `Unavailable`.
Do not backfill with demo numbers unless the UI labels them as demo/local.

## Caching And Rate Limits

Required cache behavior:

- share in-flight requests per `network:address` or `network:oracle`
- cache wallet balances/profile for a short period, currently 30 seconds
- cache oracle state and SVI separately so stale pricing can be explained
- keep last good snapshot for wallet profile, manager, and vault summaries
- use cached data when Sui public RPC returns `429 Too Many Requests`

## Data Ownership

Recommended ownership:

- `deepbookOracleService`: Predict server oracle, price, and SVI reads
- `deepbookPredictPricingService`: contract quote and PredictManager reads
- `payoutPreview` domain module: SVI fair value and degraded preview output
- `PredictClubContext`: shared app snapshot and risk aggregation
- `sui-wallet-profile`: wallet profile presentation and generic wallet reads

Panels should consume context snapshots instead of fetching independently.

## Validation

Minimum checks for data contract work:

- unit tests for normalization and display formatting
- quote error mapping tests
- risk aggregation tests
- Playwright smoke test for unavailable states
- manual test against a known active oracle when public API/RPC is available
