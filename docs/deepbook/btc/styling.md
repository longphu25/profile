# Styling & Design Discipline

## Design Tokens

The plugin Shadow DOM is fully scoped, so tokens must be declared again in
`:host`. Values are borrowed from the TaskForm design system plus the locked
palette:

```css
:host {
  /* Surfaces */
  --bg: #071011;
  --bg-2: #0a191a;
  --surface: rgba(8, 24, 25, 0.92);
  --surface-2: rgba(12, 34, 35, 0.96);
  --surface-3: rgba(190, 255, 234, 0.04);

  /* Lines */
  --border: rgba(190, 255, 234, 0.10);
  --border-strong: rgba(190, 255, 234, 0.22);

  /* Text */
  --text: #effff8;
  --text-2: #cfe9df;
  --muted: #6f8a83;
  --muted-2: #9fb9b1;

  /* Brand */
  --mint: #80ffd5;
  --teal: #28d8c1;
  --amber: #ffc46b;
  --sui: #6fbcf0;

  /* Locked chart palette */
  --up: #34d8a4;     /* mint-teal — bullish */
  --dn: #ff7a85;     /* coral — bearish */
  --neu: #6fbcf0;    /* sui blue — neutral lines (NWE mid, RSI) */
  --hi: #ffc46b;     /* amber — POC, MA200 */

  /* Type */
  --font-sans: 'Satoshi', 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

## Locked Accent Rule

Only 4 data colors are allowed: `--up`, `--dn`, `--neu`, `--hi`. Do not add the
default TradingView orange / yellow / cyan / purple accents.

| Element | Color | Token |
|---------|------|------|
| Bullish candle, up arrow, BUY tag | `#34d8a4` | `--up` |
| Bearish candle, down arrow, SELL tag | `#ff7a85` | `--dn` |
| NWE mid, RSI line, "neutral" hint | `#6fbcf0` | `--neu` |
| POC, MA200, alert highlight | `#ffc46b` | `--hi` |
| MA50 | `#80ffd5` | `--mint` |

NWE upper/lower use tinted `--dn` / `--up` (alpha 0.6). VP buy/sell uses tinted
`--up` / `--dn` (alpha 0.3-0.95 depending on POC/HVN/VA tier).

## Typography

| Use | Font | Sample |
|-----|------|--------|
| Pair, headlines | Satoshi 700 | `BTC / USDT` |
| Numeric (price, OHLCV) | JetBrains Mono | `73,580.42` |
| Eyebrows / labels | Satoshi 600 uppercase 0.18em | `INDICATORS` |
| Status bar, status tags | JetBrains Mono 9-10px | `OF · 4` |

Letter spacing cho mono: `0.04em`. Cho uppercase eyebrows: `0.16em` đến `0.18em`.

## No Emoji Discipline

Following the `design-taste-frontend` skill, every UI icon should be SVG or
text. This plugin avoids emoji in panel titles, status bars, and alert labels.
There are still 1-2 tasteful exceptions (▲▼ in TA signal text), which are
acceptable because they are standard directional arrows.

## Layout Discipline

### Flex Panes (Root Cause of Most Resize Bugs)

```css
.btc-chart        { position: absolute; inset: 0; display: flex; flex-direction: column; }
.btc-chart__col   { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.btc-chart__main  { flex: 7   1 0; min-height: 0; }
.btc-chart__rsi   { flex: 1.5 1 0; min-height: 0; }
.btc-chart__vol   { flex: 1.5 1 0; min-height: 0; }
```

`min-height: 0` on both `__col` and all 3 panes is **mandatory**. Flex children
default to `min-height: auto`, which prevents shrinking.

`position: absolute; inset: 0` on `.btc-chart` lets the chart escape the
ShadowContainer mount-point `<div>`, which does not provide its own height.

JS never sets `el.style.height`. Pixel height is updated through
`applyOptions({ height })` using the real `clientHeight` from `ResizeObserver`.

### Page-level Cascade (Host Page)

```css
/* src/btc-chart/btc-chart.css */
html, body { height: 100dvh; overflow: hidden; }
#root { height: 100dvh; }

.btc-page { height: 100dvh; display: flex; flex-direction: column; }
.btc-page > div { flex: 1; min-height: 0; height: 100%; }
```

`.btc-page > div` targets the `<div>` created by `ShadowContainer`. This is the
bridging rule that carries viewport height into the Shadow root.

## Ghost Borders

Per the design system, do not use heavy 1px solid borders. All borders use
`--border` (alpha 0.10) or `--border-strong` (0.22). Exceptions:

- Active state buttons: use inset shadow
  `box-shadow: inset 0 -1.5px 0 0 var(--mint)` instead of a border.
- Alert "fired" state: `border-left: 2px solid var(--mint)` because the visual
  anchor needs a solid line.

## Spacing Rhythm

Sidebar panel padding: `14px 16px`.
Row gap trong panel: `6px`.
Section title margin-bottom: `10px`.

Do not use `margin: auto` for centering. Use flex `align-items` /
`justify-content` instead.

## Responsive

```css
@media (max-width: 980px) {
  .btc-chart__sidebar { width: 230px; }
  .btc-chart__ohlcv { display: none; }   /* hide OHLCV strip */
}
@media (max-width: 768px) {
  .btc-chart__body { flex-direction: column; }
  .btc-chart__sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 45vh;
  }
}
@media (prefers-reduced-motion: reduce) {
  .btc-chart__live-dot,
  .btc-chart__spinner { animation: none; }
}
```

## Toast Positioning

The toast uses `position: absolute; top: 12px; left: 50%; translateX(-50%)`.
Do not use `position: fixed` because the plugin lives inside Shadow DOM;
`fixed` becomes viewport-relative rather than shadow-root-relative.

## Anti-patterns Avoided

| Anti-pattern | Why it is avoided | Applied replacement |
|--------------|------------|--------|
| Toolbar with 7 colored dots | Visual noise, low signal | Text-only buttons, active state = inset underline |
| ML label shown twice | Duplicate signal | Single block, label + bar + foot in one card |
| Emoji panel titles (🤖 〰️ 📊) | AI default look | Plain uppercase mono titles |
| TradingView default palette (orange/yellow/purple/cyan) | Generic, unbranded | Locked 4-color palette |
| Mixed corner radii | Shape inconsistency | Everything rounded `4-8px`, pills only for the FNG bar pointer |
| Heavy drop shadows | Outdated visual style | Tonal layering through surface tiers |
| `useState` for continuous values | Re-render on every tick | Refs for candle data, alerts, VP options |
