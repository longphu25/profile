# Surface Studio Positions, Claim, Unwind, Multi-Manager - Technical Reference

This document describes the positions/history drawer in the Predict Club Surface
Studio (plan 23, phase S9) and the multi-manager work layered on top of it: how a
connected trader sees the real positions they hold, claims a settled win, unwinds a
still-live position before expiry, and reads positions across every PredictManager
the wallet owns (not just the latest).

It is the post-trade complement to `SURFACE-STUDIO-TRADE.md` (the mint path). Where
the trade ticket mints a position from a heatmap cell, the positions drawer is where
those positions live afterward, with the chain as the source of truth.

Companion docs:

- `docs/deepbook/predict/SURFACE-STUDIO-TRADE.md` - the mint path this drawer
  complements (same gateway, same devInspect pre-flight discipline).
- `plugins/predict-club/DESIGN.md` - the Surface Studio section (product intent).

## Design Intent

Three rules shape the drawer, all inherited from the trade ticket and applied to the
read side:

1. **The chain is the source of truth, not localStorage.** The drawer lists real
   binary positions read from the trader's PredictManager(s) on chain. The
   `mintedKeys` localStorage hint that tints the heatmap is never used here; it stays
   a fast local marker, not a record of holdings.
2. **No fabricated outcome.** The drawer shows stake, strike, side, expiry, and a
   plain-language win/lose rule. It never invents a profit/loss figure or guesses a
   settled result. Whether a settled position can be claimed is decided by the
   contract via a read-only pre-flight, never computed from a settlement price the UI
   does not authoritatively hold.
3. **Read is free, write is gated.** Every claim/unwind is preceded by a read-only
   `devInspect` pre-flight (zero gas, no wallet prompt). A signing button appears only
   when the contract agrees. The one place the drawer leaves read-only is when the
   trader presses Claim or Unwind.

## Architecture

```
StudioShell
  ├─ refreshPositions()
  │    └─ fetchAllManagersBinaryPositions(address)        ← reads ALL managers
  │         └─ fetchAllManagerIds → fetchManagerBinaryPositions (per manager)
  │              └─ each position tagged with its owning managerId
  │
  └─ PositionsDrawer (presentational, ARIA dialog)
       ├─ classifyPosition → Live / Settled split          (domain, pure)
       ├─ positionOutcomeRule / positionLean → win/lose copy (domain, pure)
       ├─ simulateClaim(position)  → devInspect pre-flight  (read-only)
       ├─ onClaim(position)        → buildClaimTx → sign     (settled, real tx)
       ├─ simulateRedeem(position) → devInspect pre-flight  (read-only)
       └─ onRedeem(position)       → buildRedeemTx → sign    (live, real tx)
```

| Layer | File | Responsibility |
| --- | --- | --- |
| Domain | `domain/studioPositions.ts` | `classifyPosition`, `positionSideLabel`, `positionStrikeUsd`, `positionMoneyness`, `positionKey`, `positionOutcomeRule`, `positionLean` - pure view helpers, unit-tested |
| Infrastructure | `infrastructure/deepbookPredictPricingService.ts` | `fetchManagerBinaryPositions`, `fetchAllManagerIds`, `fetchAllManagersBinaryPositions`, `sanitizeClaimError`, `sanitizeRedeemError` |
| Infrastructure | `infrastructure/suiPredictGateway.ts` | `buildClaimTx`, `simulateClaim`, `buildRedeemTx`, `simulateRedeem` (shared `composeRedeemTx`) |
| Presentation | `presentation/studio/PositionsDrawer.tsx` | the slide-in drawer, per-position pre-flight + claim/unwind lifecycle, manager listing + combine toggle |
| Presentation | `presentation/studio/StudioShell.tsx` | positions state, `refreshPositions`, the four claim/unwind handlers, drawer wiring |

The drawer is presentational and unit-friendly: it owns the per-position pre-flight
and claim/unwind lifecycle state, but the chain reads and the build/sign pipeline are
injected (`simulateClaim`, `onClaim`, `simulateRedeem`, `onRedeem`), so it never
touches the wallet host or RPC directly.

## Reading Positions

### Position shape

```ts
interface ManagerPosition {
  id: string                      // the on-chain position object id
  managerId: string               // which PredictManager owns this position
  kind: 'binary' | 'range'
  oracleId: string
  expiry: number                  // ms, compared against Date.now()
  quantity: number                // stake in DUSDC (descaled from raw)
  side?: 'ABOVE' | 'BELOW'        // binary only
  strike?: number                 // USD, descaled by PRICE_SCALE at read time
  lowerStrike?: number            // range only
  upperStrike?: number            // range only
}
```

`managerId` is the field added for multi-manager support. Without it, a claim or
unwind could not target the manager that actually owns the position (see below).

### Single manager vs all managers

```ts
// One manager (latest if managerId is null), binary leg only.
fetchManagerBinaryPositions(walletAddress, managerId): Promise<ManagerPosition[]>

// Every manager the wallet owns, newest first.
fetchAllManagerIds(walletAddress): Promise<string[]>

// The binary positions across ALL managers, each tagged with its owning managerId.
fetchAllManagersBinaryPositions(walletAddress): Promise<ManagerPosition[]>
```

`fetchAllManagersBinaryPositions` reads each manager concurrently; a single failed
manager read drops to an empty slice rather than failing the whole list. The drawer
uses this read for both the per-manager view and the combined view, so the two views
never disagree about what the wallet holds.

`positionsSize` on a manager snapshot counts the manager's lifetime position table
entries (including zero-quantity, redeemed slots), so it is not the count of open
positions. The drawer filters `quantity <= 0n` at read time, so only positions with a
live stake appear.

### Why multi-manager matters

A wallet can hold more than one PredictManager: each `create_manager` call mints a
fresh one. Positions scatter across them. The earlier read used only the latest
manager (`fetchLatestManagerId` returned `managers[0]` ordered by checkpoint then
tx_index), so a wallet with positions in older managers saw only a fraction of its
holdings. Reading across all managers is what makes the history complete.

## The Live / Settled Split

```ts
classifyPosition(position, nowMs): 'live' | 'expired'
//   position.expiry > nowMs  → 'live'
//   else                      → 'expired' (settled)
```

`expiry` is the oracle expiry in milliseconds, carried straight through from
`oracle.expiry` and compared against `Date.now()` everywhere upstream, so the split
uses the same clock. A position settles (and may become claimable) only after it
expires, so the drawer offers:

- **Unwind** on the Live group (sell back to the AMM before expiry).
- **Claim** on the Settled group (collect a settled win).

A 1-second tick advances the live countdowns; it is armed only when at least one live
position exists, so a settled-only list stays idle.

## Win / Lose Rule and Live Lean

The drawer shows a plain-language payout rule so a trader reads what the bet depends
on without inferring it from UP/DOWN plus a strike:

```ts
positionOutcomeRule(position): { winsWhen, losesWhen } | null
//   UP   (ABOVE): wins when "settles above $X",  loses "at or below $X"
//   DOWN (BELOW): wins when "settles below $X",  loses "at or above $X"
```

For a live position it also shows where the current forward leans, as a coarse hint
(not a prediction; the contract settles at expiry):

```ts
positionLean(position, forward): 'winning' | 'losing' | 'atStrike' | null
//   within 0.05% of the strike reads as 'atStrike' rather than a misleading win/lose
```

These are pure domain functions, unit-tested, with no DOM or network dependency.

## Claim and Unwind (the write paths)

Both share the gateway's `composeRedeemTx`, which builds the identical 7-arg PTB
shape (Predict, PredictManager, OracleSVI, MarketKey, U64 quantity, Clock, TxContext,
confirmed against the package). Only the function name differs:

| Action | Contract function | When valid |
| --- | --- | --- |
| Claim (settled payout) | `predict::redeem_permissionless` | after the oracle settles; the Claim button signs this |
| Unwind (live re-sell) | `predict::redeem` | only while live; aborts `assert_quoteable_oracle` once settled |

> There is no `predict::claim` function. The settled-payout path is
> `redeem_permissionless`. An earlier assumption that a `claim` entry existed was
> disproved against the live package via `getNormalizedMoveModule`; the probe
> (`scripts/predict-club-probe.mjs`) confirmed the real function and its 7-arg shape.

### Pre-flight discipline (read-only)

```ts
simulateClaim(position)  → gateway.simulateClaim(...)  → devInspect(composeClaimTx)
simulateRedeem(position) → gateway.simulateRedeem(...) → devInspect(composeUnwindTx)
```

The pre-flight builds the real PTB and runs it through `devInspectTransactionBlock`
(zero gas, no wallet prompt). The contract is the source of truth: a Claim button
appears only when the claim pre-flight succeeds; an Unwind button only when the
unwind pre-flight succeeds. A losing, unsettled, or already-claimed position shows
the contract's read-only reason instead of a button.

### Targeting the owning manager (critical)

Each claim/unwind handler in StudioShell resolves the manager like this:

```ts
const managerId =
  position.managerId ?? predictManagerId ?? (await gateway.fetchManagerId(address))
```

`position.managerId` comes first. This is what makes multi-manager claim/unwind
correct: a position in an older manager builds its PTB against that manager, not the
latest one. The fallbacks (`predictManagerId`, then a fresh `fetchManagerId`) only
apply to a position with no manager tag, which should not happen for chain-read
positions but keeps the path total.

The quantity is threaded through as a `u64` (raw DUSDC units via `dusdcToUnits`,
which takes the human DUSDC figure; `1.0` becomes `1000n` at 6 decimals) between the
MarketKey and the Clock argument. Exact bigint conversion, never `Math.floor(x * 10 ** decimals)`.

### Sign

The real write signs through the wallet host:

```ts
const txResult = await host.signAndExecuteTransaction(tx)
refreshPositions()   // re-read the chain so the row reflects its new state
return { ok: true, digest: txResult.digest ?? '' }
```

A signer rejection or RPC failure is caught and mapped to a friendly string
(`sanitizeClaimError` / `sanitizeRedeemError`); it never throws out of the handler.

## The Drawer UI

`PositionsDrawer.tsx` is a slide-in sheet from the right (`data-pc-studio-positions`),
an ARIA dialog: it traps Tab, a document-level Escape closes it (so a mouse user who
opened it from the status band can still dismiss with Escape), and a transparent
backdrop closes on click-outside. This mirrors the trade ticket's dialog pattern.

### States

| State | Rendered |
| --- | --- |
| Disconnected | empty state, `data-pc-studio-positions-connect` "Connect Wallet" |
| Connected, no positions | empty state "No positions yet" |
| Connected, positions | roll-up + manager controls (if multi) + Live/Settled groups |

### Roll-up

A summary strip derived entirely from contract verdicts, never from a settlement
price:

| Stat | Meaning |
| --- | --- |
| Live | count of still-running positions |
| Win | settled positions whose claim pre-flight succeeded (claimable) |
| Claimed | claims confirmed this session |
| No payout | settled positions whose pre-flight aborted |
| Checking | pre-flight still in flight |

"No payout" honestly merges lost positions and ones already claimed in a prior
session: the contract aborts `redeem_permissionless` the same way for both, so the UI
cannot split them reliably and does not pretend to. The roll-up is always computed
across all managers, so the at-a-glance totals do not change when the trader switches
between the combined and per-manager views.

### Manager listing and the combine toggle

This is the multi-manager UX. The default is to **list managers separately**, never
to silently merge them:

- When the wallet holds **one** manager: a single combined Live/Settled view (nothing
  to separate).
- When the wallet holds **more than one** manager: each manager is its own labelled
  group (`ManagerHeader`: "Manager N", a shortened id `0x1234...abcd`, and a "newest"
  tag on index 0). A control strip shows the manager count and a toggle
  (`data-pc-studio-positions-combine`) reading **Combine all** / **List separately**.

```ts
const showCombined = combineManagers || !multiManager
```

Combining is the trader's explicit choice, off by default. This is the behavior the
product owner asked for: surface every manager, then let the user decide whether to
fold them into one view, rather than the drawer auto-merging.

`positionKey` includes `managerId` so two identical bets (same oracle, expiry, side,
strike) in two different managers never collide on a React key or on the per-position
pre-flight state:

```ts
positionKey(position) =
  `${managerId}|${oracleId}|${expiry}|${side ?? 'NONE'}|${strike ?? 0}`
```

## Refresh cadence

`refreshPositions` re-reads all managers:

- on wallet/manager change,
- after a confirmed mint (the new position now lives on chain),
- after a confirmed claim or unwind (the position's state changed),
- on a slow `POSITIONS_REFRESH_MS = 30_000` timer while connected.

It is not refetched per oracle tick; reading positions is several RPC calls per
manager (dynamic fields plus an object read per position), so the cadence is
deliberately slow and event-driven.

## Header Wallet Pill (related)

Alongside the drawer, the static HTML nav pill shows the connected wallet's SUI and
DUSDC balances (`data-wallet-sui`, `data-wallet-dusdc`). The pill lives outside the
plugin's React tree, so the Surface Studio orchestrator drives it directly:
"loading..." while a fetch is in flight, the figure once resolved, "-" when
disconnected, polled on the same 30s cadence. A poll refresh does not flicker the
last good value back to "loading...".

The wallet-profile popup's `KNOWN_DECIMALS` was corrected to include DUSDC and PLP at
6 decimals (both had defaulted to 9, showing PLP 1000x too large), and the popup
shows "Loading..." for manager fields while the snapshot resolves rather than a
misleading "0".

## Constants (verified in code)

| Constant | Value | Source |
| --- | --- | --- |
| Claim function | `predict::redeem_permissionless` | gateway `composeClaimTx` |
| Unwind function | `predict::redeem` | gateway `composeUnwindTx` |
| Redeem PTB args | Predict, Manager, Oracle, MarketKey, u64 qty, Clock | `composeRedeemTx` |
| DUSDC decimals | `6` | gateway |
| Price scale (strike descale) | `1_000_000_000` | pricing service |
| Positions refresh | `30_000` ms | StudioShell |
| At-the-strike band (lean) | `0.05%` | `positionLean` |
| Explorer tx base | `https://suiscan.xyz/testnet/tx` | drawer |

## Verification

- **Unit** (`tests/unit/predict-club-studio-positions.test.ts`, bun:test):
  `classifyPosition` (live/expired around now), `positionSideLabel`,
  `positionStrikeUsd`, `positionMoneyness`, `positionOutcomeRule` (UP/DOWN
  win/lose copy), `positionLean` (winning/losing/atStrike), `positionKey` stability
  and that it distinguishes by manager so cross-manager bets do not collide, and
  `sanitizeClaimError` mappings. 148 unit tests pass across the suite.
- **Smoke** (`scripts/predict-club-studio-smoke.mjs`, headless): the positions button
  opens the drawer, the disconnected drawer shows Connect, Escape closes it, no
  horizontal overflow desktop + mobile, no severe console errors. 20 checks pass.
- **Probe** (`scripts/predict-club-probe.mjs`): reads real positions for a wallet and
  runs the claim/unwind pre-flight against the live package; this is what confirmed
  `redeem_permissionless` and the 7-arg shape, and what surfaced the missing-quantity
  and wrong-function bugs in the original claim path.

Run them:

```bash
bun run build
bun run test:unit
bun scripts/predict-club-studio-smoke.mjs   # against a running dev/preview server
```

## Error Mapping

| Low-level symptom | User-facing reason |
| --- | --- |
| `redeem_permissionless` abort, not settled | "Not settled yet - this position is still live." |
| already-claimed abort | "Already claimed." |
| zero-payout abort | "This position lost - nothing to claim." |
| `redeem` abort once settled (`assert_quoteable_oracle`) | "Cannot unwind right now." |
| signer rejection | "You rejected the transaction in your wallet." |
| opaque MoveAbort | "This position lost or has already been claimed." (no raw dump) |

The contract aborts the same way for a lost position and an already-claimed one, so
the claim error copy and the "No payout" roll-up stat both stay honest about that
ambiguity rather than fabricating a clean lost-vs-claimed split.
