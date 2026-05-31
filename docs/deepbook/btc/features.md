# Features

## 1. Multi-timeframe candlestick chart

| Field | Value |
|-------|------|
| Symbol | `BTCUSDT` (Binance Spot) |
| Intervals | `1m / 5m / 15m / 1h / 4h / 1d` |
| Limit | 300 candles per fetch |
| Engine | `lightweight-charts@4.2.0` (CDN) |
| Live | Binance kline WebSocket — append on close, update on every tick |

Khi đổi interval, plugin huỷ WS hiện tại, refetch klines, restore zoom đã lưu, mở WS mới. `fitContent()` chỉ chạy một lần ngay sau load (cờ `fitNextRef`) — sau đó user tự pan/zoom, plugin không clobber.

## 2. Indicator stack

| Toggle | Indicator |
|--------|-----------|
| `NWE` | Nadaraya-Watson Envelope (mid + upper + lower) |
| `MA50` / `MA200` | Simple moving averages |
| `Order Flow` | Markers BUY/SELL khi giá break NWE band kèm volume spike ≥ 1.5× SMA20 |
| `Vol Profile` | Canvas overlay bên phải main pane |
| `RSI` | Pane riêng dưới main, kèm OB/OS lines (70/30) |
| `Volume` | Pane riêng dưới RSI, color theo bullish/bearish |

Tất cả toggles persist vào `localStorage`.

## 3. Volume Profile nâng cao

- 64 bins, value area 70%, POC + VAH/VAL.
- **Heatmap strip** (5px) bên trái mỗi row, gradient amber → mint theo intensity (toggle riêng).
- **HVN markers**: bins ≥ 80% volume POC được tô đậm và có dot vàng phía bên phải.
- Width 220px, offset 64px khỏi price ladder để không đè lên scale.
- Sidebar hiển thị POC, VAH, VAL, vị trí giá hiện tại, số HVN nodes.

Chi tiết: [`volume-profile.md`](volume-profile.md).

## 4. Cảnh báo giá (6 loại)

| Kind | Trigger |
|------|---------|
| `price-cross-up` | `prevPrice < target ≤ currentPrice` |
| `price-cross-down` | `prevPrice > target ≥ currentPrice` |
| `nwe-upper` | `currentPrice ≥ NWE upper` |
| `nwe-lower` | `currentPrice ≤ NWE lower` |
| `rsi-overbought` | `RSI ≥ threshold` (default 70) |
| `rsi-oversold` | `RSI ≤ threshold` (default 30) |

Mỗi rule có:
- Toggle on/off (không xoá để giữ history).
- Reset trigger sau khi fire (nếu không bật `repeat`).
- Repeat mode: 60s cooldown giữa các fire.
- Delete (×).

UI form thêm rule auto-suggest threshold (RSI: 70/30, price: round current).

Chi tiết: [`alerts.md`](alerts.md).

## 5. Sound + Browser Notification

**Sound**: nút "Sound on/off" toolbar. Web Audio 2-tone ping (A5 → E6, attack 10ms, decay 130/180ms). Lần bật đầu tiên user gesture mới unlock AudioContext (browser policy).

**Browser notification**: nút "Notif…" → `Notification.requestPermission()`. Khi alert fire:

```ts
new Notification('BTC Chart Alert', {
  body: describeRule(rule) + ' — ' + message,
  tag: 'btc-chart-alert',
  silent: true,   // plugin tự phát beep, không chồng âm
})
```

Volume control (slider 0..1) có thể thêm dễ dàng — hiện tại fix volume = 0.4.

## 6. PNG snapshot

Nút "PNG" trên toolbar:

1. Gọi `mainChart.takeScreenshot()`, `rsiChart.takeScreenshot()`, `volChart.takeScreenshot()` (mỗi cái trả về `HTMLCanvasElement`).
2. Compose lên một canvas chung với chiều cao = sum 3 panes.
3. Vẽ overlay VP canvas lên đúng vị trí trên main pane.
4. `out.toBlob('image/png')` → `URL.createObjectURL` → `<a download>` → click.

Chỉ render panes đang visible (RSI/Vol có thể tắt). File: `btc-chart-{timestamp}.png`.

Chi tiết: [`snapshot.md`](snapshot.md).

## 7. Lưu zoom + cấu hình

`localStorage` key: `btc-chart:config:v1`.

Schema:
```ts
{
  version: 1,
  interval: string,         // '1h', '4h', etc.
  vis: VisFlags,            // 7 bool flags
  zoom: { from, to } | null,
  alerts: AlertRule[],
  sound: { enabled, volume },
  notifications: boolean,
}
```

- Mỗi thay đổi state trigger `saveConfig()` (throttled 250ms).
- Zoom tracked qua `subscribeVisibleLogicalRangeChange` của main chart.
- `flushConfig()` chạy trên `beforeunload` để không mất dữ liệu pending.

Chi tiết: [`storage.md`](storage.md).

## 8. Import / Export JSON

- **Export** → tải `btc-chart-config.json` (cùng schema localStorage).
- **Import** → `<input type="file" accept=".json">` ẩn dưới `<label>`. Parse, merge vào defaults, restore zoom, apply tất cả flags.
- Lỗi parse hiện toast đỏ, dismiss ×.

## 9. Live market widgets

- **24h ticker** (refresh 5s): price, change, OHLCV, high, low, volume.
- **Funding rate** (refresh 30s): Binance Futures perp.
- **Fear & Greed** (refresh 60s): alternative.me index.
- **WS status** trong status bar: `Live / Idle / Closed / Error / Demo`.

Khi network fetch fail, plugin tự fallback dữ liệu mock (200 candles random walk quanh $65k) để UI không vỡ.
