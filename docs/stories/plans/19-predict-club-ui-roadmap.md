# Predict Club UI Implementation Roadmap

## Goal

Turn the current Predict Club prototype into a coherent wallet-first DeepBook
Predict cockpit. This plan breaks the UI work into implementation steps that
can be built and validated independently.

Canonical references:

- `docs/product/predict-club.md`
- `docs/product/predict-club-ui-requirements.md`
- `docs/deepbook/predict-club-data-contract.md`
- `docs/deepbook/predict-club-devinspect-pricing.md`
- `docs/deepbook/predict-club-payout-preview.vi.md`
- `docs/stories/plans/16-predict-club-wallet-profile-popup.md`

## Current Baseline

Implemented or partially implemented:

- Predict Club page and plugin shell.
- Decision strip with BTC spot/forward/oracle summary.
- Wallet profile popup mounted through `plugins/sui-wallet-profile`.
- Fast Refresh split for `PredictClubContext`.
- Wallet profile cache and RPC 429 fallback.
- Initial contract quote and payout preview work.
- Funding router, escrow offers, round history, portfolio/vault summaries in
  partial UI form.

Known gaps:

- Some Predict server and Sui object fields still resolve to `Unavailable`.
- Contract quote error mapping needs cleaner user-facing messages.
- Range positions need explicit display support.
- Active oracle selection needs a fuller modal/list.
- Funding routes other than direct DUSDC are not fully wallet-signed.
- Tests cover only a narrow smoke path.

## Phase 1: Stabilize Data Contracts

Objective:

Make the app's data shape explicit and keep all panels reading from one shared
snapshot.

Status: implemented in `0.45.3`.

Work:

1. Audit `PredictClubContext` state and actions against
   `predict-club-data-contract.md`.
2. Ensure oracle state includes spot, forward, expiry, freshness, price ticks,
   and latest SVI.
3. Ensure manager snapshot can keep last good data when one sub-read fails.
4. Ensure vault snapshot exposes available liquidity, max payout, utilization,
   and wallet LP share when available.
5. Normalize all `Unavailable` reasons so the UI can explain them.

Acceptance:

- No panel fetches oracle, wallet, manager, or vault data independently when the
  context already owns it.
- `Unavailable` is paired with a reason field.
- Existing wallet popup still opens and does not spam balance RPC.

Validation:

- `bun run build`
- focused unit tests for data normalization if test harness exists
- manual active oracle check when RPC/API is available

Implementation notes:

- `PredictPricingSnapshot` now carries `managerReason` and `vaultReason` so
  `Unavailable` states are explainable.
- `PredictClubContext` preserves the last good manager/vault snapshot when a
  later sub-read fails.
- `RiskGateInput` now accepts oracle active, forward price, SVI, quote, and
  vault availability flags from the shared context snapshot.
- `Risk Checks` now surfaces `Oracle active`, `Forward price`, `SVI surface`,
  `Contract quote`, and `Vault liquidity` checks.
- `RiskPanel` shows manager/vault unavailable reasons instead of generic copy.
- Added a local `bun:test` ambient type declaration so project build can type
  check test files under `plugins/`.

Validation run:

- `bun run build`
- `bun run test:unit`

## Phase 2: Finish Decision Strip

Objective:

Make the decision strip the single source of round context.

Status: implemented in `0.45.4`.

Work:

1. Lock the cell order: Asset, Forward, Direction, Strike, Expiry, Pledged,
   Price Ticks, Active Oracles.
2. Render BTC spot and forward with money/data emphasis.
3. Use the last 24 price ticks for the mini chart with stable dimensions.
4. Move all oracle selection UI to the right side.
5. Add selected/active state to oracle list rows.
6. Show stale/missing state inline without moving layout.

Acceptance:

- A user can identify the selected oracle, price, forward, direction, strike,
  expiry, pledged amount, and tick count without opening another panel.
- Active Oracles can be opened and closed without covering the primary action.

Validation:

- Playwright screenshot on desktop and mobile.
- No overlapping text in the strip.

Implementation notes:

- Decision Strip order is now Asset, Forward, Direction, Strike/Range, Expiry,
  Pledged, Price ticks, then Active Oracles/actions on the right.
- BTC spot and forward use money/data emphasis.
- Expiry combines selected oracle expiry and freshness in one compact cell.
- Price ticks render as a stable-width 24-tick mini chart with a fixed count
  badge.
- Active Oracles opens from the right side and shows selected state, expiry,
  oracle id, and loaded Price/SVI availability for the selected oracle.
- Static `predict-club.html` fallback was updated to match the same strip
  terminology and order.

Validation run:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 3: Clean Risk And Exposure

Objective:

Make the right panel clear for new users and accurate for advanced users.

Status: implemented in `0.45.5`.

Work:

1. Keep only one readiness block: `Risk Checks`.
2. Remove duplicated ready/execution blocks.
3. Rebuild `Your Exposure` with:
   - estimated cost
   - win probability
   - gross if win or indicative payout
   - potential profit
   - risk/reward
4. Add strict number formatting.
5. Add compact `Preview unavailable` reasons.
6. Map raw Move aborts into user-facing quote reasons.

Acceptance:

- No raw huge numeric values appear in the UI.
- `Win Probability` never shows invalid `0.0%` because of missing data.
- Quote failures are short and actionable.

Validation:

- unit tests for display formatting and quote error mapping
- Playwright check for preview unavailable state

Implementation notes:

- `Your Exposure` now surfaces five compact metrics: estimated cost, win
  probability, gross if win, potential profit, and risk/reward.
- Missing or degraded probability renders as `—`; floored probability renders
  as `<0.1%`.
- Large DUSDC numbers use compact formatting so raw contract-scale values do not
  leak into the UI.
- Long `devInspect` and Move abort errors are shortened before display while
  preserving the actionable reason.

Validation run:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 4: Wallet Profile And Address UX

Objective:

Make wallet/account/object information usable everywhere.

Status: implemented in `0.45.5`.

Work:

1. Promote a shared address control for copy and SuiScan testnet links.
2. Apply it to wallet profile, PredictManager id, oracle id, vault id, and
   position ids.
3. Keep wallet profile mounted only while open.
4. Keep cached wallet/profile reads and in-flight guard.
5. Add keyboard close behavior and focus handling if missing.

Acceptance:

- Clicking any address-like value either copies full value or provides a clear
  copy icon.
- Object ids link to `/object/<id>` and account addresses link to
  `/account/<address>`.
- Popup interaction remains smooth.

Validation:

- Playwright popup open/close test
- link URL assertion
- no severe console errors

Implementation notes:

- Added a shared Predict Club `AddressControl` for copy and SuiScan testnet
  links.
- Applied address/object controls to wallet rows, PredictManager id, selected
  oracle rows, and wallet profile Predict positions.
- Account links use `/account/<address>`; object-like ids use `/object/<id>`.
- Wallet profile popup now focuses itself when opened and closes with `Escape`.
- Embedded wallet profile still returns `null` while closed, so expensive wallet
  profile UI is mounted only while visible.

Validation run:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 5: Portfolio, Range Positions, And Vaults

Objective:

Show what the connected wallet owns and what liquidity backs the round.

Status: implemented in `0.45.6`.

Work:

1. Parse and render binary positions.
2. Parse and render range positions.
3. Show unsupported position rows rather than hiding them.
4. Add claimable/settled/open status labels.
5. Resolve vault liquidity and max payout from server or chain reads.
6. Show wallet PLP balance and LP share when available.

Acceptance:

- A connected wallet can see whether it has open Predict positions.
- Range positions are visible.
- Vault metrics do not show demo values without a label.

Validation:

- script/manual check with a known wallet
- Playwright empty and populated portfolio states

Implementation notes:

- `RiskPanel` now shows portfolio position rows instead of only a raw open count.
- Wallet profile now shows open, binary, and range counts alongside a vault
  backing section.
- Vault metrics are rendered as explicit liquidity, max payout, withdrawal, and
  LP share values rather than hidden behind generic placeholders.
- Position rows surface oracle ids and strike context when available.
- The shared wallet profile payload preserves binary/range position details for
  the popup and the Predict Club panels.

Validation run:

- `bun run build`
- `bun run test:unit`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`

## Phase 6: Funding Router And Escrow

Objective:

Make member funding steps understandable before full on-chain automation.

Work:

1. Keep Direct DUSDC as the only fully ready route unless signed integration is
   implemented.
2. Label swap, bridge, borrow, and escrow states accurately.
3. Add create/fill/cancel offer flows where local or on-chain support exists.
4. Make route disabled reasons short.
5. Move long explanations into modals or docs.

Acceptance:

- New member sees exactly which funding route is usable.
- Preview-only routes cannot be mistaken for executed transactions.

Validation:

- Playwright funding modal test
- disabled-state regression check

Status: implemented in `0.46.0`.

## Phase 7: Round Lifecycle And Actions

Objective:

Make primary action follow the round lifecycle.

Work:

1. Normalize phases: Draft, Funding, Ready, Executing, Open Position, Expired,
   Settled, Claimable, Claimed.
2. Derive the single primary action from wallet state, manager state, funding
   state, quote state, and round phase.
3. Disable impossible actions with explicit reasons.
4. Add settled/claimable actions when data is available.

Acceptance:

- The page never shows two competing primary actions.
- A new member can follow:

```text
Connect Wallet -> Create Manager -> Fund/Pledge DUSDC -> Review Risk -> Sign & Execute
```

Validation:

- state-machine style unit tests if feasible
- Playwright checks for disconnected and connected states

Status: implemented in `0.46.0`.

## Phase 8: Test And Documentation Hardening

Objective:

Prevent regressions while the feature expands.

Work:

1. Add tests for payout preview, probability formatting, quote error mapping,
   risk aggregation, and address formatting.
2. Expand Playwright coverage:
   - page renders
   - wallet triggers exist
   - wallet popup opens
   - Active Oracles opens
   - Signal Evidence is collapsed by default
   - Funding modal opens
   - no severe page errors
3. Keep docs updated in:
    - `docs/product/`
    - `docs/deepbook/`
    - `docs/stories/plans/`
    - `docs/decisions/` when tradeoffs become durable

Status: implemented in `0.46.0`.
4. Run QMD index after docs changes.
5. Run CodeGraph index after broad source changes.

Acceptance:

- Build and focused tests pass before commit.
- Docs describe the current behavior and the next implementation step.

Validation:

- `bun run build`
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`
- `qmd update -c profile-docs`
- `bun run codegraph:index` after source changes

## Phase 9: Round Lifecycle Visualization (Variant A)

Objective:

Replace the raw `Phase: {round.status}` text at `PredictionRoomPanel.tsx:39` with
a horizontal stepper + countdown banner (prototype Variant A), so a member can
see in one place where the round is, how long until settlement, and when they can
claim.

Status: planned (bump to `0.54.0` on implementation).

### Context

- Real render path: modular panels read from `PredictClubContext` and mount into
  `[data-pc-panel]` containers in `predict-club.html` via `src/predict-club/main.tsx`.
  `PredictClubRoot.tsx` is backward-compat only — do NOT touch it for this task.
- Throwaway prototype: `src/predict-club-lifecycle-prototype/` (variants A/B/C).
  Take only the Variant A design; do NOT import prototype code into production.
- Core difference vs prototype: the prototype auto-advances on a fake timer.
  Production phases are user/oracle driven, so only show a REAL countdown when a
  real deadline exists (`oracleState.expiry` while status = `executed`). Never
  fabricate a countdown for user-triggered phases.

### Mapping 8 RoundStatus → 5 lifecycle steps

| RoundStatus | LifecyclePhase | Active step | Notes |
| --- | --- | --- | --- |
| `draft` | setup | 1 | Leader configuring |
| `open` | setup | 1 | Awaiting accept signal |
| `confirmed` | fund | 2 | Confirmed, awaiting funding |
| `funding` | fund | 2 | Funding DUSDC |
| `executed` | live | 3 | Position live — real countdown |
| `settled` | settle | 4 | Oracle settled, awaiting claim |
| `claimed` | claim | 5 | Terminal — done |
| `cancelled` | — | — | Dedicated red banner, no steps |

### Countdown rules (truthful, never fabricated)

- `executed` (live): "Settles in MM:SS" from `oracleState.expiry - Date.now()`;
  progress bar spans `round.confirmedAt` → `oracleState.expiry`. Tick every 1s via
  `useState` + `setInterval`, cleared on unmount.
- `settled`: "Awaiting claim" — no countdown.
- `claimed`: "Claimed ✓" — terminal.
- `draft`/`open`/`confirmed`/`funding`: show step label + hint, NO timer. May show
  `round.expiryMinutes` as "configured round length", labeled clearly as config not
  a live countdown.
- `cancelled`: red banner "Round cancelled", hide the stepper.

### Work

1. Create `domain/roundPhase.ts` (pure logic, unit-tested):
   - `type LifecyclePhase = 'setup' | 'fund' | 'live' | 'settle' | 'claim'`
   - `PHASE_ORDER`, `PHASE_LABEL`, `PHASE_HINT` (Records keyed by phase).
   - `mapStatusToPhase(status: RoundStatus): { phase: LifecyclePhase; stepIndex: number; cancelled: boolean; terminal: boolean }`.
   - `secondsToSettlement(args: { status: RoundStatus; oracleExpiryMs: number | null; nowMs: number }): number | null`
     — returns a positive number ONLY when `status === 'executed'` and `oracleExpiryMs > nowMs`; otherwise `null`.
   - `settlementProgress(args: { confirmedAtMs?: number; oracleExpiryMs: number | null; nowMs: number }): number | null`
     — 0..1, `null` when anchors missing.
   - `formatTimer(totalSeconds: number): string` → `MM:SS` (clamp ≥ 0).
2. Create `presentation/RoundLifecycleStrip.tsx`:
   - Read `club.activeRound` and `oracleSnapshot.oracleState?.expiry` via `usePredictClub()`.
   - `nowMs` state ticking every 1s ONLY while phase = live (avoid wasted re-renders).
   - Render: 5-node horizontal stepper (done = mint fill + ✓, current = mint ring +
     glow, pending = surface) using Tailwind tokens: `bg-primary-fixed-dim`,
     `text-primary-fixed-dim`, `border-outline-variant`, `bg-surface-container`. Below
     the stepper, a phase banner (label + hint + countdown/progress per rules above).
   - Use `font-data` for the countdown, `font-label`/`text-label-caps` for step labels.
3. Edit `presentation/PredictionRoomPanel.tsx`:
   - Remove the `Phase: {round.status.toUpperCase()}` badge (lines 38-40).
   - Render `<RoundLifecycleStrip />` as a full-width band right under the header
     (before the indicators grid). Keep the `{round.id}` chip.
4. Create `tests/unit/roundPhase.test.ts` (bun:test):
   - All 8 statuses map to correct phase + stepIndex; `cancelled`/`claimed` set flags.
   - `secondsToSettlement` returns `null` for every status ≠ `executed`; positive when
     `executed` + future expiry; `null` when expiry is in the past.
   - `formatTimer(0)` → `00:00`; `formatTimer(125)` → `02:05`.
5. Bump `package.json` minor → `0.54.0`.

### Acceptance

- `PredictionRoomPanel.tsx` no longer contains the literal `Phase: {round.status`.
- `RoundLifecycleStrip` renders inside the prediction room.
- `roundPhase.ts` exports `mapStatusToPhase`, `secondsToSettlement`, `formatTimer`.
- `executed` shows a per-second decreasing countdown; other phases show no fake timer.
- `cancelled` shows a red banner with no stepper.
- No layout shift across phase changes (stable stepper width).

### Validation

- `bun run build`
- `bun run test:unit` (incl. `roundPhase.test.ts`)
- `bun run test:e2e -- tests/e2e/predict-club.spec.ts`
- Playwright screenshots desktop + mobile (375px) for ≥ 2 phases (live + claim).

### Files touched

- Add: `plugins/predict-club/domain/roundPhase.ts`
- Add: `plugins/predict-club/presentation/RoundLifecycleStrip.tsx`
- Add: `tests/unit/roundPhase.test.ts`
- Edit: `plugins/predict-club/presentation/PredictionRoomPanel.tsx`
- Edit: `package.json` (version)
- (Optional) remove prototype `src/predict-club-lifecycle-prototype/*` +
  `predict-club-lifecycle-prototype.html` + its entry in `vite.config.ts` once
  Variant A has landed in production.

## Commit Strategy

Use small commits:

1. docs/product and deepbook contract updates
2. context/data service changes
3. UI phase changes
4. tests
5. docs/index refresh

Before code commits, bump `package.json` according to repo policy:

- patch for focused fixes
- minor for broader feature work
