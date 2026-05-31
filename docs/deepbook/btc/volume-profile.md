# Volume Profile

Source: `plugins/btc-chart/volume-profile.ts`

## Concept

Volume Profile (TPO) chia khoảng giá `[minLow, maxHigh]` của các candles thành N bins, gom volume vào bin chứa close. Output:

| Term | Definition |
|------|-----------|
| **POC** | Point of Control — bin có volume cao nhất |
| **VAH/VAL** | Value Area High/Low — biên trên và dưới của vùng chứa 70% tổng volume quanh POC |
| **HVN** | High Volume Node — bins ≥ 80% volume POC (configurable qua `hvnRatio`) |
| **LVN** | Low Volume Node — bins có volume thấp (chưa highlight, có thể mở rộng) |

## API

```ts
drawVolumeProfile(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,         // dùng để lấy clientHeight
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

## Build profile

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

POC: argmax(total). VAH/VAL: expand 2-pointer từ POC, mỗi bước thêm bin volume cao hơn (lên hoặc xuống) đến khi `vaSum ≥ totalVol * 0.7`.

## Render layers

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

Code layer thứ tự (rendering):

1. **Heatmap strip** (5px bên trái), gradient theo intensity:
   - `t > 0.66` → amber
   - `0.33 < t ≤ 0.66` → mint
   - `t ≤ 0.33` → cool muted

2. **Value Area band** — fill amber alpha 0.05 từ VAL đến VAH.

3. **Buy/Sell bars** — sell bên trái (red), buy bên phải (green). Width = `(side / maxVol) * (W - 14)`. Color tăng đậm theo `isPOC > isHVN > isVA > else`.

4. **HVN dot** — vòng tròn 2px vàng bên phải gutter cho mỗi bin HVN.

5. **POC dashed line** — full width, amber dashed [4,3].

6. **POC label pill** — bo tròn 3px, fill amber 0.95, text đen.

7. **VAH / VAL minor labels** — text 9px ở left gutter.

## Tuning parameters

| Param | Default | Effect |
|-------|--------|-------|
| `bins` | 64 | Resolution dọc. Nhiều hơn → granular, ít hơn → smooth. |
| `width` | 220 | Width canvas. Cần đủ space cho POC pill + bars. |
| `heatmap` | `true` | Có toggle UI riêng. |
| `hvnRatio` | 0.8 | 0.7 → nhiều HVN, 0.9 → chỉ những vùng cực đậm. |

## Position trên main pane

Canvas `<canvas class="btc-chart__vp-canvas">` đặt position absolute, `top: 0; right: 64px`. Width 220px, height = `mainEl.clientHeight`. `pointer-events: none` để không chặn crosshair.

ResizeObserver re-render mỗi khi main pane đổi kích thước. Render cũng được trigger bởi `renderData()` khi candles update.

## Edge cases

| Case | Behavior |
|------|----------|
| `candles.length < 10` | Skip render, return `{ poc: '—', … }` |
| `visible: false` | Clear canvas, return empty info |
| `maxVol === 0` | Use 1 để tránh divide-by-zero, tất cả bars width 0 |
| Klines vừa load lần đầu | `mainEl.clientHeight` có thể 0 → ResizeObserver sẽ trigger lại sau frame đầu |

## Mở rộng đề xuất

- LVN markers (low volume nodes): bins ≤ `lvnRatio * maxVol` → tô outline màu mờ.
- Naked POC: POC từ session trước chưa được giá quay lại touch.
- Composite profile: gộp nhiều session thành một profile dài hạn.
- VPVR (Visible Range): clip candles theo visible range của time scale thay vì `LIMIT` cuối cùng.
