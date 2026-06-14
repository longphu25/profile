# Surface Studio Trade Ticket - Technical Reference

This document describes the direct-submit path added to the Predict Club Surface
Studio (plan 23, phase S7): a connected-wallet trader clicks a volatility-heatmap
cell, picks a side, sizes it, and mints a personal binary position straight from
the surface they are reading. It is the execution complement to the studio's
decision-support panels (heatmap, smile, edge, arb-free, time-travel).

Companion docs:

- `docs/deepbook/predict-club-devinspect-pricing.md` - the devInspect quote path
  and SVI fair-value formula this feature reuses.
- `docs/deepbook/predict-club-data-contract.md` - oracle/SVI/price data shapes and
  the quote-error mapping table.
- `docs/deepbook/mint-position-guide.md` - the raw PTB mint flow and scaling rules.
- `plugins/predict-club/DESIGN.md` - the Surface Studio section (product intent).

## Design Intent

The Studio is analysis-first. Every panel earns its place as decision-support, and
the one action it offers - a trade ticket on a heatmap cell - is reached *from* that
analysis, never the reverse. Three rules shape the implementation:

1. **Edge is a hint, not advice.** The ticket shows the model fair win-probability
   (from SVI) and the contract-implied probability when quoted, and flags the side
   the model sees value on. The user always picks UP or DOWN themselves.
2. **No fabricated payout.** Only the stake and model probability are shown. Cost,
   gross-if-win, and profit are not invented; the contract is the source of truth at
   mint time.
3. **Never let a doomed strike reach the wallet.** A read-only pre-flight catches a
   strike the contract will not price *before* asking the user to sign.

## Architecture

The feature is split so the orchestration is pure and unit-testable, the UI is
presentational, and the only impure edges are the gateway and the wallet host.

```
VolHeatmap (cell click)
   └─ onCellSelect(column, cell, anchorRect)
        └─ StudioShell: setTicket({ cell, column, anchorRect })
             └─ TradeTicket (popover, presentational)
                  └─ onSubmit(direction, amount)
                       └─ StudioShell.handleSubmit
                            └─ submitStudioTrade(params, deps)   ← pure orchestration
                                 ├─ evaluateRiskGate(riskInput)  (domain)
                                 ├─ preflightQuote()             (devInspect, read-only)
                                 ├─ gateway.buildMintTx(...)     (infrastructure)
                                 └─ signAndExecute(tx)           (wallet host)
```

| Layer | File | Responsibility |
| --- | --- | --- |
| Domain | `domain/riskGate.ts` | `evaluateRiskGate` - safety gate (reused, unchanged) |
| Domain | `domain/payoutPreview.ts` | SVI fair value `computeFairValue` (reused) |
| Application | `application/submitStudioTrade.ts` | `recommendDirection`, `buildStudioRiskInput`, `submitStudioTrade` |
| Infrastructure | `infrastructure/suiPredictGateway.ts` | `buildMintTx` (shared with cockpit `joinQuickRound`) |
| Infrastructure | `infrastructure/deepbookPredictPricingService.ts` | `quoteBinaryStrike` (devInspect, reused for pre-flight) |
| Presentation | `presentation/studio/TradeTicket.tsx` | popover form + states + a11y |
| Presentation | `presentation/studio/VolHeatmap.tsx` | `onCellSelect` cell-click wiring |
| Presentation | `presentation/studio/StudioShell.tsx` | ticket state + `handleSubmit` deps wiring |

Why a studio-only helper instead of reusing `executeTradeplan`? `executeTradeplan`
carries club/member bookkeeping and mutates a `ClubState` the Studio does not own.
The Studio mints a standalone personal position, so it shares the gateway and the
risk gate but skips the club layer entirely. `PredictClubContext.tsx` is not
touched, keeping the blast radius small.

## Submit Pipeline

`submitStudioTrade(params, deps)` runs four stages and returns a flat
`{ ok, digest?, error? }` so the ticket renders success or the exact blocking
reason without throwing.

### Stage 1 - Risk gate

`evaluateRiskGate(deps.riskInput)` is the domain safety gate, reused unchanged from
the cockpit. The studio builds its input via `buildStudioRiskInput`:

```ts
buildStudioRiskInput({
  expiryMs, nowMs?, oracleStatus, oracleLastUpdateMs,
  hasSvi, hasForward, memberDusdc, amountDusdc,
  walletConnected, managerReady,
}): RiskGateInput
```

Key semantics:

- `indicators: []` on purpose. `computeConsensus([])` resolves to `'neutral'` (not
  `'no-trade'`), so the signal-bias check **passes**. The gate then reduces to the
  real safety conditions: oracle live/active, SVI + forward present, expiry safe
  (`MIN_SAFE_EXPIRY_MINUTES`), sufficient DUSDC, wallet connected, manager ready.
- `signalBias: 'neutral'` matches the empty-indicator consensus.
- `quoteAvailable` / `vaultAvailable` are left **undefined**. They are
  warning-severity and would otherwise block any cell outside the quoted ATM band.
  The contract pre-flight (stage 2) is the real strike gate.
- `expiryMinutes = Math.max(0, Math.floor((expiryMs - now) / 60_000))`.
- `oracleActive`: `'active' → true`, any other string `→ false`, `null → null`.

If `!risk.canExecute`, the function returns `{ ok: false, error }` with the joined
blocking + warning reasons - no quote, no build, no sign.

> Note: `evaluateRiskGate`'s oracle-staleness check reads the real `Date.now()`
> internally (no injected clock). Unit tests anchor freshness fields on `Date.now()`
> rather than a fixed timestamp; see the test file's `liveRiskParams()` helper.

### Stage 2 - Contract pre-flight (read-only)

The heatmap lets a trader click any cell across the whole surface, but the contract
only prices strikes near the forward. A strike outside those bounds aborts on-chain:

```
MoveAbort in pricing_config::quote_spread_from_fair_price, abort code 1
```

This is exactly the abort observed in testing when minting a far-from-ATM strike.
To avoid asking the user to sign a transaction that will revert, the pipeline runs a
read-only `devInspect` quote first - the **same proven path** the mispricing ladder
uses (`quoteBinaryStrike` → `predict::get_trade_amounts`), which exercises the same
`quote_spread_from_fair_price` function with **zero gas and no wallet prompt**.

```ts
deps.preflightQuote?: () => Promise<{ ok: boolean; reason?: string }>
```

StudioShell provides it:

```ts
preflightQuote: async () => {
  const quote = await quoteBinaryStrike({
    oracleId: column.oracleId,
    expiry: expiryMs,
    strikeUsd: cell.strike,
    isUp: direction === 'UP',
    tickSize, minStrike,
    walletAddress: address,
  })
  // null implied probability = contract refused to price this strike (out of bounds)
  return quote.impliedProbability != null
    ? { ok: true }
    : { ok: false, reason: quote.reason }
}
```

`sanitizeContractQuoteReason` (in the pricing service) maps the raw
`quote_spread_from_fair_price` abort to a friendly message
(`PRICING_BOUNDS_REASON`: pick a nearer strike / active oracle). If the pre-flight
returns `ok: false`, the pipeline returns `{ ok: false, error: reason }` and the
ticket shows it. The pre-flight dep is optional so the gate/build/sign core stays
unit-testable without a live node.

### Stage 3 - Build the mint PTB

`deps.gateway.buildMintTx(...)` is the **same function** the proven cockpit path
(`joinQuickRound`) uses, so manager/deposit/market-key/mint are identical to a
known-good mint. It builds a single PTB:

1. Merge + split DUSDC for the stake amount.
2. `predict_manager::deposit` into the manager.
3. `market_key::up` or `market_key::down` (oracleId, expiry, snapped strike).
4. `predict::mint` (PredictID, manager, oracle, marketKey, amountRaw, clock).

### Stage 4 - Sign

`deps.signAndExecute(tx)` is the wallet host call. StudioShell wires it through the
DApp-Kit host:

```ts
signAndExecute: async (tx) => {
  const txResult = await host.signAndExecuteTransaction(tx)
  return { digest: (txResult as { digest?: string }).digest ?? '' }
}
```

On success: `{ ok: true, digest }`. A signer rejection or RPC failure is caught and
returned as `{ ok: false, error }` - it never throws out of the pipeline.

## Strike Unit Chain (critical)

The heatmap cell strike is a **USD** value (the heatmap forward is
`price.forward / 1e9`, and strikes are built from that forward). `buildMintTx`
receives the strike in USD and applies the scale itself:

```ts
const STRIKE_SCALE = 1e9
function snapStrike(usd, tickSize, minStrike) {
  const raw = Math.floor(usd * STRIKE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}
```

So the studio passes the strike to the gateway **unscaled (USD)** - no division or
multiplication in the studio layer. This differs from `joinQuickRound`, which
divides its source strike by `STRIKE_SCALE` because that source is already raw
(`round.config.strike`). A unit test asserts this directly:

```ts
expect(gateway.calls[0].strike).toBe(65_000) // 65,000 USD reaches the gateway as-is
```

The same `tickSize` / `minStrike` are passed to both the pre-flight quote and the
mint so the snapped strike matches between the read and the write.

## Direction Recommendation

```ts
recommendDirection(fairProbability, contractProbability): 'UP' | 'DOWN' | null
```

- Returns `'UP'` when `fair > contract` (the UP side is underpriced = value).
- Returns `'DOWN'` when `fair < contract`.
- Returns `null` when either side is missing, or when
  `Math.abs(fair - contract) < DIRECTION_EDGE_EPS` (0.005) - a gap within noise
  gives no hint.

This matches the cockpit's "fair vs contract" edge band so the two surfaces agree
on what counts as a real edge. It is a hint only; the ticket highlights the
recommended side but the user still chooses.

## Trade Ticket UI

`TradeTicket.tsx` is a presentational popover anchored at the clicked cell
(`data-pc-studio-ticket`). It owns local form state (direction, amount, submit
lifecycle) but injects gate → preflight → build → sign via the `onSubmit` prop, so
it never touches the wallet host directly.

### Content

- Header: `"<asset> above $<strike>?"` + `"settles in <expiry>"` (newcomer-friendly
  phrasing rather than raw strike/expiry).
- UP / DOWN toggle; the recommended side is ringed with a small "model sees value"
  label.
- Model fair % (always, from SVI). Contract % when the cell sits in the quoted band,
  else "not quoted".
- Stake input (DUSDC) + quick chips `[10, 25, 50]`, validated against `balances.dusdc`.

### States

| State | Rendered action / message |
| --- | --- |
| Disconnected | `data-pc-studio-ticket-connect` "Connect Wallet" (calls `onConnect`) |
| Connected, ready | `data-pc-studio-ticket-submit` "Submit `<dir>` - stake `N` DUSDC" |
| No manager | blocked: "Create a PredictManager first" |
| Insufficient DUSDC | blocked: "Need `N` DUSDC, have `M`" |
| Submitting | spinner (reduced-motion: no spin) |
| Success | `SuccessView`: shortened digest + suiscan link |
| Error | the pipeline's error string (e.g. out-of-bounds reason, signer rejection) |

`EXPLORER_TX = 'https://suiscan.xyz/testnet/tx'`.

### Accessibility

- `role="dialog"`, `aria-modal="true"`, focus the dialog on mount.
- Tab is trapped inside the popover.
- A **document-level** Escape listener closes the ticket regardless of focus, so a
  mouse user who clicked a cell (focus not inside the dialog) can still dismiss with
  Escape. This replaced an earlier dialog-only `onKeyDown` that only fired when focus
  was inside.
- A transparent click-outside backdrop also closes.

## Related Heatmap Changes (S7)

Two heatmap-readability fixes shipped alongside the ticket:

- **Full-USD strike labels.** `formatStrike` now renders the full price
  (`$63,951`) instead of rounding to `64k`. Rounding collapsed adjacent strikes into
  identical labels, which made a real decision impossible. The strike row-header
  column was widened to fit; smoke confirms no horizontal overflow.
- **Smooth IV smile.** The smile slice resamples the SVI total-variance curve densely
  (`CURVE_SAMPLES = 96`) instead of joining the dozen sampled strikes with straight
  segments (which produced a jagged "V"). It is drawn in real pixel space via a
  `ResizeObserver` - no `preserveAspectRatio="none"` stretching - so the ATM marker
  stays round and slopes keep their true aspect. The edge panel now sits above the
  smile in the right column.

## Constants (verified in code)

| Constant | Value | Source |
| --- | --- | --- |
| Network | `testnet` | gateway / pricing service |
| Package ID | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` | gateway |
| Predict ID | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` | gateway |
| DUSDC type | `0xe95040…::dusdc::DUSDC` | gateway |
| Clock ID | `0x6` | pricing service |
| Predict server | `https://predict-server.testnet.mystenlabs.com` | gateway |
| Strike scale | `1e9` | `snapStrike` |
| DUSDC decimals | `6` | gateway |
| Contract unit | `10^6` quote base units = 1 contract | pricing service |
| Default tick size | `1_000_000_000` ($1) | StudioShell fallback |
| Default min strike | `50_000_000_000_000` ($50,000) | StudioShell fallback |
| Direction edge epsilon | `0.005` | `submitStudioTrade` |
| Curve samples (smile) | `96` | `SmileSlice` |
| Quote contracts (pre-flight) | `10` | pricing service |

## Verification

The S7 work was verified at four levels before the checkpoint commit:

- **Unit** (`tests/unit/predict-club-studio-trade.test.ts`, bun:test): direction
  hint (UP/DOWN/null), risk-input derivation (expiry minutes, neutral bias, undefined
  quote/vault), strike passed as USD unscaled, risk-gate blocks (short expiry, low
  balance, stale oracle), **pre-flight bounds block before signing**, pre-flight pass
  allows the trade, and signer-failure-as-result (no throw).
- **e2e** (`tests/e2e/predict-club-studio.spec.ts`, Playwright): clicking a live cell
  opens the ticket; disconnected shows Connect and hides Submit; Escape closes. Gated
  on a live SVI surface being present (`waitForGrid`).
- **Smoke** (`scripts/predict-club-studio-smoke.mjs`, headless): mounts, ARIA grid,
  keyboard nav, ticket-gating, no overflow desktop + mobile, no console errors.
- **Live mint**: a real testnet mint from a heatmap cell returned a transaction
  digest, confirming the sign path end to end and that the pre-flight does not block
  a valid in-band strike.

Run them:

```bash
bun run build
bun run test:unit
bun run test:e2e
bun scripts/predict-club-studio-smoke.mjs   # against a running dev/preview server
```

## Error Mapping

The pipeline funnels every failure into a single user-facing string. The notable
mappings:

| Low-level symptom | User-facing reason |
| --- | --- |
| `quote_spread_from_fair_price` abort (pre-flight) | Strike outside contract pricing bounds - pick a nearer strike / active oracle |
| Risk gate blocking | Joined blocking + warning reasons (expiry too short, insufficient DUSDC, stale oracle, etc.) |
| No PredictManager | "No PredictManager found - create one first" |
| Signer rejection / RPC failure | The thrown error message (e.g. "user rejected") |
| PTB build failure | "PTB build failed" or the thrown message |

Raw Move aborts are kept out of the main UI; the contract pre-flight converts the
most common one into a clear, actionable message before the user ever signs.
