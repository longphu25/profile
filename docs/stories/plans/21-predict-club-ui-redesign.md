# Predict Club UI Redesign

## Goal

Redesign the Predict Club cockpit at the UX and visual level without rebuilding
the data layer. The current screen works but overwhelms: seven dense regions
compete for attention, two primary actions fight each other, round phase is raw
text, and mobile is a naive stack. This plan reworks information architecture,
the action path, and the visual surface while keeping `PredictClubContext`, the
domain logic, and all data contracts intact.

## Relationship To Story 19

- Story 19 (`19-predict-club-ui-roadmap.md`) built the cockpit incrementally
  (Phases 1-8 implemented). This story is a **redesign**, not a continuation —
  it reworks what 19 produced.
- Story 19 **Phase 9** (Round Lifecycle Visualization, Variant A) is *planned,
  not built*. Do NOT build it separately. It is **subsumed by Phase R3** here so
  the lifecycle strip is designed as part of the new IA rather than bolted on.
  After this story lands, mark story 19 Phase 9 as superseded.

## Parallel Build Strategy

The old UX stays live and untouched. The new UX is built in **parallel files** on
its own route, both sharing one data layer. This mirrors the existing
`predict-club-lifecycle-prototype.html` precedent and lets the two be compared
side-by-side until the redesign is accepted.

| Concern | Old (keep, do not touch) | New (this story) |
| --- | --- | --- |
| HTML skeleton | `predict-club.html` | `predict-club-next.html` |
| Orchestrator | `src/predict-club/main.tsx` | `src/predict-club-next/main.tsx` |
| Panel components | `presentation/*.tsx` | `presentation/next/*.tsx` |
| Component registry | `plugin.tsx` (`PredictClub.*`) | same file, new `PredictClub.Next.*` names |
| Build entry | declared in `vite.config.ts` | add `predict-club-next` to BOTH `optimizeDeps.entries` and `build.rollupOptions.input` |

**Shared, never forked:** `PredictClubContext`, `domain/`, `application/`,
`data/`, `suiHostAPI`. Both UIs read one source of truth — no logic duplication,
no drift. Redesign work is presentation-only.

The new orchestrator copies the wallet/action wiring from `src/predict-club/main.tsx`
(context sync, `registerActions`, panel mount loop) but points its `PANEL_MAP` at
the new slot names and new components. Register new components in `plugin.tsx`
under `PredictClub.Next.*` so old and new can coexist in the same plugin bundle.

Cutover (end of story): once accepted, repoint `predict-club.html` →
`predict-club-next` content, or swap the route, and retire the old files in a
dedicated commit. Until then nothing in the old path changes.

## Canonical References

- `docs/product/predict-club.md`
- `docs/product/predict-club-ui-requirements.md`
- `docs/deepbook/predict-club-data-contract.md`
- `plugins/predict-club/DESIGN.md` (design tokens — Terminal-First)
- `docs/stories/plans/19-predict-club-ui-roadmap.md`

## Current UI Audit

Live render path: `predict-club.html` provides a static skeleton with
`[data-pc-panel]` slots; `src/predict-club/main.tsx` mounts React panels into
those slots reading from `PredictClubContext`. `PredictClubRoot.tsx` is
backward-compat only — do NOT touch it.

Existing regions and panels:

| Region | Panel | File |
| --- | --- | --- |
| Top nav | (static in html + `PredictClubPage.tsx`) | `src/predict-club/PredictClubPage.tsx` |
| Decision strip | `DecisionStripPanel` | `presentation/DecisionStripPanel.tsx` |
| Left column | `ClubPanel` | `presentation/ClubPanel.tsx` |
| Center | `PredictionRoomPanel` | `presentation/PredictionRoomPanel.tsx` |
| Right column | `RiskPanel` | `presentation/RiskPanel.tsx` |
| Bottom dock | `FundingRouterPanel`, `EscrowOffersPanel`, `RoundHistoryPanel` | `presentation/*.tsx` |
| Overlays | `ModalLayer`, `QuickPredictPanel` | `presentation/*.tsx` |

UX problems to fix:

1. **Density overload.** Seven regions visible at once; a new member cannot find
   the next step. DESIGN.md targets "professional traders, high density" but
   story 19 repeatedly serves the "new member" — that tension is unresolved.
2. **Competing primary actions.** `Accept Signal` (decision strip) and
   `Execute Trade` (right panel) both read as the main CTA. Story 19 Phase 7
   declared "never two competing primary actions" but the layout still shows two.
3. **Phase as raw text.** `Phase: FUNDING` / `Phase: {round.status}` gives no
   sense of progress, time-to-settle, or claim readiness.
4. **Mobile is a stack.** The 3-column dense layout reflows to a vertical dump
   plus a bottom nav; the action path is lost on small screens.
5. **Mock data leaks.** Hardcoded balances in `PredictClubPage.tsx` and a static
   member list in `predict-club.html` ship as if real.

## Design Direction

**Decision (recommended): keep Terminal-First identity, add a guided layer.**

- Keep the dark mint/amber/red palette, Inter + JetBrains Mono, 1px-gutter panel
  grid, and `DESIGN.md` tokens. The identity is strong and already invested in.
- Add **progressive disclosure**: a default "guided" reading where the single
  next action and round lifecycle dominate, with full pro-density panels one
  interaction away. Density is a property of the layout, not a separate theme.
- Introduce a **single primary-action rail** so exactly one CTA is ever primary,
  derived from round phase + wallet/funding/quote state (extends 19 Phase 7).

If the user later prefers a cleaner, lower-density default for newcomers, that is
a token + layout change confined to Phases R1-R2; the rest of the plan holds.

## Non-Goals

- No changes to `PredictClubContext` state shape, domain logic, or data
  contracts (that is story 19's domain). Redesign consumes existing data.
- No new on-chain flows or funding routes.
- `PredictClubRoot.tsx` is not touched (backward-compat shell).
- Connecting remaining mock data to real reads is noted where the redesign
  exposes a gap, but real-data wiring stays a story 19 follow-up unless trivial.

## Phase R1: Design Direction & Layout Foundation

Objective: lock the redesign direction and build the shared layout primitives
every later phase reuses.

Work:

1. Confirm Terminal-First + guided-layer direction; record it in `DESIGN.md`
   (add a "Density & Disclosure" section).
2. Scaffold the new parallel surface: `predict-club-next.html` (new skeleton +
   slots), `src/predict-club-next/main.tsx` (orchestrator copied from
   `src/predict-club/main.tsx`, new `PANEL_MAP`), and the `predict-club-next`
   build entry in BOTH `optimizeDeps.entries` and `build.rollupOptions.input`.
   Old `predict-club.html` / `src/predict-club/main.tsx` are not touched.
3. Build a responsive layout shell under `presentation/next/`: a `PanelShell`
   component (header + 1px border + body) and a region grid that drives desktop
   3-column and mobile reflow from one source.
4. Define motion tokens (durations, easing, reduced-motion) under
   `presentation/next/` so animation is consistent and centralized, not ad-hoc
   GSAP inline in the new HTML.

Acceptance:

- `predict-club-next.html` renders an empty new shell that builds and mounts.
- One layout primitive owns panel chrome; new panels never re-implement borders.
- Direction is documented in `DESIGN.md`.

Validation: `bun run build` (both entries build); the new route loads its shell;
old `predict-club.html` renders unchanged.

Status: planned.

## Phase R2: Information Architecture & Primary Action Rail

Objective: restructure the screen so there is one obvious action path and a
clear visual hierarchy.

Work:

1. Re-rank regions by attention in the new slot layout: lifecycle + primary
   action first, supporting context second, reference tables last.
2. Build a single **Primary Action Rail** as a new component
   (`presentation/next/ActionRail.tsx`): one component that renders the one
   correct CTA for the current phase (Connect / Create Manager / Fund / Review /
   Sign & Execute / Claim), with disabled reasons. The new UX never duplicates a
   competing CTA; it is the only primary action.
3. Derive `Accept Signal` vs `Execute Trade` into the single rail action.
4. Define collapse/expand affordances for pro-density panels (guided default).

Acceptance:

- Exactly one element is styled as primary action at any phase.
- A new member can follow Connect → Create Manager → Fund → Review → Execute
  visually without reading docs.

Validation: `bun run build`; state-driven unit test for the action selector;
Playwright check for disconnected vs connected primary action.

Status: planned.

## Phase R3: Decision Strip & Round Lifecycle (subsumes Story 19 Phase 9)

Objective: make the top band the single source of round context, including a
truthful lifecycle visualization.

Work:

1. Build a new `DecisionStripNext` (`presentation/next/`) for the new hierarchy
   (Asset, Forward, Direction, Strike, Expiry, Pledged, Ticks, Oracles).
2. Build `RoundLifecycleStrip` under `presentation/next/` (the story 19 Phase 9
   design, Variant A): map 8 `RoundStatus` → 5 steps
   (setup/fund/live/settle/claim); `cancelled` = red banner. Create the SHARED
   `domain/roundPhase.ts` (`mapStatusToPhase`, `secondsToSettlement`,
   `settlementProgress`, `formatTimer`), unit-tested. This domain helper is
   shared (not under `next/`) so the old UX could adopt it later if desired.
3. **Truthful countdown only**: real `MM:SS` only when `status === 'executed'`
   using `oracleState.expiry - now`; never fabricate timers for user-driven
   phases. (Carry over story 19 Phase 9 countdown rules verbatim.)
4. The new `PredictionRoomNext` (R4) carries no `Phase: {round.status}` raw text;
   lifecycle context lives only in `RoundLifecycleStrip`. Old `PredictionRoomPanel`
   is left as-is.

Acceptance:

- 5-step stepper renders; `executed` shows a per-second countdown; other phases
  show no fake timer; `cancelled` shows a red banner, no stepper.
- No layout shift across phase changes.

Validation: `bun run build`; `tests/unit/roundPhase.test.ts`; Playwright
screenshots for ≥2 phases (live + claim) desktop + 375px.

Status: planned. Bump target `0.55.0`.

## Phase R4: Prediction Room

Objective: make the center column scan-able — thesis, signal evidence, chart.

Work:

1. Build `PredictionRoomNext` (`presentation/next/`): lifecycle band (R3) under
   header, then Leader Thesis, indicator bento, chart.
2. Standardize the indicator bento tiles (consensus from `indicatorConsensus`)
   with consistent state colors.
3. Reuse `OrderFlowChart` (shared) inside the new chart frame; ensure
   strike/current price lines and labels read clearly.

Acceptance: center column reads top-to-bottom as context → evidence → chart with
no overlapping labels.

Validation: `bun run build`; Playwright screenshot center column.

Status: planned.

## Phase R5: Risk & Execution

Objective: make the right column clear for newcomers and accurate for pros, with
no competing CTA.

Work:

1. Build `RiskPanelNext` (`presentation/next/`): single `Risk Checks` readiness
   block, `Your Exposure` (cost / win prob / gross / profit / risk-reward) with
   strict formatting from `display.ts`.
2. Execution lives in the Primary Action Rail (R2); the right panel surfaces
   risk + exposure, not a second primary button.
3. Keep `Preview unavailable` reasons compact; keep Move-abort mapping.

Acceptance: no raw huge numbers; `Win Probability` never shows false `0.0%`; no
second primary CTA in the right column.

Validation: `bun run build`; unit tests for formatting + quote-error mapping;
Playwright preview-unavailable state.

Status: planned.

## Phase R6: Funding Router, Offers & History (bottom dock)

Objective: redesign the bottom dock so funding state and reference tables are
legible without stealing focus from the action path.

Work:

1. Build `FundingRouterNext` (`presentation/next/`) node flow (Direct ready;
   swap/borrow/escrow labeled by real state) with short disabled reasons.
2. Build `EscrowOffersNext` and `RoundHistoryNext` tables to the new table spec
   (no vertical borders, color-coded PnL, sticky headers).
3. Make the dock collapsible so guided-mode users can hide it.

Acceptance: preview-only routes cannot be mistaken for executed; tables are
readable at density without overflow.

Validation: `bun run build`; Playwright funding-modal + table render.

Status: planned.

## Phase R7: Responsive & Mobile

Objective: a real mobile experience, not a desktop stack.

Work:

1. Drive mobile from the R1 region grid: lifecycle + primary action pinned;
   supporting panels become tabs/accordions; reference tables move behind a
   sheet.
2. Redesign the mobile bottom nav to match the new IA (action-first).
3. Ensure touch targets, safe-area insets, and `375px` layouts hold.

Acceptance: on 375px the next action and lifecycle are visible without scroll;
no horizontal overflow.

Validation: `bun run build`; Playwright at 375px + tablet breakpoint.

Status: planned.

## Phase R8: States, Motion, A11y & Test Hardening

Objective: finish the surface — empty/loading/error states, motion, a11y, tests.

Work:

1. Define empty / loading / error / disconnected states for every redesigned
   panel (no blank panels, no demo data shown as real).
2. Centralize motion via R1 tokens; honor `prefers-reduced-motion`; keep all
   motion in the new surface (no ad-hoc inline GSAP in `predict-club-next.html`).
3. A11y pass: focus order, keyboard close on overlays, ARIA on the stepper and
   action rail, contrast against tokens.
4. Expand Playwright coverage (page renders, wallet popup, Active Oracles,
   funding modal, lifecycle phases) and run unit tests; refresh docs + indexes.

Acceptance: every panel has defined non-happy states; reduced-motion respected;
build + focused tests pass before commit.

Validation: `bun run build`; `bun run test:unit`;
`bun run test:e2e -- tests/e2e/predict-club.spec.ts`; `qmd update -c profile-docs`.

Status: planned.

## Files Touched (indicative)

New (the redesign lives here):

- Add: `predict-club-next.html` (new skeleton + new `[data-pc-panel]` slots)
- Add: `src/predict-club-next/main.tsx` (orchestrator, new `PANEL_MAP`)
- Add: `plugins/predict-club/presentation/next/*` (PanelShell, region grid,
  motion tokens, `ActionRail`, `DecisionStripNext`, `RoundLifecycleStrip`,
  `PredictionRoomNext`, `RiskPanelNext`, `FundingRouterNext`, `EscrowOffersNext`,
  `RoundHistoryNext`)
- Add: `plugins/predict-club/domain/roundPhase.ts` + `tests/unit/roundPhase.test.ts`

Edited (additive only, old path stays working):

- Edit: `vite.config.ts` (add `predict-club-next` to `optimizeDeps.entries` and
  `build.rollupOptions.input`)
- Edit: `plugins/predict-club/plugin.tsx` (register new `PredictClub.Next.*`
  components alongside existing `PredictClub.*`)
- Edit: `plugins/predict-club/DESIGN.md` (density & motion sections)
- Edit: `package.json` (minor bump per phase)

Not touched: `predict-club.html`, `src/predict-club/main.tsx`,
`src/predict-club/PredictClubPage.tsx`, existing `presentation/*` panels,
`PredictClubRoot.tsx`, `PredictClubContext`, `domain/` (except the new shared
`roundPhase.ts`), `application/`, `data/`.

Cutover (separate, end-of-story commit): repoint the route / swap
`predict-club.html` to the new content and retire the old files only after the
redesign is accepted.

## Commit Strategy

Small commits, one concern each, bump `package.json` minor per phase:

1. R1 foundation (layout primitives + DESIGN.md)
2. R2 IA + action rail
3. R3 decision strip + lifecycle (+ roundPhase tests)
4. R4 prediction room
5. R5 risk & execution
6. R6 bottom dock
7. R7 responsive
8. R8 states + a11y + tests + docs/index refresh
