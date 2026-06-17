# Predict Vol-Surface Studio (Decision-Support Terminal)

## Goal

Turn the existing Predict Club cockpit into a decision-support trading terminal by
making DeepBook Predict's volatility surface legible and actionable. The hackathon
edge is the one thing competitors structurally lack: a live vol surface you can
read, plus the concrete numbers a trader acts on (mispricing vs the contract, IV vs
realized vol, surface health). Build a dedicated Surface Studio for analysis and
seed a single mispricing badge into the cockpit's action rail for the moment of
decision.

This plan builds on story 22 (the chart-king cockpit, complete). It does NOT
rebuild the cockpit. It adds a new surface and one small cockpit hook, reusing the
shared data layer and the SVI math already in `domain/payoutPreview.ts`.

## Why this direction

The problem statement's core complaint about today's prediction markets is that
they "have no real notion of an underlying volatility surface." Predict's whole
pitch is vol-surface pricing of every strike and expiry. We already receive the SVI
params (`{a,b,rho,m,sigma}`) per oracle and compute fair value locally, but we have
never drawn the surface those params describe. The single highest-leverage,
lowest-contract-risk move is to render that surface and the edge it exposes.

Reference scan (2026-06-14):

- **crash.suize.io** (Vite SPA, gamified): Enoki zkLogin + sponsored/gasless tx,
  Slush + dapp-kit. Calls `create_manager / deposit / supply / redeem_lp /
  redeem_funds / claim / get_trade_amounts`. Uses `/predicts/{id}/vault/summary`,
  `/oracles/{id}/prices/latest`, `/positions/minted?manager_id=`,
  `/positions/redeemed?manager_id=`, `/managers`. Their gamified+PLP angle is a
  different lane from ours.
- **predict.magicdima.xyz** (Next.js + dapp-kit): a pro inspector with standard
  wallet-connect, no sponsored tx. Closest in spirit to a "make Predict legible"
  tool, which is exactly the lane we are sharpening with the surface + edge.

Neither renders a vol surface with a live mispricing/edge overlay. That is our
differentiation.

## Locked Decisions (grill-me session, 2026-06-14)

These are the contract. Do not relitigate mid-build; if one proves wrong, stop and
re-decide explicitly with the user.

1. **Submission spearhead: decision-support terminal.** Lean on the real
   mint/claim path already shipped plus richer decision numbers. Not a new vault
   contract, not a bot. Lowest contract risk, matches "better numbers for better
   decisions."
2. **Flagship feature: vol surface + edge.** The surface itself plus the trader's
   edge numbers are the headline. This is the "what the canonical pro UI won't
   surface" angle, made legible.
3. **Surface scope: full 3D (strike x expiry).** The data axes are strike AND
   expiry. Strike smile is free from one SVI set; the expiry axis requires a
   per-oracle SVI fan-out.
4. **Surface render: 2D heatmap matrix + smile SVG. No new dependency.** Render the
   3D data (strike x expiry -> IV) as a Bloomberg-style vol matrix heatmap plus an
   on-brand SVG smile slice. No three.js / plotly. On-brand, instant to read,
   zero dependency risk.
5. **Surface lives in a dedicated Studio; cockpit untouched.** A new Vite entry
   (`predict-surface-studio.html`). Story 22's chart-king cockpit stays exactly as
   is (decision 5/8 of plan 22: chart-is-king, king chart = custom SVG, which
   cannot host a 3D surface).
6. **Edge numbers (all four):** (a) **Contract quote vs fair value = mispricing**
   [PRIMARY], (b) IV vs realized vol, (c) arb-free checker (butterfly/calendar
   surface health), (d) vs external venue [STRETCH, must not pull core scope].
7. **Mispricing lives in both places:** a compact mispricing badge in the cockpit
   action rail (cheap; reuses `pricingSnapshot.quote` + `.fairValue` already in
   context for the selected strike) AND the full ladder/surface view in the Studio.
8. **Mispricing ladder data: ATM band + lazy + cache.** The heatmap base layer is
   IV across the full strike x expiry grid (free, pure SVI math). Mispricing
   (contract `get_trade_amounts` via devInspect, one round-trip per strike) is
   computed only for an ATM band by default; hover/click lazily quotes additional
   cells; cache keyed by `(oracleId, strike)` with a short TTL. Keeps testnet RPC
   from melting.
9. **Deploy-ready is in scope (CORS fix).** Minimum requirement says "works end to
   end, we will test the entire flow." Today no `VITE_TESTNET_RPC_URL` is set, so a
   prod build calls `fullnode.testnet.sui.io` directly and dies on CORS (white
   page). A prod-readiness phase fixes RPC config at both layers and verifies a
   built deploy renders.
10. **Studio <-> cockpit: separate entry + two-way link.** Studio is its own
    `.html` entry; cockpit and studio link to each other so the demo flows
    analysis -> action seamlessly.
11. **Studio v1 contents (in cut-priority order):** heatmap + smile (core),
    mispricing overlay (core), arb-free checker, time-travel slider (last; the cut
    line if time runs short).

## Hard Constraints

- **Em-dash (`—`) and en-dash-as-separator (`–`) are completely banned** in every
  visible string (headlines, labels, pills, buttons, captions, empty/error copy,
  alt text, tooltips). Use a hyphen `-` or restructure. (`design-taste-frontend`
  9.G.) This applies to the Studio exactly as it does to the cockpit.
- **Design skill lead: `ui-ux-pro-max`** (data-dense product surface). WCAG AA
  contrast (4.5:1 body, 3:1 large), visible focus rings, tab order matches visual
  order, color never the sole signal (pair every red/green with sign + label),
  tabular figures for all numeric columns, `prefers-reduced-motion` honored. The
  heatmap MUST NOT use color as the only encoding: pair cell color with a printed
  IV/mispricing number so colorblind users and AA contrast both pass.
- **Tailwind token collision:** `md` is a SPACING token (`--spacing-md` = 12px), so
  `max-w-md` resolves to 12px. Always use `max-w-[28rem]` and friends.
- **No mock data shown as real.** Every cell, badge, and number is either a live
  value or a defined empty/stale state. No demo numbers. The arb-free and mispricing
  overlays must visibly degrade (not fabricate) when SVI or a quote is missing.
- **No forked data logic.** Reuse `domain/payoutPreview.ts` SVI math, the
  `deepbookOracleService` snapshot, and the `deepbookPredictPricingService`
  devInspect quote path. New code is presentation + a thin surface-sampling layer,
  not a second pricing implementation.
- **Motion: restrained / institutional** (same as plan 22). Surface re-renders and
  time-travel scrubs are state changes; no per-tick shimmer. Reduced-motion
  collapses transitions to instant.

## Data Layer (shared, confirmed)

From `deepbookOracleService` / `usePredictClub()`:

- `oracleSnapshot.oracles[]` — every live oracle with `{oracle_id, expiry,
  underlying_asset, status}`. This is the **expiry axis** source. Rolling sub-hour,
  so only a handful are live at once.
- `oracleSnapshot.oracleState?.latest_price?.{spot,forward}` — forward per oracle is
  the moneyness anchor for the smile.
- `oracleSnapshot.oracleState?.latest_svi` — the SVI params for the selected oracle.
  For the full surface we fan out `GET /oracles/{id}/svi/latest` per oracle.
- `oracleSnapshot.prices[]` — recent price series (cockpit chart; not needed for the
  surface itself).

From `domain/payoutPreview.ts` (reuse, do NOT refork):

- `totalVarianceAtLogMoneyness(svi, k)` — the core. Feed `k = log(K/F)` for any
  strike `K` to get total variance `w`. **IV = sqrt(w / T)** where `T` is
  time-to-expiry in years. This produces the entire smile from one SVI set, free.
- `computeFairValue(svi, forward, expiry, strike, direction)` — the fair-value
  probability per strike (already used by the cockpit).
- `normalizeSVIParams`, `normalCDF` — supporting math, already correct (1e9 scaling
  handled inside).

From `deepbookPredictPricingService`:

- The devInspect `predict::get_trade_amounts` / `get_range_trade_amounts` path that
  returns the **contract** mint cost / payout per strike. This is the contract side
  of the mispricing = `contractImpliedProb - fairValueProb`. One devInspect per
  strike (the cost-bounded call, hence decision 8).

From `binanceRefService` (reuse for realized vol):

- `fetchBinanceRefHistory()` returns 60x 1m BTC closes (no CORS). Enough for a
  short-window **realized vol** estimate (stddev of log returns, annualized) to put
  next to IV. No new data source needed.

## Architecture

```
predict-surface-studio.html              NEW  Vite entry (mirror predict-club-next.html head)
src/predict-surface-studio/main.tsx      NEW  orchestrator (mirror predict-club-next/main.tsx wallet wiring)
plugins/predict-club/
  application/
    sampleVolSurface.ts                  NEW  pure: oracles + SVI -> {strike x expiry -> IV} grid
    volSurfaceService.ts                  NEW  fan-out SVI per oracle; realized-vol; mispricing cache (ATM band, lazy, TTL)
    arbFreeCheck.ts                       NEW  pure: butterfly + calendar no-arb checks over the grid
  domain/
    volSurface.ts                         NEW  types: SurfaceGrid, SurfaceCell, MispriceCell, ArbViolation, RealizedVol
  presentation/studio/
    StudioShell.tsx                       NEW  layout: heatmap (king) + smile slice + edge panel + controls
    VolHeatmap.tsx                        NEW  SVG matrix (strike rows x expiry cols), color+number cells, ATM band
    SmileSlice.tsx                        NEW  SVG smile for the selected expiry column (IV vs strike)
    EdgePanel.tsx                         NEW  mispricing ladder + IV-vs-realized + arb-free status
    TimeTravel.tsx                        NEW  (last) SVI-history scrubber; degrades to "live only" if no history
    studio.css or reuse predict-club.css  surface tokens (Terminal-First, shared)
plugins/predict-club/presentation/next/
  ActionDock.tsx (or ExposureRail.tsx)    EDIT add a compact mispricing badge (reuse pricingSnapshot)
```

Studio reuses the predict-club plugin's data layer end to end: it loads the same
plugin, the same `PredictClubProvider`, the same wallet wiring as
`predict-club-next`. The surface sampling + arb math are new but pure and tested.

## Phases (each ends in a checkpoint commit + package.json minor bump)

### S0 — Studio entry, shell, wallet wiring
Objective: a new route that mounts, connects a wallet, and shares the predict-club
data layer, with a two-way link to/from the cockpit.

Work:
1. `predict-surface-studio.html` mirroring `predict-club-next.html` (same fonts,
   reduced-motion block, Terminal-First body classes, one React root slot).
2. `src/predict-surface-studio/main.tsx` mirroring `predict-club-next/main.tsx`
   (DAppKit provider, host wiring, load predict-club plugin, mount a new
   `PredictClub.Surface.Studio` component). Register the component in `plugin.tsx`.
3. Register the entry in `vite.config` (`optimizeDeps.entries` + `rollupOptions.input`).
4. `StudioShell.tsx` placeholder grid + header. Add a "Studio" link in the cockpit
   header and a "Cockpit" link back in the studio header.

Acceptance: studio route builds and mounts; wallet connects; header links navigate
both ways; no console errors; no horizontal overflow at 1440px and 375px.

Validation: `bun run build`; Playwright mounts `[data-pc-studio]` and asserts the
cross-links resolve to the right entries.

Status: done.

### S1 — Surface sampling + IV heatmap (core)
Objective: the king zone of the studio: a live strike x expiry IV matrix from real
SVI, free of any contract call.

Work:
1. `domain/volSurface.ts` types. `application/sampleVolSurface.ts`: given the live
   oracles + their SVI + forward + expiry, build a grid of IV per (strike, expiry).
   Strikes = a symmetric band around each forward (e.g. +/- N steps in bps or in
   1-sigma units); IV = `sqrt(totalVarianceAtLogMoneyness(svi, log(K/F)) / T)`.
2. `volSurfaceService.ts`: fan out `GET /oracles/{id}/svi/latest` across live
   oracles (bounded; only active, future-expiry), assemble the grid, expose a
   subscribe/snapshot like `deepbookOracleService`. Handle missing SVI per oracle
   (that column degrades, not fabricates).
3. `VolHeatmap.tsx`: SVG matrix, strike rows x expiry columns. Each cell shows the
   IV number AND a background color ramp (color is never the only signal). ATM row
   highlighted. Tabular figures. Empty/stale states.

Acceptance: heatmap fills the king zone with real IV values that move with SVI
updates; columns map to real expiries; missing-SVI columns show a defined empty
state; reads as "pro," not toy; zero console errors.

Validation: `bun run build`; unit tests for `sampleVolSurface` (known SVI -> known
IV within tolerance) and grid assembly; Playwright asserts an NxM cell grid with
numeric content at 1440px.

Status: done.

### S2 — Smile slice + IV vs realized vol
Objective: the per-expiry smile and the first edge number.

Work:
1. `SmileSlice.tsx`: on-brand SVG smile (IV vs strike) for the selected expiry
   column; click a heatmap column to select it; ATM marker; forward marker.
2. Realized vol: in `volSurfaceService` (or a small helper), compute annualized
   realized vol from `fetchBinanceRefHistory()` log returns. Show ATM IV vs realized
   vol as a labeled spread (sign + label, not color alone) in `EdgePanel.tsx` (panel
   created here, filled further in S3).

Acceptance: selecting a column updates the smile; smile shape matches the heatmap
column; IV-vs-realized spread shows a real number with sign and label, or a defined
"realized unavailable" state if Binance history is empty.

Validation: `bun run build`; unit test for realized-vol math (known series ->
known stddev); Playwright selects a column and asserts the smile + spread update.

Status: done.

### S3 — Mispricing overlay (PRIMARY edge) + cockpit badge
Objective: the headline edge, in both the studio ladder and the cockpit action rail.

Work:
1. `volSurfaceService` mispricing layer: for the ATM band only (decision 8), call
   the existing devInspect `get_trade_amounts` per strike, convert contract cost to
   an implied probability, compute `mispricing = contractImpliedProb -
   fairValueProb`. Cache by `(oracleId, strike)` with short TTL; hover/click lazily
   extends beyond the ATM band. Concurrency-bounded so testnet RPC survives.
2. `EdgePanel.tsx`: mispricing ladder for the selected expiry (strike, fair prob,
   contract prob, edge, with sign + color + label). Heatmap cells in the ATM band
   gain a mispricing tint/indicator distinct from the IV ramp (documented legend).
3. Cockpit: add a compact mispricing badge to `ActionDock`/`ExposureRail` reusing
   `pricingSnapshot.quote` + `.fairValue` already in context for the selected
   strike. No new fetch in the cockpit. Defined state when the quote is degraded.

Acceptance: ATM-band cells show a real edge derived from a real contract quote;
lazy extension works on hover/click; cache prevents duplicate devInspect storms;
cockpit badge shows the same edge for the selected strike or a defined unavailable
state; testnet RPC does not error under normal interaction.

Validation: `bun run build`; unit test for cost->implied-prob->edge conversion and
the cache key/TTL behavior; Playwright asserts ATM-band cells render an edge and a
cockpit badge appears; manual note on devInspect call volume during a hover sweep.

Status: done.

### S4 — Arb-free checker (surface health)
Objective: flag when the surface is internally inconsistent.

Work:
1. `application/arbFreeCheck.ts` (pure): butterfly check (convexity of price in
   strike / no negative implied density) per expiry column and calendar check
   (total variance non-decreasing in expiry at matched moneyness) across columns.
   Return typed `ArbViolation[]` with location + which rule.
2. Surface health surfaced in `EdgePanel` (a "Surface OK" / "N violations" status,
   sign + label + icon) and violating cells flagged on the heatmap (not color
   alone). Degrades cleanly when a column lacks SVI.

Acceptance: a constructed inconsistent grid is flagged with correct locations; a
healthy grid reports clean; violations never fabricated from missing data.

Validation: `bun run build`; unit tests for butterfly + calendar checks on
hand-built grids (healthy + each violation type); Playwright asserts the health
status renders.

Status: done.

### S5 — Time-travel slider (cut line)
Objective: replay recent SVI updates. First thing cut if time is short.

Work:
1. `volSurfaceService`: retain a bounded ring buffer of recent surface snapshots
   (from `GET /oracles/{id}/svi` history on load + live updates).
2. `TimeTravel.tsx`: a scrubber that re-renders heatmap + smile at a past snapshot;
   "Live" snaps back to current. Reduced-motion: instant, no animated tween.
   Degrades to a disabled "live only" control when no history is available.

Acceptance: scrubbing changes the rendered surface to a real past snapshot; "Live"
returns to current; absent history disables the control with a clear label, no
crash.

Validation: `bun run build`; Playwright scrubs and asserts the surface changes then
returns to live; assert disabled state when history is empty.

Status: done.

### S6 — Prod-readiness (CORS), states, a11y, tests, docs
Objective: deploy-ready end to end, polished, accessible, and the surface added to
the smoke probe.

Work:
1. **CORS fix (decision 9):** make a prod build work without a white page. Set up
   `VITE_TESTNET_RPC_URL` handling at BOTH layers that hit the fullnode directly in
   prod: `src/predict-surface-studio/main.tsx` + `src/predict-club-next/main.tsx`
   dapp-kit `createSuiClient` (currently `getJsonRpcFullnodeUrl` in prod), and the
   predict data layer's RPC config. Document a CORS-friendly provider in
   `.env.example`. Verify a `bun run build` + `bun run preview` renders the studio
   and cockpit without CORS errors (or with a clear, documented requirement to set
   the env var).
2. States pass: every panel (heatmap, smile, edge, arb, time-travel) has defined
   empty / loading / stale / disconnected states. No blank panels, no fabricated
   numbers, no em-dash.
3. A11y pass: focus order, keyboard navigation of heatmap cells / column selection,
   ARIA on the matrix (role + labels), contrast audit of the color ramp against
   tokens (every cell pairs color with a number), reduced-motion verified.
4. Tests + probe: unit tests green; extend `scripts/predict-club-ui-smoke.mjs` (or a
   sibling) to cover the studio entry (mounts, heatmap grid present, no console
   errors, no overflow desktop + mobile); a Playwright spec for the studio.
5. Docs: update `DESIGN.md` (or a studio section) with the surface + edge model;
   update this plan's statuses; refresh the plans README.

Acceptance: a built deploy renders both surfaces without CORS failure (or with a
documented one-line env requirement); all panels have non-happy states; a11y checks
pass; build + unit + e2e + smoke green.

Validation: `bun run build`; `bun run preview` smoke; `bun run test:unit`;
`bun run test:e2e`; `bun scripts/predict-club-studio-smoke.mjs` (studio sibling of
the cockpit smoke probe).

Status: done.

### S7 — Direct submit from the heatmap (trade ticket)
Objective: let a connected-wallet trader act on the surface they are reading - click
a heatmap cell (a strike x expiry), pick a side, size it, and mint a personal binary
position straight from the Studio, designed to be easy for a newcomer.

Work:
1. **Orchestration helper** (`application/submitStudioTrade.ts`, pure + unit-tested):
   `recommendDirection` (model-edge hint, null when no quote), `buildStudioRiskInput`
   (empty indicators -> neutral bias so the gate reduces to real safety conditions),
   and `submitStudioTrade` (risk gate -> read-only preflight quote -> `buildMintTx` ->
   sign). Mints a standalone position via the shared gateway; never touches the club
   round machinery.
2. **Trade ticket popover** (`presentation/studio/TradeTicket.tsx`): anchored at the
   clicked cell. Shows the model fair win-probability (always, from SVI) and the
   contract-implied probability + edge when the cell sits in the quoted band, flags
   the side the model sees value on, takes a DUSDC size with quick chips, and gates by
   state (disconnected -> Connect Wallet; no manager / insufficient DUSDC -> blocked
   with reason; submitting -> spinner; success -> digest + explorer link). ARIA dialog
   with a document-level Escape close so a mouse user can dismiss it.
3. **Contract pre-flight (decision: do not let a doomed strike reach the wallet).** The
   heatmap lets a trader click any cell, but the contract only prices strikes near the
   forward and aborts on-chain (`quote_spread_from_fair_price`) for the rest. A
   read-only devInspect quote (same proven path as the mispricing ladder, zero gas, no
   wallet prompt) runs before signing; an out-of-bounds strike is blocked with a
   friendly "pick a nearer strike" message instead of a reverting transaction.
4. **Heatmap full-USD strike labels.** Strike row headers show the full price
   (`$63,951`) instead of a rounded `64k`, so adjacent strikes are distinguishable for
   a real decision.
5. **Smooth IV smile.** The smile slice resamples the SVI curve densely (drawn in real
   pixel space via a ResizeObserver, no aspect stretching) so it reads as the smooth
   curve it is, not a jagged join of sparse cells; edge panel sits above it on the
   right column.
6. Tests + probe: unit tests for the strike unit (USD, unscaled to the gateway), risk
   gate blocks, preflight bounds block, and signer-failure-as-result; the smoke probe
   and Playwright spec gain a ticket-gating case (cell click opens the ticket,
   disconnected shows Connect and hides Submit, Escape closes).

Acceptance: a connected wallet can mint a position from a heatmap cell on testnet
(verified: a live mint returned a digest); an out-of-bounds strike is blocked before
signing with a clear reason; build + unit + e2e + smoke green.

Validation: `bun run build`; `bun run test:unit`; `bun run test:e2e`;
`bun scripts/predict-club-studio-smoke.mjs`; one live testnet mint to confirm the sign
path end to end.

Status: done.

### S8 — Cell signal + hover/focus tooltip (which cell to click)
Objective: the grid printed IV% on every cell alike, so a newcomer could not tell which
cell was worth acting on. Give the few cells that carry a real model edge an always-on,
eye-catching mark that says "this one is worth a trade", and surface the full per-cell
detail on hover/focus, so the grid stays scannable (chart-is-king) while only the rare
opportunity cells are highlighted.

Work:
1. **Edge tiers + value side helpers** (`application/submitStudioTrade.ts`, pure +
   unit-tested): export `DIRECTION_EDGE_EPS` (0.5pp noise floor, was module-private) and a
   new `STRONG_EDGE_EPS` (2pp); add `edgeSide(edge)` (the value side framed from
   `edge = contract - fair`: `edge < 0` favors UP, `edge > 0` favors DOWN, null inside the
   noise band, agreeing with `recommendDirection`) and `edgeTier(edge)`
   ('none' / 'weak' / 'strong' by magnitude).
2. **Always-on cell signal** (`presentation/studio/VolHeatmap.tsx`): replace the old edge
   dot with a caret + edge points in the cell's bottom-right corner - `▲2.3` (UP has
   value) / `▼1.8` (DOWN has value). The caret is the primary encoding (colorblind-safe);
   color is a second layer. 'weak' draws faint; 'strong' adds a chip background so a glance
   separates the few clear opportunities from the merely-nonzero. Below 0.5pp: no mark, so
   the grid stays clean. The signal only exists where there is a contract quote (the
   selected column's ATM band), so it is naturally sparse - by design, not a gap.
3. **Hover/focus tooltip for every cell** (`data-pc-studio-cell-tip`): a floating panel,
   anchored to the cell rect and clamped to the viewport (mirrors how `TradeTicket` places
   its popover), showing strike, moneyness vs spot, IV, model UP win-probability
   (`computeFairValue`, free SVI math present for every cell), the contract edge + value
   side when the cell sits in the quoted band, IV-vs-realized (rich / cheap / fair), and a
   "Click to trade" call to action. The tooltip is `aria-hidden`; its facts also extend
   each cell's `aria-label` (moneyness + model win-prob) so a screen-reader user hears the
   same depth without it being read twice. Roving tabindex + the S6 ARIA grid are unchanged.
4. Tests + probe: unit tests for `edgeSide` / `edgeTier` at the tier boundaries; the smoke
   probe and Playwright spec gain a tooltip case (focus a live cell shows the panel with
   strike + model probability, blur hides it). The caret signal itself is not asserted
   headless - it needs a live contract quote.

Acceptance: hovering or focusing any live cell shows the detail tooltip; only cells with a
real model edge (>= 0.5pp) carry the caret signal, with the >= 2pp ones visibly stronger;
the grid stays uncluttered; build + unit + e2e + smoke green. Presentational only - no
transaction signing, no contract change.

Validation: `bun run build`; `bun run test:unit`; `bun run test:e2e`;
`bun scripts/predict-club-studio-smoke.mjs`.

Status: done.

### S9 — Positions / history drawer + claim
Objective: after minting, a position effectively vanished from the Studio - the trader
could not see what they held, which positions had settled, or claim a win. The only trace
was the localStorage `mintedKeys` tinting heatmap cells, which is a hint, not the truth, and
carries no detail and no claim path. Give the trader a positions/history view they can open
to see their real holdings and claim settled winners.

Work:
1. **Read positions from chain, not localStorage** (`infrastructure/deepbookPredictPricingService.ts`):
   export `fetchManagerBinaryPositions(walletAddress, managerId)`, which reuses the existing
   `fetchManagerSnapshot` chain read and keeps the binary leg. The chain is the source of
   truth; `mintedKeys` keeps its old heatmap-tint role, untouched. Add `sanitizeClaimError`
   beside `sanitizeMintError` to map claim aborts (not settled / lost / already claimed) to
   plain language.
2. **Claimability decided by the contract via devInspect** (`infrastructure/suiPredictGateway.ts`):
   factor a single `composeClaimTx` source of truth out of `buildClaimTx`, then add
   `simulateClaim` that devInspects that exact PTB (zero gas, no wallet prompt), mirroring
   `simulateMintBinary`. The UI never guesses from a settlement price it does not hold.
3. **Pure view helpers** (`domain/studioPositions.ts`, unit-tested): `classifyPosition`
   (live vs expired against the same ms clock the surface uses), `positionSideLabel`
   (ABOVE/BELOW to UP/DOWN), `positionStrikeUsd`, `positionMoneyness`, `positionKey` (stable
   identity so a refetch keeps each row's resolved claim status).
4. **Slide-in drawer** (`presentation/studio/PositionsDrawer.tsx`): a right-side ARIA dialog
   (`data-pc-studio-positions`, traps Tab, document-level Escape, click-outside backdrop -
   the TradeTicket pattern) grouping Live (with countdown) and Settled. Each settled row runs
   the claim pre-flight; ok shows a Claim button (`data-pc-studio-positions-claim`), not-ok
   shows the contract's reason. Disconnected and empty states are defined. Claim signs the
   real PTB then refreshes.
5. **Wiring** (`presentation/studio/StudioShell.tsx`): a Positions button in the status band
   (`data-pc-studio-positions-open`) with a live-count badge; positions refetch on
   wallet/manager change, after a confirmed mint or claim, and on a slow timer; `simulateClaim`
   + `handleClaim` injected into the drawer.
6. Tests + probe: unit tests for the pure helpers + `sanitizeClaimError`; the smoke probe and
   Playwright spec gain a drawer case (status-band button opens the sheet, disconnected shows
   the connect empty state, Escape closes). Claim itself is not asserted headless - it needs a
   connected wallet with a settled winning position.

Acceptance: the Positions button opens a drawer listing real binary positions grouped into
live (with countdown) and settled; a settled winner shows a Claim button gated by the
contract's own pre-flight, and claiming signs once and refreshes; losing / unsettled /
already-claimed positions show a reason, never a fabricated payout; build + unit + e2e +
smoke green. Claim signs a real transaction (same risk tier as mint); the pre-flight is
read-only.

Validation: `bun run build`; `bun run test:unit`; `bun run test:e2e`;
`bun scripts/predict-club-studio-smoke.mjs`.

Status: done.

### S10 - Positions drawer follow-ups: unwind, win/lose notes, header balances, multi-manager
Objective: round out the drawer after S9. Four gaps surfaced in use: (a) the header pill
never showed the wallet's SUI / DUSDC; (b) a settled win could be claimed but a still-live
position could not be exited early; (c) a trader could not read what price wins or loses a
bet without inferring it from UP/DOWN + a strike; (d) history showed only a fraction of the
trader's positions because a wallet can hold several PredictManagers and the app read only
the latest. The probe (`scripts/predict-club-probe.mjs`) also revealed `predict::claim` does
not exist - the settled payout is `predict::redeem_permissionless`.

Work:
1. **Claim is `redeem_permissionless`, not `claim`** (`infrastructure/suiPredictGateway.ts`):
   factor a shared `composeRedeemTx(params, fn)` taking the 7-arg shape
   (Predict, PredictManager, OracleSVI, MarketKey, U64 quantity, Clock, TxContext); `claim`
   composes `redeem_permissionless` (settled payout), `unwind` composes `redeem` (live
   re-sell). The missing U64 quantity param is threaded through every claim/redeem path.
2. **Unwind a live position** (gateway + `StudioShell.tsx` + `PositionsDrawer.tsx`): add
   `buildRedeemTx` / `simulateRedeem` mirroring the claim pair. A live row runs an unwind
   pre-flight; ok shows an Unwind button (`data-pc-studio-positions-unwind`) that sells the
   position back to the AMM at the current fair value (`predict::redeem`), not-ok shows the
   contract's reason. `sanitizeRedeemError` sits beside `sanitizeClaimError`.
3. **Plain win/lose notes** (`domain/studioPositions.ts`, unit-tested): `positionOutcomeRule`
   (UP wins "settles above $X", DOWN wins "settles below $X") and `positionLean` (live lean:
   winning / losing / atStrike within 0.05%). Rendered per row so the trader reads the bet
   condition directly.
4. **Header balances** (`predict-surface-studio.html` + `src/predict-surface-studio/main.tsx`):
   the static SUI / DUSDC pill is driven by the orchestrator ("loading..." while a fetch is
   in flight, the figure once resolved, "-" disconnected), polled on the same 30s cadence as
   the in-shell balances. The wallet-profile popup shows "Loading..." for null manager fields
   while loading, and `KNOWN_DECIMALS` gained DUSDC: 6 / PLP: 6 (fixing a 1000x PLP display).
5. **Multi-manager history** (`infrastructure/deepbookPredictPricingService.ts` + wiring):
   `ManagerPosition` now carries `managerId`; add `fetchAllManagerIds` and
   `fetchAllManagersBinaryPositions` (read every manager concurrently, each position tagged
   with its owner). The drawer **lists managers separately by default** (one labelled group
   each, newest tagged) and offers a `Combine all` / `List separately` toggle
   (`data-pc-studio-positions-combine`) - the drawer never silently merges; combining is the
   trader's choice. Claim / unwind target `position.managerId` (the owning manager), not
   always the latest, so a position in an older manager redeems correctly. `positionKey`
   gained `managerId` so identical bets across two managers do not collide.

Acceptance: the header shows SUI / DUSDC with a loading state; a live position can be unwound
(contract-gated) and a settled winner claimed, each via a read-only pre-flight then one
signed transaction; each row reads its win/lose condition in plain language and a live lean;
the drawer lists all of the wallet's managers and lets the trader combine them, with claim /
unwind hitting the right manager; build + unit + smoke green.

Validation: `bun run build`; `bun run test:unit`;
`bun scripts/predict-club-studio-smoke.mjs`. Live claim/unwind sign-step verifiable only with
a connected wallet holding a settled winner / a live position. Reference:
`docs/deepbook/predict/SURFACE-STUDIO-POSITIONS.md`.

Status: done.

### S11 - De-vig the mispricing edge + measure success by realized PnL

Objective: two root causes make traders feel "signals always fail": (A) edge does not
subtract the overround (vig), so a small positive edge may be entirely house fee;
(B) success is measured by win-count instead of realized PnL, so a +EV strategy that wins
rarely (low-prob, high-payout) looks like "always losing". Fix both with information-only
additions (no gating of existing signals).

Work:
1. **Quote both sides** (`application/mispricing.ts`): `getMispriceCell` now fires
   `Promise.all([quoteUP, quoteDOWN])` per strike. `buildMispriceCell` gains
   `contractProbabilityDown`, computes `overround = pUp + pDown - 1` and
   `netEdge = devigUp - fairProbability` (where `devigUp = pUp / (pUp + pDown)`).
   Edge-raw (`edge = contractProbability - fairProbability`) stays unchanged so
   `edgeTier`/`edgeSide` and caret heatmap are unaffected. Null when DOWN quote missing.
2. **Domain types** (`domain/volSurface.ts`): `MispriceCell` gains three nullable fields:
   `contractProbabilityDown`, `overround`, `netEdge`. Existing fields keep their semantics.
3. **EdgePanel ladder** (`presentation/studio/EdgePanel.tsx`): add an overround header line
   ("vig X.X%") and a Net column showing `netEdge` beside the existing Edge column. Edge-raw
   column unchanged. Grid gains one column. "-" when null.
4. **PnL roll-up** (`domain/studioPositions.ts`): `summarizeManagerPnl(groups)` returns
   `{ realizedPnl, settledCount, partial }`. Uses `group.realizedPnl` from indexer
   (already descaled). Null when no group has the field (hides PnL, does not show $0).
5. **PositionsDrawer** (`presentation/studio/PositionsDrawer.tsx`): PnL + Settled count
   rendered above the existing win-count stats. Green/red coloring. Hidden when null. Win-count
   stats remain (still useful context).
6. **Tests** (`tests/unit/`): `summarizeManagerPnl` cases (sum, null, partial). `buildMispriceCell`
   overround/netEdge correctness, null fallback, edge-raw unchanged.
7. **Probe** (`scripts/predict-club-probe.mjs`): print DOWN quote + overround + netEdge for one
   ATM strike, confirming overround > 0 and netEdge < raw edge on testnet.
8. **Docs** (`docs/deepbook/predict/MISPRICING-EDGE.md` + `.vi.md`): overround/devig/netEdge
   definitions, MispriceCell field table update.

Constraints:
- "Warn only" approach: caret/chip use edge-raw as before. Net-edge is informational.
- Overround/netEdge only computed when BOTH quotes present; never inferred from one side.
- PnL display uses already-descaled indexer values, no new bigint money-write-path.
- `import type` across domain/infrastructure boundary.
- No em-dash in any visible string.
- Concurrency note: MAX_CONCURRENCY=3 means up to 6 inflight devInspect (2 per strike).
  ATM band is narrow, so bounded.

Validation: `bun run build`; `bun run test:unit` (new + old pass);
`bun scripts/predict-club-studio-smoke.mjs` (20/20);
`bun scripts/predict-club-probe.mjs` (overround > 0, netEdge < raw edge on testnet).

Reference: `docs/deepbook/predict/MISPRICING-EDGE.md`.

Status: planned.

## Files Touched (indicative)

New: `predict-surface-studio.html`, `src/predict-surface-studio/main.tsx`,
`plugins/predict-club/application/{sampleVolSurface,volSurfaceService,arbFreeCheck}.ts`,
`plugins/predict-club/domain/volSurface.ts`,
`plugins/predict-club/presentation/studio/{StudioShell,VolHeatmap,SmileSlice,EdgePanel,TimeTravel}.tsx`.

Edited: `vite.config.ts` (entry registration), `plugins/predict-club/plugin.tsx`
(register `PredictClub.Surface.Studio`), one cockpit rail
(`ActionDock`/`ExposureRail`) for the mispricing badge, `src/predict-club-next/main.tsx`
+ studio main (CORS RPC config), `.env.example` (RPC provider doc),
`package.json` (minor per phase), `DESIGN.md`, this README index.

Not touched (cockpit chart-king stays as plan 22 shipped it): `PriceChart.tsx`,
`CockpitShell.tsx` layout, `LifecycleRail`, `ContextRail`, `DockTabs`,
`PredictClubContext`, `domain/roundPhase.ts`, `domain/payoutPreview.ts` (consumed,
not modified), `application/executeTradeplan.ts`, `data/`.

## Commit Strategy

Small commits, one phase each (S0 -> S6 in order), `package.json` minor bump per
phase, message body notes the checkpoint so it is revertable, same as plan 22.

## Open Risks

- **devInspect volume (S3).** Even ATM-band + lazy + cache could be heavy if the
  band is wide or hover is twitchy. Bound the band tight, debounce hover, cap
  concurrency; if testnet still strains, narrow to click-only quoting. This is the
  decision-8 pressure-test moment.
- **SVI fan-out latency (S1).** Several oracles x one SVI fetch each on load. Bound
  to active/future-expiry oracles, parallelize, and show columns as they arrive
  rather than blocking the whole grid.
- **Heatmap reading as "pro" (S1).** Same risk as the king chart in plan 22: if the
  matrix underwhelms at S1, fix density/contrast/typography before S2+ build on it.
- **Realized-vol honesty (S2).** A 60-minute Binance window is a short estimate;
  label it as such (window length shown) so IV-vs-realized is not oversold.
- **Time-travel scope (S5).** Explicitly the cut line. If S0-S4 + S6 run long, ship
  without it; the surface + edge + arb-free already deliver the thesis.
