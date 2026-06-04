# Volume Profile

Source: `plugins/btc-chart/volume-profile.ts`

## Concept

Volume Profile (TPO) splits the candle price range `[minLow, maxHigh]` into N
bins and assigns volume into the bin containing the close. Output:

| Term | Definition |
|------|-----------|
| **POC** | Point of Control — the bin with the highest volume |
| **VAH/VAL** | Value Area High/Low — the upper and lower bounds of the zone containing 70% of total volume around POC |
| **HVN** | High Volume Node — bins ≥ 80% of POC volume (configurable via `hvnRatio`) |
| **LVN** | Low Volume Node — bins with low volume (not highlighted yet, but extensible) |

## API

```ts
drawVolumeProfile(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,         // used to read clientHeight
  candles: VPCandle[],
  visible: boolean,
  opts: {
    bins?: number              // default 64
    width?: number             // default 220
    heatmap?: boolean          // default true
    hvnRatio?: number          // default 0.8
  }
): VPInfo
```

`VPInfo`:
```ts
{
  poc: string    // formatted price
  vah: string
  val: string
  pos: string    // 'Above VAH' | 'Below VAL' | 'In Value Area' | '—'
  hvnCount: number
}
```

## Build Profile

```ts
const minP = Math.min(...candles.map(c => c.low))
const maxP = Math.max(...candles.map(c => c.high))
const step = (maxP - minP) / bins
const rows = Array.from({ length: bins }, () => ({ total: 0, buy: 0, sell: 0 }))

for (const c of candles) {
  const idx = Math.max(0, Math.min(bins - 1, Math.floor((c.close - minP) / step)))
  rows[idx].total += c.volume
  if (c.close >= c.open) rows[idx].buy += c.volume
  else                    rows[idx].sell += c.volume
}
```

POC is `argmax(total)`. VAH/VAL expands a two-pointer window out from POC, and
on each step adds whichever adjacent bin has higher volume (up or down) until
`vaSum ≥ totalVol * 0.7`.

## Render Layers

```
┌────────────────────────────────────┐
│ heatmap strip (5px) ← intensity   │
│ │█│ value-area band (amber 0.05)  │
│ │█│ ┌─ sell bar (red) ────────┐   │
│ │█│ │ sell: rgba(255,122,133) │   │
│ │█│ └────┬────────────────────┘   │
│ │█│      │ buy bar (green) ────┐  │
│ │█│      │ buy: rgba(52,216,…) │  │
│ │█│      └─────────────────────┘  │
│ ─ ─ ─ POC dashed line ─ ─ ─ ─ ─ ●│ ← HVN dot
│      ┌────POC label pill─┐        │
│      │ POC 67,400         │        │
│      └───────────────────┘        │
└────────────────────────────────────┘
   ↑ left gutter for VAH/VAL/POC labels
```

Rendering order:

1. **Heatmap strip** (5px on the left), gradient by intensity:
   - `t > 0.66` → amber
   - `0.33 < t ≤ 0.66` → mint
   - `t ≤ 0.33` → cool muted

2. **Value Area band** — amber fill alpha 0.05 from VAL to VAH.

3. **Buy/Sell bars** — sell on the left (red), buy on the right (green).
   Width = `(side / maxVol) * (W - 14)`. Color strength increases by
   `isPOC > isHVN > isVA > else`.

4. **HVN dot** — 2px yellow circle on the right side of the gutter for each HVN bin.

5. **POC dashed line** — full width, amber dashed [4,3].

6. **POC label pill** — 3px rounded corners, amber 0.95 fill, dark text.

7. **VAH / VAL minor labels** — 9px text in the left gutter.

## Tuning Parameters

| Param | Default | Effect |
|-------|--------|-------|
| `bins` | 64 | Vertical resolution. More = more granular, fewer = smoother. |
| `width` | 220 | Canvas width. Must leave enough space for the POC pill + bars. |
| `heatmap` | `true` | Có toggle UI riêng. |
| `hvnRatio` | 0.8 | 0.7 → more HVNs, 0.9 → only the strongest zones. |

## Position on the Main Pane

The `<canvas class="btc-chart__vp-canvas">` is absolutely positioned at
`top: 0; right: 64px`. Width is 220px, height = `mainEl.clientHeight`.
`pointer-events: none` so it does not block the crosshair.

`ResizeObserver` re-renders every time the main pane changes size. Rendering is
also triggered by `renderData()` whenever candles update.

## Edge Cases

| Case | Behavior |
|------|----------|
| `candles.length < 10` | Skip render, return `{ poc: '—', … }` |
| `visible: false` | Clear canvas, return empty info |
| `maxVol === 0` | Use 1 to avoid divide-by-zero, all bars become width 0 |
| Klines on first load | `mainEl.clientHeight` may be 0 → `ResizeObserver` will trigger again after the first frame |

## Suggested Extensions

- LVN markers (low volume nodes): bins ≤ `lvnRatio * maxVol` → faint outline.
- Naked POC: previous-session POC that price has not revisited.
- Composite profile: aggregate multiple sessions into a longer-horizon profile.
- VPVR (Visible Range): clip candles to the visible time-scale range instead of
  always using the last `LIMIT`.
