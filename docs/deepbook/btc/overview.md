# Overview — BTC Chart Pro

## Mục tiêu

Một trang chart BTC/USDT nâng cao, render full-viewport, không phụ thuộc Sui wallet. Nguồn dữ liệu hoàn toàn từ Binance public API. Mọi cấu hình (vis flags, zoom, alerts) lưu vào `localStorage` và có thể export/import bằng JSON.

## File layout

```
btc-chart.html              # HTML entry — load lightweight-charts CDN
src/btc-chart/
  ├─ main.tsx               # Bootstrap React 19
  ├─ BtcChartPage.tsx       # Wrapper page + ShadowContainer
  └─ btc-chart.css          # Design tokens, page-level full-viewport layout
plugins/btc-chart/
  ├─ plugin.tsx             # Plugin entry — main React component
  ├─ style.css              # Shadow DOM scoped styles (.btc-chart__*)
  ├─ storage.ts             # Persist + import/export
  ├─ alerts.ts              # Engine + sound + browser notif
  ├─ volume-profile.ts      # Canvas VP renderer
  ├─ order-flow-overlay.ts  # Canvas OF pills overlay (gutter bands + leader lines)
  └─ snapshot.ts            # PNG export
```

## Render flow

```
btc-chart.html
  └─ <script type=module src=/src/btc-chart/main.tsx>
       └─ createRoot.render(<BtcChartPage />)
            └─ ShadowContainer (linkRef → /plugins/btc-chart/style.css)
                 └─ loadPlugin('/plugins/btc-chart/plugin.tsx')
                      └─ plugin.init(hostAPI) → register('BtcChart', BtcChartView)
                      └─ <BtcChartView />   // bên trong Shadow DOM
```

`ShadowContainer` (shared, ở `src/plugins/ShadowContainer.tsx`) attach một shadow root, inject `<link rel="stylesheet">` cho mỗi URL trong `styleUrls`, sau đó React `createPortal` các children vào mount point.

`BtcChartPage` thêm CSS rule riêng: `.btc-page > div { flex: 1; height: 100% }` để cascade kích thước xuống `<div>` mà ShadowContainer tạo (host element của shadow root). Đó là bước fix layout quan trọng nhất — nếu thiếu, footer + RSI + Volume bị đẩy ra ngoài viewport.

## Data flow

```
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
            – setAlerts([...])        (persist new triggeredAt)
  └─ if k.x (candle closed):
       └─ renderData(arr)             // recompute indicators
```

## State responsibilities

| Ref/State | Purpose |
|-----------|--------|
| `chartRefs` | 3 chart instances + 12 series từ lightweight-charts |
| `candlesRef` | Mảng kline thô, mutate in-place trên mỗi tick |
| `visRef`/`vis` | Indicator visibility flags (NWE, MA50, MA200, OF, VP, RSI, Vol) |
| `vpOptsRef`/`vpOpts` | Volume profile options (heatmap on/off) |
| `ofOverlayRef` | Latest OF signals (high/low/ratio) for the custom canvas overlay |
| `alertsRef`/`alerts` | Alert rules — ref để WS handler đọc fresh |
| `soundRef` | `AlertSound` instance (Web Audio Context lazy init) |
| `lastPriceRef` | Prev tick price cho cross detection |
| `sidebarRef`/`sidebar` | Indicator snapshot mới nhất (RSI, NWE bands) cho alert eval |
| `fitNextRef` | Cờ chỉ `fitContent()` 1 lần khi load interval mới |

## Layout heights (quan trọng)

Trước đây dùng `el.style.height = pixels` từ JS — sai khi `clientHeight` chưa kịp settle. Hiện tại 3 panes dùng **CSS flex ratio**:

```css
.btc-chart__main { flex: 7   1 0; min-height: 0; }
.btc-chart__rsi  { flex: 1.5 1 0; min-height: 0; }
.btc-chart__vol  { flex: 1.5 1 0; min-height: 0; }
```

JS không bao giờ set `style.height` — chỉ gọi `chart.applyOptions({ width, height })` từ giá trị `clientHeight` thật trong `ResizeObserver`. ResizeObserver observe cả 3 panes lẫn `__col` để mọi reflow đều trigger sync. Lần đầu được trigger thêm bằng `requestAnimationFrame(syncSize)` để chắc layout đã settle.

## Indicator stack (computed in `renderData`)

| Indicator | Function | Ghi chú |
|-----------|---------|---------|
| ATR(14) | `calcATR` | Dùng cho NWE deviation |
| Nadaraya-Watson | `calcNWE` | RQ kernel `h=8 α=8 mult=2.5` |
| SMA(50/200) | `calcSMA` | Golden/death cross |
| RSI(14) | `calcRSI` | Wilder smoothing |
| MACD(12,26,9) | `calcMACD` | EMA-based |
| Order flow | `buildOrderFlow` | Break NWE band + volume spike ≥1.5× SMA20. Render qua canvas overlay riêng (gutter bands, không dùng `setMarkers`) |
| Volume Profile | `volume-profile.ts` | 64 bins, POC + VA 70%, HVN ≥80% POC |
| ML signal | `mlSignal` | Weighted score 10 features → STRONG BUY..STRONG SELL |
