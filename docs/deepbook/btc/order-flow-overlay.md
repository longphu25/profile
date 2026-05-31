# Order Flow Overlay

Source: `plugins/btc-chart/order-flow-overlay.ts`

## Vì sao tự render

`lightweight-charts` cung cấp `series.setMarkers()` với `position: 'aboveBar' | 'belowBar'`. Khi nhiều markers gần nhau (zoom out), chúng đè lên wick + label nhỏ khó đọc → **gutter band overlay** giải quyết:

- SELL pills → dải trên cùng main pane (xa khỏi candles).
- BUY pills → dải dưới cùng main pane.
- Mỗi pill có **leader line** dotted nối về wick để giữ liên kết visual.
- Stacking khi pills cùng band collide ngang → push xuống/lên row tiếp theo.

## API

```ts
drawOrderFlow(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,        // dùng để lấy clientWidth/Height
  chart: { timeScale: () => { timeToCoordinate(t) } },
  series: { priceToCoordinate(p) },
  signals: OFOverlaySignal[],
  visible: boolean,
  rightOffset?: number,        // default 64 (chừa price ladder)
): void
```

`OFOverlaySignal`:
```ts
{
  time: number       // unix seconds
  type: 'buy' | 'sell'
  ratio: string      // formatted volume ratio, e.g. '2.5'
  high: number       // candle high (anchor leader line cho sell)
  low: number        // candle low  (anchor leader line cho buy)
}
```

## Render passes

1. **Measure + place** — convert mỗi `time` qua `chart.timeScale().timeToCoordinate(t)`, skip nếu null hoặc nằm ngoài viewport. Convert anchor price (high cho sell, low cho buy) qua `series.priceToCoordinate()`.

2. **Anti-collision** — mỗi band có rows. Pill mới check overlap ngang với existing pills, nếu collide thì stack xuống (sell) hoặc lên (buy) row tiếp theo. Tối đa 5 rows trước khi accept overlap.

3. **Leader lines** — vẽ trước (z-index thấp): dotted `[2, 3]`, `lineWidth: 1`, từ rìa pill về wick (`high - 3` cho sell, `low + 3` cho buy), color theo type (alpha 0.45).

4. **Pills + arrows** — vẽ sau (z-index cao):
   - Pill: `roundRect` r=9, fill `#ff7a85` cho sell / `#34d8a4` cho buy alpha 0.95.
   - Arrow `▲` / `▼` 9px text màu `#071011` (đen) ở cạnh trái pill.
   - Ratio text `×N.N` 10.5px mono kế bên arrow.

## Gutter positioning

```ts
const TOP_BAND_Y = 16             // SELL band y-center từ top
const BOT_BAND_INSET = 16         // BUY band y-center = H - 16
const PILL_H = 18
const STACK_GAP = 6               // min horizontal gap trước khi stack
```

Stack direction:
- Sell stack xuống (`y = bandStart + row * (PILL_H + 4)`).
- Buy stack lên (`y = bandStart - row * (PILL_H + 4)`).

## Wire-up trong plugin

```ts
// State
const ofCanvasRef = useRef<HTMLCanvasElement>(null)
const ofOverlayRef = useRef<OFOverlaySignal[]>([])

// Trong renderData(): không setMarkers nữa
ofOverlayRef.current = of_.overlay
drawOrderFlow(
  ofCanvasRef.current,
  mainElRef.current,
  refs.mainChart,
  refs.candleSeries,
  v.of ? of_.overlay : [],
  true,
)

// Trong syncSize() (ResizeObserver): redraw để pills follow size mới
drawOrderFlow(...)

// Trong subscribeVisibleLogicalRangeChange (pan/zoom): redraw để pills follow x
drawOrderFlow(...)
```

Canvas `<canvas class="btc-chart__of-canvas">` đặt:
```css
position: absolute;
top: 0; left: 0;
pointer-events: none;
z-index: 5;       /* trên VP overlay (z=4), không chặn crosshair */
```

`drawOrderFlow` set `canvas.width / .height = mainEl.clientWidth / .clientHeight`, nên canvas luôn match main pane. Khi RSI/Vol panes resize, ResizeObserver trigger sync → main pane height đổi → canvas backing store cập nhật.

## Edge cases

| Case | Behavior |
|------|----------|
| `visible: false` | Clear canvas, return — vẫn keep `ofOverlayRef` để bật lại tức thì |
| `signals.length === 0` | Clear canvas |
| Time ngoài viewport | Skip (timeToCoordinate vẫn trả null/out-of-range) |
| Time gần price ladder | Skip nếu `x > W - rightOffset - 8` |
| Quá nhiều signals cùng cluster | Tối đa 5 stack rows, sau đó tolerate overlap |

## Tuning

```ts
// Pills nhỏ hơn
const PILL_H = 14
const FONT = '600 9.5px ui-monospace, monospace'

// Bands xa khỏi candles hơn
const TOP_BAND_Y = 24
const BOT_BAND_INSET = 24

// Leader line đậm hơn
const SELL_LINE = 'rgba(255,122,133,0.7)'
ctx.lineWidth = 1.5
```

## Mở rộng đề xuất

- **Hover popup** detail (price, time, %above SMA20). Cần handler trong main pane (canvas-relative) hoặc dùng `chart.subscribeCrosshairMove`.
- **Time-cluster grouping**: nếu 3+ signals trong 5 candles, gộp thành "cluster ×N" thay vì 3 pills.
- **Ratio threshold**: nâng từ `1.5×` lên `2.0×` qua UI slider để giảm noise.
- **Persist OF threshold** vào `ChartConfig`.
- **Color intensity by ratio**: pills `×5+` đậm hơn, `×1.5-2` mờ hơn.

## Trade-offs với `setMarkers`

| Aspect | `setMarkers` | Custom canvas overlay |
|--------|-------------|----------------------|
| Position | Bám wick | Gutter bands xa candle |
| Collision | Tự stack ngang | Anti-collide vertical stacking |
| Leader line | Không có | Dotted line tới wick |
| Hover state | Built-in tooltip | Phải tự implement |
| Snapshot | Không có trong `takeScreenshot()` | KHÔNG nằm trong screenshot (vì không phải series) |
| Code complexity | 1 dòng | ~150 dòng module |

**Snapshot caveat**: vì OF canvas là overlay riêng (không phải lightweight-charts series), `chart.takeScreenshot()` KHÔNG capture nó. Nếu muốn pills xuất hiện trong PNG, cần composite vào snapshot — tham khảo cách VP overlay được composite trong `snapshot.ts` (cùng pattern).
