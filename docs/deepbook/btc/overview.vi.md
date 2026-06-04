# Tổng Quan — BTC Chart Pro

## Mục Tiêu

Một trang chart BTC/USDT nâng cao, render full-viewport và không phụ thuộc vào
Sui wallet. Nguồn dữ liệu hoàn toàn là Binance public API. Mọi cấu hình
(visibility flags, zoom, alerts) được lưu trong `localStorage` và có thể
export/import bằng JSON.

## Bố Cục File

```text
btc-chart.html              # HTML entry — nạp lightweight-charts từ CDN
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

## Luồng Render

```text
btc-chart.html
  └─ <script type=module src=/src/btc-chart/main.tsx>
       └─ createRoot.render(<BtcChartPage />)
            └─ ShadowContainer (linkRef → /plugins/btc-chart/style.css)
                 └─ loadPlugin('/plugins/btc-chart/plugin.tsx')
                      └─ plugin.init(hostAPI) → register('BtcChart', BtcChartView)
                      └─ <BtcChartView />   // bên trong Shadow DOM
```

`ShadowContainer` (shared, trong `src/plugins/ShadowContainer.tsx`) gắn một
shadow root, inject `<link rel="stylesheet">` cho từng URL trong `styleUrls`,
rồi dùng React `createPortal` để mount children vào mount point của shadow root.

`BtcChartPage` thêm CSS rule riêng:
`.btc-page > div { flex: 1; height: 100% }` để kích thước truyền xuống `<div>`
do `ShadowContainer` tạo ra (host element của shadow root). Đây là bản sửa
layout quan trọng nhất; nếu thiếu, footer cùng các pane RSI và Volume sẽ bị đẩy
ra ngoài viewport.

## Luồng Dữ Liệu

```text
[interval change] / [first mount]
  └─ fetch /api/v3/klines  (300 candles)
       └─ candlesRef.current = parsed
       └─ renderData(cands)            // tính NWE, MA, RSI, MACD, OF, ML, VP
       └─ restore zoom (if saved)
       └─ open WS stream

[WebSocket message] (live tick)
  └─ append/update last candle
  └─ candleSeries.update + volSeries.update
  └─ evaluateAlerts(rules, ctx)        // chạy mỗi tick
       └─ if fired:
            – soundRef.play()         (Web Audio)
            – pushNotification()      (Notification API)
            – setFiredToast()         (in-app)
            – setAlerts([...])        (lưu triggeredAt mới)
  └─ if k.x (candle closed):
       └─ renderData(arr)             // tính lại indicator
```

## Trách Nhiệm State

| Ref/State | Mục đích |
|-----------|--------|
| `chartRefs` | 3 chart instance + 12 series từ lightweight-charts |
| `candlesRef` | Mảng kline thô, mutate tại chỗ trên mỗi tick |
| `visRef`/`vis` | Cờ hiển thị indicator (NWE, MA50, MA200, OF, VP, RSI, Vol) |
| `vpOptsRef`/`vpOpts` | Tùy chọn volume profile (bật/tắt heatmap) |
| `ofOverlayRef` | OF signal mới nhất (high/low/ratio) cho canvas overlay tùy biến |
| `alertsRef`/`alerts` | Alert rules — ref để WS handler luôn đọc được state mới nhất |
| `soundRef` | Instance `AlertSound` (Web Audio Context lazy init) |
| `lastPriceRef` | Giá tick trước đó cho cross detection |
| `sidebarRef`/`sidebar` | Snapshot indicator mới nhất (RSI, NWE bands) cho alert evaluation |
| `fitNextRef` | Cờ cho phép `fitContent()` đúng một lần khi interval mới được nạp |

## Chiều Cao Layout (Quan Trọng)

Trước đây code dùng `el.style.height = pixels` từ JS, nhưng cách đó sai khi
`clientHeight` chưa ổn định. Hiện tại ba pane dùng **CSS flex ratio**:

```css
.btc-chart__main { flex: 7   1 0; min-height: 0; }
.btc-chart__rsi  { flex: 1.5 1 0; min-height: 0; }
.btc-chart__vol  { flex: 1.5 1 0; min-height: 0; }
```

JS không bao giờ set `style.height`; nó chỉ gọi
`chart.applyOptions({ width, height })` từ `clientHeight` thực lấy ra bởi
`ResizeObserver`. Observer theo dõi cả ba pane và `__col` để mọi reflow đều
trigger sync. Lần sync đầu còn được ép thêm bằng
`requestAnimationFrame(syncSize)` để đảm bảo layout đã settle.

## Chồng Indicator (Tính Trong `renderData`)

| Indicator | Hàm | Ghi chú |
|-----------|---------|---------|
| ATR(14) | `calcATR` | Dùng cho NWE deviation |
| Nadaraya-Watson | `calcNWE` | RQ kernel `h=8 α=8 mult=2.5` |
| SMA(50/200) | `calcSMA` | Golden/death cross |
| RSI(14) | `calcRSI` | Wilder smoothing |
| MACD(12,26,9) | `calcMACD` | Dựa trên EMA |
| Order flow | `buildOrderFlow` | Phá vỡ NWE band + volume spike ≥1.5× SMA20. Render qua canvas overlay riêng, không dùng `setMarkers` |
| Volume Profile | `volume-profile.ts` | 64 bins, POC + VA 70%, HVN ≥80% POC |
| ML signal | `mlSignal` | Weighted score 10 features → STRONG BUY..STRONG SELL |
