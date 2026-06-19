---
name: Predict Club Terminal
colors:
  surface: '#0c1512'
  surface-dim: '#0c1512'
  surface-bright: '#323b37'
  surface-container-lowest: '#07100d'
  surface-container-low: '#151d1a'
  surface-container: '#19211e'
  surface-container-high: '#232c28'
  surface-container-highest: '#2e3733'
  on-surface: '#dbe5df'
  on-surface-variant: '#b9cbc2'
  inverse-surface: '#dbe5df'
  inverse-on-surface: '#29322f'
  outline: '#83958d'
  outline-variant: '#3a4a44'
  surface-tint: '#00e0b3'
  primary: '#fdfffc'
  on-primary: '#00382b'
  primary-container: '#00ffcc'
  on-primary-container: '#00725a'
  inverse-primary: '#006b54'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#fffeff'
  on-tertiary: '#393000'
  tertiary-container: '#ffe150'
  on-tertiary-container: '#746300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#24ffcd'
  primary-fixed-dim: '#00e0b3'
  on-primary-fixed: '#002118'
  on-primary-fixed-variant: '#00513f'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffe257'
  tertiary-fixed-dim: '#e2c635'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#534600'
  background: '#0c1512'
  on-background: '#dbe5df'
  surface-variant: '#2e3733'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  panel-gutter: 1px
---

## Brand & Style

The visual identity of the design system is anchored in high-performance utility and technical precision. It is designed for professional traders who require high information density without cognitive overload. The style is **Modern/Corporate** with a **Minimalist** finish, prioritizing legibility and rapid decision-making over decorative elements. 

By utilizing a "Terminal-First" approach, the UI minimizes distractions through a strictly dark-mode environment, allowing critical data points—like price action and execution status—to command attention through high-contrast accents. The aesthetic is inspired by advanced IDEs and institutional trading platforms, emphasizing a sense of control, speed, and reliability within the Sui and DeepBook ecosystems.

## Colors

The palette is optimized for long-duration sessions and critical monitoring. 

- **Primary Neutrals:** The foundation uses a deep navy-black scale (`#020617` to `#1E293B`). This provides a low-strain backdrop that makes transactional data stand out.
- **Action & Health (Mint):** Used for primary actions, bullish price movements, and "Ready" states. It signifies growth and system health.
- **Caution (Amber):** Reserved for non-blocking warnings, pending states, or slippage alerts.
- **Danger (Red-Orange):** High-urgency color for liquidation risks, blocked orders, or negative price action.
- **Information (Blue-Gray):** Applied to metadata, inactive labels, and secondary UI elements to keep them from competing with primary data.

## Typography

Typography is divided into two functional roles: **System Interface** and **Data Display**.

1.  **System Interface (Inter):** Used for navigation, labels, and descriptive text. It provides a modern, accessible feel.
2.  **Data Display (JetBrains Mono):** Crucial for all numerical values. Monospaced characters ensure that prices, countdowns, and balance sheets remain perfectly aligned in vertical columns, preventing "shimmering" or horizontal shifting when numbers update rapidly.

**Hierarchy Rules:**
- Use `label-caps` for table headers and section titles to maximize screen real estate.
- Use `data-md` for standard table cells.
- Use `data-lg` for primary tickers and balance summaries.

## Layout & Spacing

This design system utilizes a **Fluid Panel Grid**. The screen is treated as a single viewport divided into functional modules (Order Book, Charts, Position List).

- **Module Gutters:** Panels are separated by 1px borders rather than wide gaps to maintain the "Terminal" feel and maximize data density.
- **Internal Padding:** Modules should use a standard `md` (12px) or `sm` (8px) padding to ensure content is readable but compact.
- **Mobile Adaptation:** On mobile devices, panels reflow into a vertical stack or a tabbed interface. Gutters increase to `sm` (8px) to provide touch-target safety.
- **Density:** High density is the priority. Vertical rhythm should favor 4px increments.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **High-Contrast Outlines** rather than traditional drop shadows, which can appear muddy in dark-mode trading environments.

- **Surface Levels:** The background follows a "lighter as it lifts" logic. The base deck is the darkest, while active modals or dropdowns use the `background_overlay` color.
- **Borders:** Every panel and input is defined by a 1px border (`border_contrast`). This creates a structural grid.
- **Active States:** Active or focused elements are highlighted with a **Subtle Glow** (a 2px blur using the `primary_color` at 30% opacity) or a high-contrast Mint border.
- **Backdrop:** Use a heavy background blur (20px+) for overlays to maintain context of the underlying price action.

## Shapes

The shape language is disciplined and professional. 

- **Radius:** A consistent `0.25rem` (4px) radius is applied to buttons, inputs, and panel corners. This "Soft" setting keeps the UI feeling modern without losing the precision associated with sharp-edged technical tools.
- **Interactive Elements:** Buttons and form inputs share this radius to create a unified component language.
- **Data Tags:** Small status chips (e.g., "SUI/USDC") may use a slightly more rounded `rounded-lg` (8px) to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid Mint background with Navy text. Compact height (32px or 36px).
- **Secondary:** Outlined with `border_contrast`, Mint text.
- **Ghost:** No background, Blue-gray text, appearing Mint on hover.

### Inputs
- **Trading Fields:** Dark background with a 1px border. On focus, the border turns Mint with a subtle outer glow. Use JetBrains Mono for all numeric input.
- **Suffix/Prefix:** Integrated labels (e.g., "MAX" or "SUI") should be Blue-gray and use `label-caps`.

### Data Tables (Order Books / Positions)
- **Rows:** Subtle hover state (background lightens by 5%). No vertical borders between columns to keep the view clean.
- **Cells:** Use color-coding for data (Mint for Buy/Long, Red-orange for Sell/Short).

### Chips & Badges
- **Status Indicators:** Small, pill-shaped badges. "Ready" uses a Mint outline; "Risk" uses a Red-orange solid fill.

### Cards & Panels
- **Containers:** Defined by `background_surface` and a 1px border. Headers should have a distinct bottom border to separate them from the content.

## Chart-King Focal Point (Cockpit surface)

The rebuilt Next surface (the "cockpit") is organized around a single dominant
focal point: the price chart. Everything else is a thin supporting band or a
docked rail that frames it. This resolves the prior flat-hierarchy problem where
no element read as primary.

- **The chart owns the largest zone.** On desktop a `[minmax(0,1fr)_22rem]` grid
  gives the chart all remaining width with a fixed-width action rail beside it.
  On mobile the chart is the pinned hero at the top.
- **Supporting context is thin, never competing.** Lifecycle (stepper) and
  context (asset/strike/expiry) sit as single-row bands above the chart; the
  exposure rail and reference dock sit beside or below. None of them claim the
  visual weight of the chart.
- **Custom SVG, not a library.** The king chart is a hand-built SVG so it is
  fully themeable to the Terminal palette and stays small and fast. The Y-range
  tracks the live price series (spot + forward) so small intrabar moves stay
  readable; an out-of-range strike is clamped to the nearest edge with a
  directional caret rather than stretching the axis to reach it.
- **Truthfulness over decoration.** The chart shows live signals only when they
  are real: the settlement countdown appears only while the round is `executed`
  with a future expiry, and a "stale feed" badge appears when the oracle data is
  older than the freshness threshold. Demo or fabricated values are never shown
  as live.
- **One primary action.** Execution lives only in the action rail; no other rail
  carries a competing primary CTA. The exposure rail is read-only economics.

## Surface Studio (decision-support surface)

The Studio is a separate Vite entry (`predict-surface-studio.html`) that reuses
the predict-club data layer but stays fully independent of the cockpit. Where the
cockpit answers "what is the price doing right now", the Studio answers "is the
market mispriced, and is the surface internally consistent". It is analysis-first:
every panel earns its place as decision-support, and the one action it offers (a
trade ticket on a heatmap cell) is reached from that analysis, never the reverse.

- **The heatmap is the focal grid.** A strike x expiry implied-vol matrix is the
  primary object: strikes run high-to-low top-to-bottom, expiries near-to-far
  left-to-right, matching how a trader reads a vol matrix. It is a semantic CSS
  grid, not SVG, so every cell is real text with its IV printed; color is a
  SECOND encoding on top of the number, never the only signal (colorblind-safe,
  AA-legible dark-on-hot text). The selected expiry column drives the smile slice.
- **Edge is shown only when earned.** The edge panel pairs three independent
  reads: mispricing (contract-implied win probability minus SVI fair value), IV
  versus realized vol (with the realized window length labelled so it is not
  oversold), and arb-free health. Each degrades to a defined unavailable state
  rather than fabricating a number from missing data.
- **Arb-free health is a first-class signal.** A butterfly check (digital
  probability non-increasing in strike, so no negative implied density) per
  expiry column and a calendar check (total variance non-decreasing in expiry at
  matched moneyness) across columns flag an internally inconsistent surface.
  Violations surface as a count plus per-cell flags on the heatmap (a red ring and
  a warning icon, not color alone); a column lacking SVI is skipped, never guessed.
- **Time-travel replays real history.** A bounded ring buffer of recent surface
  snapshots backs a scrubber that re-renders the heatmap and smile at a past
  snapshot; "Live" snaps back to current. The live-only mispricing signal is
  cleared while scrubbing so a past surface never shows a present edge. With no
  history the control degrades to a disabled "live only" label.
- **Accessible matrix.** The heatmap is an ARIA grid (`role="grid"` with
  `role="row"` wrappers via `display:contents` so the CSS grid layout is kept).
  Keyboard users get a roving tabindex: the data cells are one tab stop and arrow
  keys / Home / End move focus between them, Enter or Space selects the column.
- **Trade ticket: edge informs, never advises.** Clicking a live heatmap cell opens
  a ticket popover anchored to that strike x expiry. It shows the model fair
  win-probability (always, from SVI) and the contract-implied probability when the
  cell sits in the quoted band, and flags the side the model sees value on - but the
  trader picks UP or DOWN; no payout is fabricated, only the stake and probabilities
  are shown. Submit mints a standalone personal binary position directly (the same
  `buildMintTx` the cockpit uses), not through a club round - the Studio owns no
  round state. A read-only devInspect pre-flight runs the same quote path the
  contract prices on, so a strike outside the contract's pricing bounds is caught
  with zero gas and no wallet prompt instead of a doomed on-chain mint. The ticket is
  an ARIA dialog: it traps Tab, a document-level Escape closes it regardless of
  focus, and disconnected it shows Connect Wallet rather than a live submit.
- **Mark only the cells that earn it; reveal depth on demand.** The grid prints IV
  on every cell alike, so an always-on signal is reserved for the few cells that
  carry a real model edge: a caret (the value side, the primary colorblind-safe
  encoding) plus the edge in points, faint at a weak edge and chip-backed at a
  strong one, nothing below the noise floor. The signal only exists where a contract
  quote does (the selected column's ATM band), so it stays sparse by design, never
  fabricated to fill the grid. Full per-cell detail (moneyness, model win-probability
  from free SVI math, the quoted edge and value side, IV-vs-realized) lives in a
  hover/focus tooltip that is aria-hidden, with the same facts folded into each
  cell's aria-label so a screen reader hears the depth without it being read twice.
- **A quoted cell leads with the payout multiple, not the vol number.** IV is the
  quant's language, not what a binary trader scans for: they want "stake 1, win how
  much". So a cell in the selected column's ATM band, where a real contract quote
  exists, shows the payout multiple (1 / contract win-probability, vig included) as
  its headline with the IV demoted to a small subline; the background stays the IV
  ramp so the surface still reads as a vol surface. The rest of the grid has no quote,
  so it keeps IV as the headline rather than a multiple inferred from the model, which
  would promise a fairer payout than the contract actually pays. The tooltip adds the
  payout as a Payout row alongside the model probability and edge.
- **Positions drawer: the chain is the source of truth, the contract decides claims.**
  After minting, the trader opens a right-side drawer listing their real binary
  positions read straight from their PredictManager on chain - not the localStorage
  mint hint, which only tints the heatmap. Positions group into Live (with a countdown
  to expiry) and Settled. Whether a settled position can be claimed is decided by the
  contract through a read-only devInspect pre-flight of the real claim PTB, never
  guessed from a settlement price the UI does not authoritatively hold: a Claim button
  appears only where the chain agrees, and a losing / unsettled / already-claimed
  position shows the contract's own reason instead. No profit or loss is fabricated -
  only the stake, strike, side, expiry, and the claim verdict are shown. The drawer is
  an ARIA dialog (traps Tab, document-level Escape, click-outside backdrop, the same
  pattern as the trade ticket); claiming signs one real transaction and refreshes.
- **A live position can be unwound, a settled one claimed, both contract-gated.** A
  still-live row offers an Unwind button that sells the position back to the AMM at the
  current fair value before expiry (`predict::redeem`), the mirror of the settled-payout
  claim (`predict::redeem_permissionless`). Each is gated by its own read-only
  devInspect pre-flight, so a doomed action never reaches the wallet, and each signs a
  single real transaction. Every row also states its win/lose condition in plain
  language (UP wins "settles above $X", DOWN wins "settles below $X") plus, while live,
  which way the current forward leans. This is the bet condition and a live lean, never
  a prediction: the contract settles.
- **Every PredictManager is surfaced, the trader chooses whether to combine.** A wallet
  can hold several PredictManagers (each `create_manager` mints a fresh one) and
  positions scatter across them, so the drawer reads them all and, by default, lists
  each manager as its own labelled group (newest tagged) rather than silently merging.
  A `Combine all` / `List separately` toggle folds them into one Live/Settled view only
  when the trader asks. Each position carries its owning manager, so a claim or unwind
  targets the right manager rather than always the latest, and the header pill shows the
  wallet's live SUI / DUSDC with a loading state.
- **The drawer leads with realized PnL, not a win/loss tally.** Counting winning rounds
  misreads a positive-expectancy book: a strategy that bets cheap, long-odds sides loses
  most rounds yet can profit overall. So the roll-up leads with realized PnL (summed from
  the indexer, green above zero and red below) plus the settled sample size behind it; the
  win / claimed / no-payout counts stay as secondary context. When the indexer prices no
  manager the PnL row hides rather than show a misleading $0, and a manager that fell back
  to an open-only read flags the history as incomplete.
- **The mispricing ladder shows the house margin and the edge net of it.** The raw edge
  (contract-implied minus model probability) does not subtract the overround baked into
  the contract price, so a small edge can be all vig. Quoting both sides exposes that
  margin (`overround = pUp + pDown - 1`), and the ladder shows it as a header warning plus
  a Net column (`netEdge`, the de-vigged edge) beside the raw Edge column. This is
  information only: the heatmap caret still reads the raw edge unchanged, so a trader can
  weigh value against the margin without the surface deciding for them.

## Motion

Motion is **restrained and institutional**: it confirms genuine state changes and
never decorates. The base tokens live in `presentation/next/motion.ts`
(durations 0 / 120 / 220 / 360ms; standard, decelerate, and accelerate easings).

- **Only on real state change.** Animation fires on phase advance, execute
  confirm, claim-ready, and sheet/dock open. Numbers never bounce or shimmer on
  oracle ticks; tabular-nums + JetBrains Mono keep updating values stable.
- **Enters, not loops.** The mobile action sheet slides up, its backdrop fades,
  and the desktop dock fades in on expand. There are no idle or looping
  animations on the trading surface.
- **Reduced-motion is honored globally.** A `prefers-reduced-motion: reduce`
  guard collapses every transition and animation to nothing, so the surface is
  fully usable without motion.