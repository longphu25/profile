# Order Flow Overlay

Source: `plugins/btc-chart/order-flow-overlay.ts`

## Why Render It Manually

`lightweight-charts` provides `series.setMarkers()` with
`position: 'aboveBar' | 'belowBar'`. When many markers sit close together
(especially when zoomed out), they overlap the wick and their labels become
hard to read. The **gutter-band overlay** fixes that:

- SELL pills go into the top band of the main pane, away from candles.
- BUY pills go into the bottom band of the main pane.
- Every pill has a dotted **leader line** back to the wick to preserve visual linkage.
- When pills collide horizontally inside the same band, they stack into the next row.

## API

```ts
drawOrderFlow(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,        // used to read clientWidth/Height
  chart: { timeScale: () => { timeToCoordinate(t) } },
  series: { priceToCoordinate(p) },
  signals: OFOverlaySignal[],
  visible: boolean,
  rightOffset?: number,        // default 64 (reserves space for the price ladder)
): void
```

`OFOverlaySignal`:
```ts
{
  time: number       // unix seconds
  type: 'buy' | 'sell'
  ratio: string      // formatted volume ratio, e.g. '2.5'
  high: number       // candle high (leader-line anchor for sell)
  low: number        // candle low  (leader-line anchor for buy)
}
```

## Render Passes

1. **Measure + place** — convert each `time` through
   `chart.timeScale().timeToCoordinate(t)`, skip if null or outside the
   viewport. Convert the anchor price (`high` for sell, `low` for buy) through
   `series.priceToCoordinate()`.

2. **Anti-collision** — each band has rows. A new pill checks horizontal overlap
   against existing pills. If it collides, it stacks downward (sell) or upward
   (buy) into the next row. After 5 rows, overlap is accepted.

3. **Leader lines** — drawn first (lower z-index): dotted `[2, 3]`,
   `lineWidth: 1`, from the pill edge back to the wick (`high - 3` for sell,
   `low + 3` for buy), colored by signal type (alpha 0.45).

4. **Pills + arrows** — drawn last (higher z-index):
   - Pill: `roundRect` r=9, filled `#ff7a85` for sell / `#34d8a4` for buy,
     alpha 0.95.
   - Arrow `▲` / `▼` in 9px text, `#071011` (dark) at the left edge of the pill.
   - Ratio text `×N.N` in 10.5px mono next to the arrow.

## Gutter Positioning

```ts
const TOP_BAND_Y = 16             // SELL band y-center from the top
const BOT_BAND_INSET = 16         // BUY band y-center = H - 16
const PILL_H = 18
const STACK_GAP = 6               // min horizontal gap trước khi stack
```

Stack direction:
- Sell stack xuống (`y = bandStart + row * (PILL_H + 4)`).
- Buy stack lên (`y = bandStart - row * (PILL_H + 4)`).

## Plugin Wire-up

```ts
// State
const ofCanvasRef = useRef<HTMLCanvasElement>(null)
const ofOverlayRef = useRef<OFOverlaySignal[]>([])

// In renderData(): no more setMarkers
ofOverlayRef.current = of_.overlay
drawOrderFlow(
  ofCanvasRef.current,
  mainElRef.current,
  refs.mainChart,
  refs.candleSeries,
  v.of ? of_.overlay : [],
  true,
)

// In syncSize() (ResizeObserver): redraw so pills follow the new size
drawOrderFlow(...)

// In subscribeVisibleLogicalRangeChange (pan/zoom): redraw so pills follow x
drawOrderFlow(...)
```

The `<canvas class="btc-chart__of-canvas">` is positioned as:
```css
position: absolute;
top: 0; left: 0;
pointer-events: none;
z-index: 5;       /* above the VP overlay (z=4), does not block crosshair */
```

`drawOrderFlow` sets `canvas.width / .height = mainEl.clientWidth / .clientHeight`,
so the canvas always matches the main pane. When the RSI/Vol panes resize,
`ResizeObserver` triggers sync, the main pane height changes, and the canvas
backing store updates with it.

## Edge Cases

| Case | Behavior |
|------|----------|
| `visible: false` | Clear canvas, return — still keep `ofOverlayRef` so re-enabling is instant |
| `signals.length === 0` | Clear canvas |
| Time ngoài viewport | Skip (timeToCoordinate vẫn trả null/out-of-range) |
| Time near the price ladder | Skip if `x > W - rightOffset - 8` |
| Too many signals in one cluster | Max 5 stack rows, then tolerate overlap |

## Tuning

```ts
// Smaller pills
const PILL_H = 14
const FONT = '600 9.5px ui-monospace, monospace'

// Move bands further away from candles
const TOP_BAND_Y = 24
const BOT_BAND_INSET = 24

// Stronger leader line
const SELL_LINE = 'rgba(255,122,133,0.7)'
ctx.lineWidth = 1.5
```

## Suggested Extensions

- **Hover popup** detail (price, time, % above SMA20). This needs either a
  main-pane handler (canvas-relative) or `chart.subscribeCrosshairMove`.
- **Time-cluster grouping**: if 3+ signals appear within 5 candles, group them
  into a single `cluster ×N` pill instead of 3 separate pills.
- **Ratio threshold**: raise it from `1.5×` to `2.0×` through a UI slider to
  reduce noise.
- **Persist OF threshold** in `ChartConfig`.
- **Color intensity by ratio**: `×5+` pills can be darker, `×1.5-2` lighter.

## Trade-offs vs `setMarkers`

| Aspect | `setMarkers` | Custom canvas overlay |
|--------|-------------|----------------------|
| Position | Sticks to wick | Gutter bands away from candles |
| Collision | Horizontal auto-stacking | Anti-collision vertical stacking |
| Leader line | None | Dotted line back to wick |
| Hover state | Built-in tooltip | Must be implemented manually |
| Snapshot | Not relevant to `takeScreenshot()` | NOT included in screenshot (because it is not a series) |
| Code complexity | 1 dòng | ~150 dòng module |

**Snapshot caveat**: because the OF canvas is a separate overlay and not a
`lightweight-charts` series, `chart.takeScreenshot()` does NOT capture it. If
the pills should appear in PNG output, they must be composited into the
snapshot. See how the VP overlay is composited in `snapshot.ts`; the same
pattern applies.
