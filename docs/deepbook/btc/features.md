# Features

## 1. Multi-timeframe Candlestick Chart

| Field | Value |
|-------|------|
| Symbol | `BTCUSDT` (Binance Spot) |
| Intervals | `1m / 5m / 15m / 1h / 4h / 1d` |
| Limit | 300 candles per fetch |
| Engine | `lightweight-charts@4.2.0` (CDN) |
| Live | Binance kline WebSocket — append on close, update on every tick |

When the interval changes, the plugin closes the current WS connection,
refetches klines, restores the saved zoom range, then opens a new WS stream.
`fitContent()` runs only once immediately after load (guarded by
`fitNextRef`). After that, the user owns pan/zoom and the plugin does not
override it.

## 2. Indicator Stack

| Toggle | Indicator |
|--------|-----------|
| `NWE` | Nadaraya-Watson Envelope (mid + upper + lower) |
| `MA50` / `MA200` | Simple moving averages |
| `Order Flow` | BUY/SELL markers when price breaks the NWE band with a volume spike ≥ 1.5× SMA20 |
| `Vol Profile` | Canvas overlay on the right side of the main pane |
| `RSI` | Dedicated pane below the main pane, with OB/OS lines (70/30) |
| `Volume` | Dedicated pane below RSI, colored by bullish/bearish direction |

All toggles persist into `localStorage`.

## 3. Advanced Volume Profile

- 64 bins, value area 70%, POC + VAH/VAL.
- **Heatmap strip** (5px) on the left of each row, amber → mint gradient by intensity (separate toggle).
- **HVN markers**: bins ≥ 80% of POC volume are emphasized and get a yellow dot on the right.
- Width 220px, offset 64px from the price ladder so it does not overlap the scale.
- The sidebar shows POC, VAH, VAL, current price location, and the number of HVN nodes.

Chi tiết: [`volume-profile.md`](volume-profile.md).

## 4. Price Alerts (6 kinds)

| Kind | Trigger |
|------|---------|
| `price-cross-up` | `prevPrice < target ≤ currentPrice` |
| `price-cross-down` | `prevPrice > target ≥ currentPrice` |
| `nwe-upper` | `currentPrice ≥ NWE upper` |
| `nwe-lower` | `currentPrice ≤ NWE lower` |
| `rsi-overbought` | `RSI ≥ threshold` (default 70) |
| `rsi-oversold` | `RSI ≤ threshold` (default 30) |

Each rule has:
- On/off toggle (do not delete it just to preserve history).
- Reset trigger after firing (if `repeat` is not enabled).
- Repeat mode: 60s cooldown between firings.
- Delete (×).

The add-rule form auto-suggests thresholds (RSI: 70/30, price: rounded current price).

Chi tiết: [`alerts.md`](alerts.md).

## 5. Sound + Browser Notifications

**Sound**: "Sound on/off" toolbar button. Web Audio two-tone ping
(A5 → E6, attack 10ms, decay 130/180ms). The first enable action must come
from a user gesture to unlock `AudioContext` (browser policy).

**Browser notification**: nút "Notif…" → `Notification.requestPermission()`. Khi alert fire:

```ts
new Notification('BTC Chart Alert', {
  body: describeRule(rule) + ' — ' + message,
  tag: 'btc-chart-alert',
  silent: true,   // the plugin plays its own beep, avoid doubled sound
})
```

Volume control (slider 0..1) can be added easily; the current implementation
uses a fixed volume of `0.4`.

## 6. PNG Snapshot

Nút "PNG" trên toolbar:

1. Gọi `mainChart.takeScreenshot()`, `rsiChart.takeScreenshot()`, `volChart.takeScreenshot()` (mỗi cái trả về `HTMLCanvasElement`).
2. Compose lên một canvas chung với chiều cao = sum 3 panes.
3. Draw the VP overlay canvas in the correct position on the main pane.
4. `out.toBlob('image/png')` → `URL.createObjectURL` → `<a download>` → click.

Only visible panes are rendered (RSI/Vol can be turned off). Filename:
`btc-chart-{timestamp}.png`.

Chi tiết: [`snapshot.md`](snapshot.md).

## 7. Persisting Zoom + Config

`localStorage` key: `btc-chart:config:v1`.

Schema:
```ts
{
  version: 1,
  interval: string,         // '1h', '4h', etc.
  vis: VisFlags,            // 7 boolean flags
  zoom: { from, to } | null,
  alerts: AlertRule[],
  sound: { enabled, volume },
  notifications: boolean,
}
```

- Every relevant state change triggers `saveConfig()` (throttled to 250ms).
- Zoom is tracked through `subscribeVisibleLogicalRangeChange` on the main chart.
- `flushConfig()` runs on `beforeunload` so pending writes are not lost.

Chi tiết: [`storage.md`](storage.md).

## 8. JSON Import / Export

- **Export** → tải `btc-chart-config.json` (cùng schema localStorage).
- **Import** → hidden `<input type="file" accept=".json">` under a `<label>`.
  Parse, merge with defaults, restore zoom, apply all flags.
- Parse errors show a red toast with dismiss ×.

## 9. Live Market Widgets

- **24h ticker** (refresh every 5s): price, change, OHLCV, high, low, volume.
- **Funding rate** (refresh every 30s): Binance Futures perpetual.
- **Fear & Greed** (refresh every 60s): alternative.me index.
- **WS status** in the status bar: `Live / Idle / Closed / Error / Demo`.

When network fetch fails, the plugin falls back to mock data
(200 candles of random walk around $65k) so the UI does not break.


## 10. Minimal Mode

The toolbar **"Min"** button (switches to "Pro" when already minimal) flips the
entire chrome:

- Hides the header, toolbar, sidebar, RSI pane, Volume pane, status bar, and legend.
- Switches `__col` from `flex-direction: column` (3 stacked panes) to
  `flex-direction: row` (chart + VP side by side).
- Moves the VP canvas from overlay mode
  (`position: absolute; right: 64px; width: 220px`) to in-flow mode
  (`position: static; flex: 0 0 140px`), so it no longer covers the price area.
- Draws the OF overlay in simple mode: only mint/coral triangles (▲/▼) near the wick,
  with no pill, no leader line, and no ratio text. This minimizes noise.
- Shows a small floating `BTC/USDT — 1d` title in the top-left corner.
- Shows a floating "Pro" pill in the top-right corner to exit minimal mode.

Persists in `ChartConfig.minimal: boolean`. State is preserved across sessions.

```ts
// Toolbar toggle
<button onClick={() => setMinimal((m) => !m)}>
  {minimal ? 'Pro' : 'Min'}
</button>
```

When toggled, the plugin calls
`requestAnimationFrame(() => renderData(candlesRef.current))` so the chart
redraws after CSS reflow finishes (chart libraries need
`applyOptions({ width, height })` again).
