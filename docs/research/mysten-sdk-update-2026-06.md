# Research: what is new and adoptable in the latest @mysten/* SDKs

> Deep-research report (2026-06-16). 23 primary sources, 25 claims adversarially
> verified (3-vote), all confirmed 3-0; many cross-checked against the actually
> installed `node_modules` source. Confidence uniformly high. Scope: a SUI testnet
> binary-options prediction market (`predict-club`) on a React 19 trading terminal.
> Read Caveats before coding against exact endpoint paths or SDK method names.

## TL;DR

The project's Mysten pins are essentially current, so this is not an upgrade story.
It is a "which already-installed primitive lets us delete hand-rolled code" story.
Two changes are worth making; the rest of the surface does not apply and the reasons
are recorded below so it is not re-investigated.

| Change | API (already installed) | Where | Why |
| --- | --- | --- | --- |
| Drop float money math | `parseToUnits` / `parseToMist` (sui 2.16.0) | `suiPredictGateway.ts:217,324`, `walletBalanceService.ts:35,37` | correctness: money must not pass through JS float |
| Drop manual coin selection | `coinWithBalance` intent (sui 2.18.0) | `suiPredictGateway.ts:118-140,219-225` | removes ~25 lines of merge/split + a raw `suix_getCoins` call |

## Installed versions (lockfile resolved, 2026-06-16)

| Package | Range | Resolved | Note |
| --- | --- | --- | --- |
| `@mysten/sui` | ^2.18.0 | 2.18.0 | the peer baseline the whole stack now pins |
| `@mysten/deepbook-v3` | ^1.5.0 | 1.5.0 | newest stable (published 2026-06-15) |
| `@mysten/dapp-kit-react` | ^2.1.1 | 2.1.1 | on dapp-kit-core 1.5.0 |
| `@mysten/bcs` | ^2.1.0 | 2.1.0 | |
| `@mysten/seal` | ^1.2.0 | 1.2.0 | |
| `@mysten/zksend` | ^1.2.0 | 1.2.0 | |
| `@mysten/slush-wallet` | ^1.1.0 | 1.1.0 | |
| `@mysten/walrus` | ^1.2.0 | 1.2.0 | |
| `@mysten/payment-kit` | ^0.1.11 | 0.1.11 | |
| `@mysten/codegen` | ^0.10.6 | 0.10.6 | |

The 2.18 baseline is the anchor: `deepbook-v3`, `seal`, `walrus`, `zksend`,
`slush-wallet` all declare `@mysten/sui ^2.18.0` as a peer, so they moved in lockstep.

---

## Adoptable now

### 1. Money parsing: stop using JS float

Three call sites scale decimal amounts to base units (and back) with float math:

- `suiPredictGateway.ts:217` and `:324`: `Math.floor(amountDusdc * 10 ** DUSDC_DECIMALS)`
- `walletBalanceService.ts:35,37`: `raw / 10 ** DECIMALS`

`@mysten/sui` 2.16.0 added `parseToUnits(amount, decimals)` and `parseToMist(amount)`,
which use pure bigint arithmetic. This is a real correctness fix, not cosmetic: a value
like `0.07 * 1e6` can land on `69999.99...` under IEEE-754 and `Math.floor` then drops a
unit. The display direction (`raw / 10 ** decimals`) is lower stakes but the same family;
prefer a bigint-aware format for symmetry.

### 2. Coin selection: use the `coinWithBalance` intent

The mint PTB selects the deposit coin by hand: `fetchDusdcCoins` calls `suix_getCoins`
raw, then `mergeDusdcAndSplit` (`suiPredictGateway.ts:118-140`) merges the owned coins
and splits the exact amount. `@mysten/sui` 2.18.0 ships `coinWithBalance({ type, balance })`
as a built-in transaction intent that does exactly this (source owned coins, merge,
split) at build time. Replacing it removes the raw RPC call and the empty-array edge
case, and the signed PTB stays equivalent. `tx.balance()` / `tx.coin()` are the related
auto-draw helpers from the same release.

Both changes touch the mint PTB (the money path), so verify with the existing
`simulateMintBinary` devInspect pre-flight: the simulated PTB should still pass and be
byte-equivalent in shape to what the wallet signs.

---

## Available but not adopted (with reasons)

### @mysten/sui simulate path (gRPC)

The modern dry-run path is `SuiGrpcClient.simulateTransaction` with an `include`
parameter; its `commandResults` field is simulation-only and failures are a discriminated
union checked via `result.$kind === 'FailedTransaction'`. The project's pre-flight already
uses `client.devInspectTransactionBlock` on the legacy `SuiClient`, which still works.
Worth knowing if the data layer ever moves fully to the gRPC client, but no reason to
churn the working devInspect path now. Related: 2.16.3 auto-injects a simulate-only
`ValidDuring` expiration so payment-less / shared-object-only PTBs no longer get rejected
during gas-budget simulation; this is the kind of PTB the claim pre-flight builds, so it
is a quiet robustness win already baked into the pinned version.

### DeepBook v3 order-book and swap helpers

`deepbook-v3` 1.3.0-1.5.0 added genuinely useful primitives for a spot order-book UI:
`cancelLiveOrder` / `cancelLiveOrders` (skip stale order ids instead of aborting),
`getLevel2Range` (order-book depth), and ready swap builders (`swapExactBaseForQuote`,
`swapExactQuantity`, `*WithManager`). None apply here: this surface trades a **Move
binary-options contract** (`predict::mint` / `predict::claim`, priced through a devInspect
`get_trade_amounts` call), not a DeepBook spot order book. The data layer reads
`PredictManager` dynamic fields directly; it does not open DeepBook orders. The 1.4.0
read-only viability helpers (`canPlaceLimitOrder`, `canPlaceMarketOrder`) are further
scoped to `deepbook_margin` margin-manager contexts, not spot. Not applicable.

### dapp-kit-core 1.5.0 / 1.6.0 reconnect + per-call overrides

Core 1.5.0 lets `signTransaction` / `signAndExecuteTransaction` take per-call account and
network overrides; core 1.6.0 adds session-restoration-aware auto-connect (`isReconnecting`,
configurable `autoConnectTimeout`, default 5000ms). The project is on react ^2.1.1 which
sits on core 1.5.0, so 1.6.0 features need a core bump, and it was **not confirmed** that
the React layer surfaces these through hooks. Low value for this app (reconnect UX only),
so deferred.

### seal / zksend / walrus / payment-kit

No adoptable (or verifiable) capability surfaced for these in their pinned ranges, and
`predict-club` does not import them. Nothing to do.

---

## Caveats

- Time-sensitive: `deepbook-v3` 1.5.0 was published one day before this research and
  `dapp-kit-core` latest is already 1.6.0. Re-check npm before any bump.
- The 2.16.3 `ValidDuring` fix is documented against the gas-budget simulate inside
  `setGasBudget`, so calling it "devInspect" is loose but effectively correct.
- The 1.4.0 read-only DeepBook helpers are `margin_manager` builders, not generic spot
  balance-manager helpers, though they ship inside `@mysten/deepbook-v3`.
- Whether react ^2.1.1 surfaces the core 1.5.0 per-call overrides and 1.6.0 reconnect
  flags was not directly confirmed; check the installed types before relying on them.
- Several `docs.sui.io` / `sdk.mystenlabs.com` URLs 404'd during verification but were
  backstopped by installed-package source.

## Open questions

1. Does react ^2.1.1 actually expose the core 1.5.0/1.6.0 signing overrides and reconnect
   state through its hooks, or is a core bump plus custom wiring required?
2. Does the 2.16.3 simulate-only `ValidDuring` override fully cover the project's
   devInspect claim pre-flight, or are there cases that still need an explicit expiration?

## Sources

- [@mysten/sui CHANGELOG](https://github.com/MystenLabs/ts-sdks/blob/main/packages/sui/CHANGELOG.md), [typescript CHANGELOG](https://github.com/MystenLabs/ts-sdks/blob/main/packages/typescript/CHANGELOG.md)
- [Transaction basics](https://sdk.mystenlabs.com/sui/transactions/basics), [signing & execution](https://sdk.mystenlabs.com/sui/transactions/signing-and-execution), [gRPC](https://sdk.mystenlabs.com/sui/grpc)
- [deepbook-v3 CHANGELOG](https://github.com/MystenLabs/ts-sdks/blob/main/packages/deepbook-v3/CHANGELOG.md), [DeepBook v3 SDK](https://docs.sui.io/standards/deepbookv3-sdk), [swaps](https://docs.sui.io/standards/deepbookv3-sdk/dbv3-swaps), [npm versions](https://www.npmjs.com/package/@mysten/deepbook-v3?activeTab=versions)
- [dapp-kit overview](https://sdk.mystenlabs.com/dapp-kit), [React getting started](https://sdk.mystenlabs.com/dapp-kit/getting-started/react), [dapp-kit-react CHANGELOG](https://github.com/MystenLabs/ts-sdks/blob/main/packages/dapp-kit/packages/dapp-kit-react/CHANGELOG.md), [dapp-kit-core CHANGELOG](https://github.com/MystenLabs/ts-sdks/blob/main/packages/dapp-kit/packages/dapp-kit-core/CHANGELOG.md)
