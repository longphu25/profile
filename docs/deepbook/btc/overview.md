# Overview — BTC Chart Pro

## Goal

An advanced BTC/USDT chart page that renders full-viewport and does not depend
on a Sui wallet. The data source is entirely Binance public APIs. All
configuration (visibility flags, zoom, alerts) is stored in `localStorage` and
can be exported/imported as JSON.

## File Layout

```
btc-chart.html              # HTML entry — loads lightweight-charts CDN
src/btc-chart/
  ├─ main.tsx               # React 19 bootstrap
  ├─ BtcChartPage.tsx       # Wrapper page + ShadowContainer
  └─ btc-chart.css          # Design tokens, page-level full-viewport layout
plugins/btc-chart/
  ├─ plugin.tsx             # Plugin entry — main React component
  ├─ style.css              # Shadow DOM scoped styles (.btc-chart__*)
  ├─ storage.ts             # Persistence + import/export
  ├─ alerts.ts              # Engine + sound + browser notifications
  ├─ volume-profile.ts      # Canvas VP renderer
  ├─ order-flow-overlay.ts  # Canvas OF pill overlay (gutter bands + leader lines)
  └─ snapshot.ts            # PNG export
```

## Render Flow

```
btc-chart.html
  └─ <script type=module src=/src/btc-chart/main.tsx>
       └─ createRoot.render(<BtcChartPage />)
            └─ ShadowContainer (linkRef → /plugins/btc-chart/style.css)
                 └─ loadPlugin('/plugins/btc-chart/plugin.tsx')
                      └─ plugin.init(hostAPI) → register('BtcChart', BtcChartView)
                      └─ <BtcChartView />   // inside Shadow DOM
```

`ShadowContainer` (shared, in `src/plugins/ShadowContainer.tsx`) attaches a
shadow root, injects `<link rel="stylesheet">` for each URL in `styleUrls`,
then uses React `createPortal` to mount children into the shadow-root mount
point.

`BtcChartPage` adds a dedicated CSS rule:
`.btc-page > div { flex: 1; height: 100% }` so sizing cascades into the `<div>`
created by `ShadowContainer` (the host element for the shadow root). This is
the most important layout fix. Without it, the footer plus RSI and Volume panes
get pushed outside the viewport.

## Data Flow

```
[interval change] / [first mount]
  └─ fetch /api/v3/klines  (300 candles)
       └─ candlesRef.current = parsed
       └─ renderData(cands)            // computes NWE, MA, RSI, MACD, OF, ML, VP
       └─ restore zoom (if saved)
       └─ open WS stream

[WebSocket message] (live tick)
  └─ append/update last candle
  └─ candleSeries.update + volSeries.update
  └─ evaluateAlerts(rules, ctx)        // runs on every tick
       └─ if fired:
            – soundRef.play()         (Web Audio)
            – pushNotification()      (Notification API)
            – setFiredToast()         (in-app)
            – setAlerts([...])        (persists new triggeredAt)
  └─ if k.x (candle closed):
       └─ renderData(arr)             // recomputes indicators
```

## State Responsibilities

| Ref/State | Purpose |
|-----------|--------|
| `chartRefs` | 3 chart instances + 12 series from lightweight-charts |
| `candlesRef` | Raw kline array, mutated in place on every tick |
| `visRef`/`vis` | Indicator visibility flags (NWE, MA50, MA200, OF, VP, RSI, Vol) |
| `vpOptsRef`/`vpOpts` | Volume profile options (heatmap on/off) |
| `ofOverlayRef` | Latest OF signals (high/low/ratio) for the custom canvas overlay |
| `alertsRef`/`alerts` | Alert rules — ref so the WS handler always reads fresh state |
| `soundRef` | `AlertSound` instance (Web Audio Context lazy init) |
| `lastPriceRef` | Previous tick price for cross detection |
| `sidebarRef`/`sidebar` | Latest indicator snapshot (RSI, NWE bands) for alert evaluation |
| `fitNextRef` | Flag that allows `fitContent()` only once when a new interval loads |

## Layout Heights (Important)

The previous approach used `el.style.height = pixels` from JS, which fails when
`clientHeight` has not settled yet. The current implementation uses **CSS flex
ratios** for the three panes:

```css
.btc-chart__main { flex: 7   1 0; min-height: 0; }
.btc-chart__rsi  { flex: 1.5 1 0; min-height: 0; }
.btc-chart__vol  { flex: 1.5 1 0; min-height: 0; }
```

JS never sets `style.height`. It only calls
`chart.applyOptions({ width, height })` using the real `clientHeight` from
`ResizeObserver`. The observer watches all three panes and `__col` so every
reflow triggers a sync. The first sync is also forced with
`requestAnimationFrame(syncSize)` to ensure layout has settled.

## Indicator Stack (Computed in `renderData`)

| Indicator | Function | Notes |
|-----------|---------|---------|
| ATR(14) | `calcATR` | Used for NWE deviation |
| Nadaraya-Watson | `calcNWE` | RQ kernel `h=8 α=8 mult=2.5` |
| SMA(50/200) | `calcSMA` | Golden/death cross |
| RSI(14) | `calcRSI` | Wilder smoothing |
| MACD(12,26,9) | `calcMACD` | EMA-based |
| Order flow | `buildOrderFlow` | Breaks NWE band + volume spike ≥1.5× SMA20. Rendered through a custom canvas overlay (gutter bands, not `setMarkers`) |
| Volume Profile | `volume-profile.ts` | 64 bins, POC + VA 70%, HVN ≥80% POC |
| ML signal | `mlSignal` | Weighted score 10 features → STRONG BUY..STRONG SELL |
