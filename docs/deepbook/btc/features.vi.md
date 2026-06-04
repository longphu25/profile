# Tính Năng

## 1. Biểu Đồ Nến Nhiều Khung Thời Gian

| Trường | Giá trị |
|-------|------|
| Symbol | `BTCUSDT` (Binance Spot) |
| Intervals | `1m / 5m / 15m / 1h / 4h / 1d` |
| Limit | 300 candles mỗi lần fetch |
| Engine | `lightweight-charts@4.2.0` (CDN) |
| Live | Binance kline WebSocket — append khi nến đóng, update trên mọi tick |

Khi đổi interval, plugin đóng WS hiện tại, refetch klines, khôi phục vùng zoom
đã lưu rồi mở WS mới. `fitContent()` chỉ chạy một lần ngay sau khi tải xong
(được chặn bởi `fitNextRef`). Sau đó người dùng tự pan/zoom và plugin không ghi
đè nữa.

## 2. Chồng Indicator

| Toggle | Indicator |
|--------|-----------|
| `NWE` | Nadaraya-Watson Envelope (mid + upper + lower) |
| `MA50` / `MA200` | Simple moving averages |
| `Order Flow` | Marker BUY/SELL khi giá phá vỡ NWE band kèm volume spike ≥ 1.5× SMA20 |
| `Vol Profile` | Canvas overlay bên phải main pane |
| `RSI` | Pane riêng dưới main pane, kèm các đường OB/OS (70/30) |
| `Volume` | Pane riêng dưới RSI, tô màu theo hướng bullish/bearish |

Tất cả toggle đều được lưu vào `localStorage`.

## 3. Volume Profile Nâng Cao

- 64 bins, value area 70%, POC + VAH/VAL.
- **Heatmap strip** (5px) ở bên trái mỗi hàng, gradient amber → mint theo mức
  cường độ (có toggle riêng).
- **HVN markers**: bins ≥ 80% volume của POC được nhấn mạnh và có chấm vàng ở
  bên phải.
- Rộng 220px, offset 64px khỏi price ladder để không đè lên scale.
- Sidebar hiển thị POC, VAH, VAL, vị trí giá hiện tại và số lượng HVN nodes.

Chi tiết: [`volume-profile.md`](volume-profile.md).

## 4. Cảnh Báo Giá (6 loại)

| Kind | Trigger |
|------|---------|
| `price-cross-up` | `prevPrice < target ≤ currentPrice` |
| `price-cross-down` | `prevPrice > target ≥ currentPrice` |
| `nwe-upper` | `currentPrice ≥ NWE upper` |
| `nwe-lower` | `currentPrice ≤ NWE lower` |
| `rsi-overbought` | `RSI ≥ threshold` (mặc định 70) |
| `rsi-oversold` | `RSI ≤ threshold` (mặc định 30) |

Mỗi rule có:
- Bật/tắt mà không cần xóa để giữ lịch sử.
- Reset trigger sau khi fire (nếu chưa bật `repeat`).
- Repeat mode: cooldown 60 giây giữa các lần fire.
- Delete (×).

Form thêm rule sẽ tự gợi ý threshold (RSI: 70/30, price: làm tròn giá hiện tại).

Chi tiết: [`alerts.md`](alerts.md).

## 5. Âm Thanh + Browser Notification

**Sound**: nút "Sound on/off" trên toolbar. Web Audio tạo ping hai tông
(A5 → E6, attack 10ms, decay 130/180ms). Lần bật đầu tiên phải là hành động do
người dùng kích hoạt để mở khóa `AudioContext` theo chính sách trình duyệt.

**Browser notification**: nút "Notif…" gọi `Notification.requestPermission()`.
Khi alert fire:

```ts
new Notification('BTC Chart Alert', {
  body: describeRule(rule) + ' — ' + message,
  tag: 'btc-chart-alert',
  silent: true,
})
```

`silent: true` vì plugin tự phát beep riêng. Volume control (slider 0..1) có
thể thêm sau; hiện tại volume cố định là `0.4`.

## 6. PNG Snapshot

Nút "PNG" trên toolbar:

1. Gọi `mainChart.takeScreenshot()`, `rsiChart.takeScreenshot()`,
   `volChart.takeScreenshot()`.
2. Ghép chúng lên một canvas chung có chiều cao bằng tổng ba pane.
3. Vẽ VP overlay canvas vào đúng vị trí trên main pane.
4. `out.toBlob('image/png')` → `URL.createObjectURL` → `<a download>` → click.

Chỉ các pane đang hiển thị mới được render (RSI/Vol có thể tắt). Tên file:
`btc-chart-{timestamp}.png`.

Chi tiết: [`snapshot.md`](snapshot.md).

## 7. Lưu Zoom + Cấu Hình

`localStorage` key: `btc-chart:config:v1`.

Schema:

```ts
{
  version: 1,
  interval: string,
  vis: VisFlags,
  zoom: { from, to } | null,
  alerts: AlertRule[],
  sound: { enabled, volume },
  notifications: boolean,
}
```

- Mỗi thay đổi state liên quan sẽ gọi `saveConfig()` (throttle 250ms).
- Zoom được theo dõi qua `subscribeVisibleLogicalRangeChange` của main chart.
- `flushConfig()` chạy trên `beforeunload` để không mất write đang chờ.

Chi tiết: [`storage.md`](storage.md).

## 8. Import / Export JSON

- **Export** → tải xuống `btc-chart-config.json`.
- **Import** → input file ẩn dưới một `<label>`, parse rồi merge với defaults,
  khôi phục zoom và áp dụng tất cả flags.
- Nếu parse lỗi, UI hiển thị toast đỏ kèm nút dismiss ×.

## 9. Live Market Widgets

- **24h ticker** (refresh 5s): giá, thay đổi, OHLCV, high, low, volume.
- **Funding rate** (refresh 30s): Binance Futures perpetual.
- **Fear & Greed** (refresh 60s): chỉ số alternative.me.
- **WS status** trên status bar: `Live / Idle / Closed / Error / Demo`.

Khi network fetch lỗi, plugin tự fallback sang dữ liệu mock
(200 candles random walk quanh $65k) để UI không bị vỡ.

## 10. Minimal Mode

Nút **"Min"** trên toolbar (đổi thành "Pro" khi đang ở minimal mode) lật toàn
bộ chrome của giao diện:

- Ẩn header, toolbar, sidebar, RSI pane, Volume pane, status bar và legend.
- Chuyển `__col` từ `flex-direction: column` sang `flex-direction: row`.
- Chuyển VP canvas từ overlay sang in-flow để không còn che price area.
- Vẽ OF overlay ở simple mode: chỉ còn triangle mint/coral (▲/▼) cạnh wick,
  không có pill, leader line hay ratio text.
- Hiện tiêu đề nhỏ `BTC/USDT — 1d` nổi ở góc trên bên trái.
- Hiện pill "Pro" nổi ở góc trên bên phải để thoát minimal mode.

State này được lưu trong `ChartConfig.minimal: boolean` và giữ nguyên giữa các
phiên.
