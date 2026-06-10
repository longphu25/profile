# Predict Club UI Motion

Source reviewed on 2026-06-10:

- Transitions.dev: <https://transitions.dev/>
- GitHub: <https://github.com/Jakubantalik/transitions.dev>

## Purpose

Use Transitions.dev as the reference library for small, high-signal product
motion in Predict Club. The goal is to make state changes easier to follow, not
to add decorative animation.

Transitions.dev provides copy-ready CSS transition snippets for common web app
patterns and an optional agent skill:

```bash
npx skills add Jakubantalik/transitions.dev
```

Do not add the skill or generated snippets blindly. Use the patterns below as
the project standard, then adapt the copied CSS to the existing design tokens.

## Where To Use It

| Predict Club UI area | Transitions.dev pattern | Why |
|----------------------|-------------------------|-----|
| Decision Strip price cells | Number pop-in / text states swap | Make spot, forward, expiry and confidence updates legible without layout shift. |
| Wallet profile popup | Modal open/close | Keep wallet details feeling connected to the wallet button. |
| Active Oracles panel | Panel reveal | Show oracle list as a focused secondary panel, not another always-open block. |
| Risk Checks details | Panel reveal / text states swap | Expand detailed checks only when the user asks. |
| Trade execution status | Notification badge / success check / error shake | Communicate pending, confirmed and failed transaction states. |
| Funding route status | Icon swap / text states swap | Make Ready, Blocked, Review and External route changes readable. |
| Skeleton data load | Skeleton loader and reveal | Avoid abrupt jumps when oracle, portfolio or vault data arrives. |
| Tabs and segmented controls | Tabs sliding | Make active mode changes clear while keeping the interface compact. |

## Product Rules

- Animate state changes that carry meaning: price update, selected oracle,
  wallet connection, quote availability, risk gate, transaction status.
- Avoid decorative loops, bouncy excess, or motion that competes with trading
  numbers.
- Keep transforms and opacity as the default animation properties. Avoid layout
  animation unless the component needs resize clarity.
- Respect `prefers-reduced-motion: reduce` for every copied snippet.
- Keep transition durations short: usually `120ms` to `240ms`; allow `300ms`
  only for modal or panel open/close.
- Prevent layout shift with stable dimensions on numeric cells, buttons, tabs,
  side panels and cards.
- Use motion to clarify hierarchy: primary decision data first, secondary
  details after expand/click.

## Implementation Pattern

When copying from Transitions.dev:

1. Copy only the CSS needed for the selected transition.
2. Rename classes to the local component or utility naming style.
3. Replace demo colors, spacing and radii with existing design tokens.
4. Keep the `prefers-reduced-motion` guard.
5. Verify desktop and mobile states with Playwright/browser screenshots for any
   visible Predict Club UI change.

Prefer a small local wrapper or class per repeated pattern instead of scattering
one-off transition constants across components.

## Recommended Predict Club Motion Set

Start with this minimal set:

- `pc-number-update`: number pop-in for spot, forward, pledged DUSDC and payout.
- `pc-panel-reveal`: Active Oracles, Risk Checks details and wallet profile.
- `pc-status-swap`: quote unavailable/available, Ready/Blocked/Review, pending/done.
- `pc-success-check`: completed transaction or accepted risk gate.
- `pc-error-shake`: validation error for invalid amount, missing wallet or stale quote.
- `pc-skeleton-reveal`: oracle/vault/portfolio data loading.

This keeps the app consistent and avoids a different animation language in every
panel.

## Predict Club Use Cases

### Decision Strip

Use number pop-in only when the value changes. Spot and forward should stay in a
fixed-width, tabular numeric cell so the strip never shifts.

```text
BTC Spot updates -> short pop/fade
Forward updates -> short pop/fade
Expiry countdown -> text state swap, no bounce
Oracle freshness -> subtle text swap
```

### Quote And Execution

Use text state swap for quote lifecycle:

```text
Preview unavailable -> Pricing preview -> Contract quote ready -> Executing -> Confirmed
```

For failed quote or Move abort, use a restrained error shake on the affected
status block and keep the error message readable.

### Wallet Profile

Use modal open/close for the profile popup. Address copy feedback should use
success check or text state swap, not a toast for every copy action.

## Agent Guidance

When an agent is asked to improve UI polish in Predict Club:

1. Check this file before adding custom motion.
2. Use Transitions.dev patterns as the first reference for small transitions.
3. Do not add a large animation dependency only for these effects.
4. Keep snippets in component CSS or Tailwind-compatible utilities.
5. Verify reduced-motion and no-overlap behavior before final response.

## Open Questions

- Whether to install the Transitions.dev agent skill globally for Codex/Kiro or
  keep it as a docs-only reference.
- Whether repeated motion utilities should live in a shared Predict Club CSS
  module or near each component.
- Whether the app should expose a user-level motion preference in addition to
  OS-level reduced-motion.
