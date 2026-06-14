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

Status: pending.

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

Status: pending.

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
`bun run test:e2e`; `node scripts/predict-club-ui-smoke.mjs` (extended for studio).

Status: pending.

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
