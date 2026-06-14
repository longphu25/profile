# Predict Club Cockpit Rebuild (Chart-King, Pro-First)

## Goal

Rebuild the Predict Club pro surface fresh as a dense, single-focal-point trading
cockpit where the price chart is king and one docked action rail owns the entire
action path. Reuse only the shared data layer; throw away the R1-R8 `next/` panel
code and the throwaway A/B/C variants as reference, not foundation.

This plan supersedes story 21's R1-R8 layout approach. Story 21 built a
multi-region cockpit that missed on four axes (density with no focal point, flat
hierarchy, unpolished feel, unclear action path). Rather than patch it, we rebuild
the presentation layer on a spine: one dominant zone, everything else ranked
beneath it.

## Locked Decisions (grill-me session, 2026-06-13)

These eleven decisions are the contract. Do not relitigate them mid-build; if one
proves wrong, stop and re-decide explicitly with the user.

1. **Primary user: Pro-first.** Dense Terminal cockpit is THE product. Casual
   one-tap is a future "lite mode," not the main event.
2. **Visual identity: keep Terminal-First, polish it.** The `frontend-design`
   skill's bold-display-font / dramatic-aesthetic rules are explicitly overridden
   for this surface — it is a data terminal, not a landing page. Budget goes to
   hierarchy, spacing, motion, and state polish on the existing token system.
3. **Foundation: rebuild fresh.** Reuse the shared data layer
   (`PredictClubContext`, `domain/`, `application/`, `data/`, `suiHostAPI`) and the
   tested `domain/roundPhase.ts`. Everything in `presentation/next/` and the
   variants is reference only.
4. **Rebuild priorities (what the old cockpit missed):** establish a focal point,
   build real hierarchy, raise polish, make the action path obvious. These are the
   acceptance lens for every phase.
5. **Focal point: chart is king.** The price chart (strike line, current-price
   line, countdown overlay) is the dominant zone. Direction, risk, lifecycle, and
   action become supporting rails ordered around it. TradingView/Bloomberg mental
   model.
6. **Primary action: docked side rail.** One persistent rail beside the king chart
   holds the phase-aware CTA plus direction/size inputs. Same spot every phase.
   Chart stays dominant. Never two competing primary CTAs.
7. **Mobile: chart hero + action sheet.** Chart stays full-width top hero; the side
   rail collapses to an always-visible compact CTA bar that swipes up for
   direction/size/risk; supporting panels become tabs/accordions below. One layout
   primitive drives both desktop side-rail and mobile sheet.
8. **King chart build: custom SVG.** A small, fast, fully themeable Terminal-First
   area/line chart driven by the oracle price series. No candlestick/crosshair
   library baggage; do not keep the 346-line `OrderFlowChart` canvas for the king
   zone.
9. **Home: replace `next/` in place.** Git history + per-phase checkpoint commits
   are the revert path. No third surface to maintain.
10. **Casual scope: pro now, hook for lite later.** The action rail gets a clean
    seam so a future lite toggle can reuse its phase logic. No second surface ships
    in this plan.
11. **Motion: restrained / institutional.** Mostly still, like a Bloomberg
    terminal. Motion is reserved for genuine state changes (phase transition,
    execution confirm, claim ready). Numbers do not bounce or shimmer on oracle
    ticks. `prefers-reduced-motion` honored everywhere (mandated by both
    `ui-ux-pro-max` and `design-taste-frontend`).

## Hard Constraints

- **Em-dash (`—`) is completely banned** in every visible string (headlines,
  labels, pills, buttons, captions, empty/error copy, alt text). Use a hyphen or
  restructure. This is the #1 anti-slop tell. (`design-taste-frontend` 9.G.)
- **Tailwind token collision:** the project defines `md` as a SPACING token
  (`--spacing-md` = 12px), so `max-w-md` resolves to 12px, NOT 448px. Always use
  `max-w-[28rem]` and friends. This bug already bit VariantA once.
- **No mock data shown as real.** Gate `Your Exposure` and any balance behind a
  connected wallet; show defined empty/loading states instead of demo numbers.
- **No forked data logic.** All derivation (primaryAction, risk gate, consensus,
  phase mapping) comes from the existing context/domain. Presentation only.
- **Accessibility (ui-ux-pro-max P1):** WCAG AA contrast (4.5:1 body, 3:1 large),
  visible focus rings, tab order matches visual order, color never the sole
  signal (pair UP/DOWN with icon + text), 44x44 touch targets on mobile.

## Data Layer (shared, confirmed — do not refork)

From `usePredictClub()`:

- `oracleSnapshot: ClubOracleSnapshot` — `.oracles[]`, `.selectedOracleId`,
  `.oracleState?.latest_price?.{spot,forward}`, `.prices[]` (the series the king
  chart renders).
- `pricingSnapshot: PredictPricingSnapshot` — `.quote` (estimatedCost, grossIfWin),
  `.fairValue` (probability, degraded, reason).
- `primaryAction: { label, action }` — already-derived single next action.
- `riskEvaluation: RiskEvaluation` — `.canExecute`, `.blockingReasons[]`,
  `.warningReasons[]`.
- `consensus: ConsensusResult` — indicator bento source.
- `club.activeRound: PredictionRound` — `.status` (RoundStatus), `.direction`,
  `.strike`, `.btcSpot`, `.confirmedAt`, `.thesis`, `.indicators[]`, etc.
- `context.isConnected`, `balances`, `predictManagerId`, `actions`.

From `domain/roundPhase.ts` (tested, shared):

- `mapStatusToPhase(status)` → `{ phase, stepIndex, cancelled, terminal }`
- `secondsToSettlement({ status, oracleExpiryMs, nowMs })` → truthful countdown,
  `null` unless `executed` with a future expiry.
- `settlementProgress(...)`, `formatTimer(seconds)`, `PHASE_ORDER`, `PHASE_LABEL`,
  `PHASE_HINT`.

One-tap directional execution already wired:
`actions.executeRound(directionOverride?: Direction)` computes strike from live
spot and persists direction+strike on success for settlement. The docked rail
reuses this.

## Design Tokens (Terminal-First, keep)

- Surface: `#0c1512`; container-lowest `#07100d`; on-surface `#dbe5df`.
- Primary mint: `--primary-fixed-dim #00e0b3` (UP / bullish / ready / health).
- Error: `#ffb4ab`; DOWN/bearish custom red `#ff5d73` on text `#2a0008`.
- Type: Inter (UI), JetBrains Mono (`--font-data`, all numbers, tabular-nums).
- 1px panel gutters (`gap-px` over `bg-outline-variant`), borderless panels.
- Radius 4px default; status chips may use 8px.

## Architecture

```
src/predict-club-next/main.tsx        (orchestrator — keep, repoint PANEL_MAP)
predict-club-next.html                (skeleton — keep, simplify slots to one root)
plugins/predict-club/presentation/next/
  CockpitShell.tsx     NEW  one source → desktop chart-king+side-rail / mobile hero+sheet
  PriceChart.tsx       NEW  custom SVG king chart (strike, current, countdown overlay)
  ActionDock.tsx       NEW  docked side rail: phase CTA + direction/size + risk gate
  LifecycleRail.tsx    NEW  5-step stepper (reuse roundPhase)
  ContextRail.tsx      NEW  asset / fwd / strike / expiry / oracles (decision context)
  ExposureRail.tsx     NEW  risk checks + Your Exposure (wallet-gated)
  DockTabs.tsx         NEW  funding / offers / history (bottom, collapsible)
  motion.ts            NEW  restrained duration/easing tokens + reduced-motion guard
```

Retire after cutover (final commit): old `presentation/next/*` panels
(`NextShell`, `ActionRail`, `RoundLifecycleStrip`, `DecisionStripNext`,
`PredictionRoomNext`, `RiskPanelNext`, `BottomDockNext`, `PanelShell`,
`VariantA/B/C`, `PrototypeSwitcher`). Keep them live until the rebuild is accepted
so the route never goes dark.

## Phases (each ends in a checkpoint commit + package.json minor bump)

### C0 — Layout foundation & motion tokens
Objective: one layout primitive that drives both desktop (chart-king + docked
side rail) and mobile (chart hero + action sheet), plus centralized restrained
motion.

Work:
1. `motion.ts`: duration/easing constants (institutional: ~120-200ms, ease-out),
   a `useReducedMotion` guard, and a rule that motion fires only on state change.
2. `CockpitShell.tsx`: CSS-grid cockpit. Desktop `lg:` =
   `[minmax(0,1fr)_22rem]` (chart zone | docked rail), with lifecycle/context as
   thin bands above the chart and a collapsible dock below. Mobile = single column,
   chart hero on top, a fixed bottom CTA bar, supporting rails as tabs.
3. Repoint `src/predict-club-next/main.tsx` PANEL_MAP / mount to render
   `CockpitShell` (keep old components importable until cutover).

Acceptance: new shell builds and mounts at the route; desktop shows a clear
chart-dominant grid with a docked rail column; mobile shows chart hero + a pinned
CTA bar; no horizontal overflow at 375px.

Validation: `bun run build`; Playwright at 1440px and 375px (root width bounded,
rail present desktop / CTA bar present mobile).

Status: done.

### C1 — King chart (custom SVG)
Objective: build the dominant zone.

Work:
1. `PriceChart.tsx`: themeable SVG area/line from `oracleSnapshot.prices`
   (`.spot`). Strike line (dashed) + current-price line + label; rising = mint,
   falling = red. `vectorEffect="non-scaling-stroke"`, tabular labels.
2. Countdown overlay: only when `secondsToSettlement` is non-null (status
   `executed`, future expiry); never a fabricated timer. `formatTimer` MM:SS.
3. Empty/collecting state (<2 points) and degraded-quote handling, no em-dash.

Acceptance: chart fills the king zone, reads clearly, strike vs current legible;
countdown shows only when truthful; renders with zero console errors.

Validation: `bun run build`; Playwright screenshot king zone desktop + 375px;
assert countdown absent when not `executed`.

Status: done.

### C2 — Docked action rail
Objective: the single action path, docked beside the chart.

Work:
1. `ActionDock.tsx`: phase-aware CTA from `primaryAction` (reuse the existing
   derivation — do NOT refork), risk-gated on `riskEvaluation.canExecute` for the
   execute phase, blocking/warning reasons listed beneath. Exactly one primary CTA.
2. Direction (UP/DOWN, two-color, icon + text) + size inputs feeding
   `executeRound(direction)`; submitting spinner; disabled states clear.
3. Clean seam (`useActionModel()` hook) so a future lite mode reuses phase logic.

Acceptance: one and only one primary CTA at every phase; UP/DOWN distinct by color
AND icon AND label; blocked execute shows reasons; disconnected shows Connect.

Validation: `bun run build`; unit test for the action-model selector across
statuses; Playwright disconnected (Connect, no submit buttons) vs the gated state.

Status: done.

### C3 — Lifecycle + context rails
Objective: the thin supporting bands above the chart.

Work:
1. `LifecycleRail.tsx`: 5-step stepper via `mapStatusToPhase`; `cancelled` = red
   banner, no stepper; no layout shift across phases; ARIA current-step.
2. `ContextRail.tsx`: asset / forward / direction / strike / expiry / pledged /
   oracles — dense, tabular, one row. No raw `Phase: {status}` text anywhere.

Acceptance: stepper truthful; cancelled banner correct; context row dense and
aligned; no layout shift on phase change.

Validation: `bun run build`; reuse `tests/unit/roundPhase.test.ts`; Playwright two
phases (live + claim).

Status: done.

### C4 — Exposure & risk rail
Objective: risk readiness + exposure without a second primary button.

Work:
1. `ExposureRail.tsx`: `Risk Checks` readiness block + `Your Exposure` (cost / win
   prob / gross / profit / risk-reward) with strict `display.ts` formatting.
2. Wallet-gate `Your Exposure` (no demo numbers as real); `Win Probability` never
   shows false `0.0%`; compact `Preview unavailable` reasons.

Acceptance: no second primary CTA; no raw huge numbers; exposure hidden until
connected.

Validation: `bun run build`; unit tests for formatting + quote-error mapping;
Playwright preview-unavailable state.

Status: done.

### C5 — Bottom dock (funding / offers / history)
Objective: reference surfaces that do not steal focus from the chart.

Work:
1. `DockTabs.tsx`: collapsible tabbed dock — Funding (node flow, real-state
   labels, short disabled reasons), Offers, History (no vertical borders,
   color-coded PnL, sticky headers).
2. Collapsed by default in the guided reading; expand persists per session.

Acceptance: preview-only funding routes cannot be mistaken for executed; tables
readable at density; dock collapses without reflowing the chart.

Validation: `bun run build`; Playwright funding modal + table render.

Status: done.

### C6 — Mobile transform (chart hero + action sheet)
Objective: a real mobile cockpit, not a stack.

Work:
1. From the C0 grid: chart hero pinned top; supporting rails become tabs/
   accordions; bottom dock behind a sheet.
2. Action sheet: always-visible compact CTA bar (phase CTA + UP/DOWN); swipe/tap
   up reveals direction/size/risk. Safe-area insets; 44x44 targets;
   `touch-action: manipulation`.

Acceptance: at 375px the chart + next action are visible without scroll; no
horizontal overflow; sheet opens/closes; reduced-motion collapses the sheet
animation to instant.

Validation: `bun run build`; Playwright 375px + tablet; assert CTA bar visible
without scroll.

Status: done.

### C7 — States, motion polish, a11y, tests, cutover
Objective: finish the surface and retire the old code.

Work:
1. Empty / loading / error / disconnected states for every rail (no blank panels,
   no demo data as real).
2. Restrained motion only on real state changes (phase advance, execute confirm,
   claim ready); reduced-motion verified.
3. A11y pass: focus order, keyboard close on sheet/dock, ARIA on stepper + action
   dock, contrast audit against tokens.
4. Cutover commit: delete retired `next/*` panels + variants once accepted.
5. Refresh Playwright spec to the new structure; run unit tests; update docs.

Acceptance: every rail has defined non-happy states; motion motivated and
reduced-motion-safe; old code removed; build + tests green.

Validation: `bun run build`; `bun run test:unit`;
`bun run test:e2e -- tests/e2e/predict-club.spec.ts`; updated variant spec.

Status: done.

## Files Touched (indicative)

New: `presentation/next/{CockpitShell,PriceChart,ActionDock,LifecycleRail,ContextRail,ExposureRail,DockTabs,motion}.tsx`.

Edited (additive until cutover): `src/predict-club-next/main.tsx` (PANEL_MAP),
`predict-club-next.html` (simplify to one root slot), `package.json` (minor per
phase), `DESIGN.md` (chart-king focal-point + motion sections).

Deleted (C7 cutover only): retired `next/*` panels, `VariantA/B/C`,
`PrototypeSwitcher`.

Not touched: `predict-club.html`, `src/predict-club/*`, existing
`presentation/*` (non-next) panels, `PredictClubRoot.tsx`, `PredictClubContext`,
`domain/` (except consuming `roundPhase.ts`), `application/`, `data/`.

## Commit Strategy

Small commits, one phase each, `package.json` minor bump per phase, message body
notes the checkpoint so it is revertable. C0 → C7 in order.

## Open Risks

- Custom SVG chart must read as "pro," not toy — if it underwhelms at C1, that is
  the moment to reconsider `lightweight-charts` for the king zone (decision 8
  revisit point), before C2 builds on it.
- The price series (`oracleSnapshot.prices`) only fills for the selected oracle;
  confirm density/refresh is enough for a convincing chart before committing C1.
