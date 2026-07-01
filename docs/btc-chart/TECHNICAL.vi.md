# BTC Chart Plugin - Tài Liệu Kỹ Thuật

## Tổng Quan

Plugin biểu đồ tiền điện tử chuyên nghiệp, hỗ trợ nhiều sàn giao dịch, phân tích kỹ thuật nâng cao, và tích hợp 2 hệ thống giao dịch độc quyền để tạo tín hiệu.

## Kiến Trúc

```
plugins/btc-chart/
├── plugin.tsx              # Entry, React root, chart + WebSocket
├── style.css              # CSS trong Shadow DOM
├── storage.ts             # Lưu cấu hình vào localStorage
├── alerts.ts              # Cảnh báo giá/RSI + thông báo
├── snapshot.ts            # Xuất ảnh chart
├── volume-profile.ts      # Volume Profile overlay
├── order-flow-overlay.ts  # Order Flow canvas
├── smc.ts / smc-wasm.ts   # Smart Money Concepts (WASM)
├── box-flip.ts            # Box Flip signal
├── wasm/                  # Rust → WASM (compute_smc, compute_nwe). Xem wasm.vi.md
├── components/
│   ├── ChartHeader.tsx       # Chọn symbol, khung thời gian, giá
│   ├── IndicatorToolbar.tsx  # Nút bật/tắt các overlay
│   ├── SignalPanel.tsx       # Gauge tín hiệu ML
│   ├── SignalConfigPanel.tsx # Chọn chỉ báo + preset
│   ├── TradeSetupPanel.tsx   # Entry/SL/TP (thu gọn) + nút "?" giải thích
│   ├── ExplainModal.tsx      # Popup "Vì sao có Trade Setup này?" + từ điển chỉ báo
│   ├── SessionsPanel.tsx     # ICT phiên / Judas / ADR (thu gọn)
│   ├── LiquidityPanel.tsx    # ICT liquidity: range, BSL/SSL, sweep (thu gọn)
│   ├── ScalpingPanel.tsx     # Boucher M1 (có thể thu gọn)
│   ├── ReversalPanel.tsx     # Kathy Lien DBB (có thể thu gọn)
│   ├── PositionsPanel.tsx    # Theo dõi vị thế
│   ├── AlertsPanel.tsx       # Quản lý cảnh báo
│   ├── MarketPanels.tsx      # Funding, Stats, Fear&Greed
│   ├── IndicatorReadouts.tsx # OF, BoxFlip, MHBand, VP
│   ├── TechnicalsPanel.tsx   # Tổng hợp tín hiệu kỹ thuật
│   ├── VolumeSpikePanel.tsx  # Cấu hình vol spike
│   └── OIPanel.tsx           # Open Interest + Market Cap
├── hooks/
│   ├── useMarketData.ts   # Ticker, Funding, F&G, Klines (+ HTF), OI
│   ├── usePositions.ts    # CRUD vị thế + price lines
│   └── useOI.ts           # Tổng hợp Open Interest
└── lib/
    ├── types.ts           # Các kiểu dữ liệu
    ├── constants.ts       # Bảng màu, khung thời gian
    ├── symbols.ts         # Danh sách symbol đa sàn
    ├── format.ts          # Định dạng giá/volume
    ├── indicators.ts      # Toán học: MHBand, SMA, RSI, MACD, ADX...
    ├── nadaraya-watson.ts # LuxAlgo NWE (fallback JS cho compute_nwe WASM)
    ├── ml.ts              # ML signal (weighted ensemble)
    ├── trade-setup.ts     # Tính Entry/SL/TP tự động (engine confluence)
    ├── explain.ts         # Map reason → giải thích + từ điển chỉ báo
    ├── signal-config.ts   # Cấu hình chỉ báo + preset
    ├── boucher-scalping.ts # Hệ thống Boucher M1
    ├── lien-reversal.ts   # Hệ thống Kathy Lien DBB
    ├── ict-sessions.ts    # ICT phiên (Á/Âu/Mỹ) + Judas Swing
    ├── liquidity.ts       # ICT liquidity hacks: range, ext/int, IFVG, sweep
    ├── overlays.ts        # Vẽ SMC + BoxFlip + ICT + Liquidity
    ├── positions.ts       # Tính PnL, gợi ý SL/TP
    └── api.ts             # Gọi REST API
```

## Luồng Dữ Liệu

```
REST API (lịch sử nến) → React Query → candlesRef → renderData()
                                                          │
WebSocket (tick real-time) ──────────────────────────→ Cập nhật nến + chart
                                                          │
                                                    Tính tất cả chỉ báo
                                                    (+ SMC/NWE qua WASM,
                                                     ICT Sessions, ICT Liquidity)
                                                          │
                                                    ML Signal → Trade Setup
                                                          │
                                                    setState → Sidebar
```

## Đa Khung Thời Gian (HTF)

Feature ICT Liquidity neo trading range trên **khung cao hơn** khung đang xem.
Một lệnh `useKlines(symbol, htfInterval, info)` thứ hai fetch nến HTF; React Query
cache riêng (key theo interval). `HTF_MAP` (trong `lib/liquidity.ts`) map lên một
bậc: `1m→15m, 5m→1h, 15m→1h, 1h→4h, 4h→1d, 1d→(không)`.

Nến HTF đi vào `renderData` qua `htfRef` (mirror-ref, vì `renderData` có deps
rỗng). **WASM không dính đến logic đa khung** — nó timeframe-agnostic, chỉ tính
trên mảng nến được đưa vào. Chi tiết ở [`wasm.vi.md`](./wasm.vi.md).

## Tầng Tính Toán WASM

Hai phép tính nặng chạy Rust → WASM với fallback JS trong suốt: `compute_smc`
(BOS/CHoCH, Order Block, FVG) và `compute_nwe` (envelope Nadaraya-Watson LuxAlgo).
Nạp một lần qua `initSmcWasm()`; nếu không có thì bản JS thuần ở `smc.ts` /
`nadaraya-watson.ts` chạy thay với cùng chữ ký. Chi tiết ở [`wasm.vi.md`](./wasm.vi.md).

## Sàn Giao Dịch

| Sàn | Dữ Liệu | WebSocket | Định Dạng Symbol |
|-----|----------|-----------|-----------------|
| Binance Futures | REST + WS | fstream.binance.com | BTCUSDT |
| Binance Spot | REST + WS | stream.binance.com | BTCUSDT (dự phòng) |
| Bybit | REST + WS | stream.bybit.com | BTCUSDT |
| MEXC | REST + WS | contract.mexc.com | BTC_USDT |
| OKX | REST + WS | ws.okx.com | BTC-USDT |

## Khung Thời Gian

`1m`, `5m`, `15m`, `1h`, `4h`, `1d`

## Chỉ Báo

| Chỉ Báo | Mục Đích |
|---------|----------|
| Midnight Hunter Band | Kênh xu hướng (TMA + ATR) |
| SMA 50/200 | Hướng xu hướng + cắt chéo |
| RSI (14) | Quá mua/quá bán |
| MACD (12/26/9) | Động lực + gia tốc |
| ADX/DMI (14) | Độ mạnh xu hướng |
| Stochastic RSI | Thời điểm động lực nhanh |
| OBV | Xác nhận dòng tiền |
| VWAP + bands | Giá tham chiếu tổ chức |
| RSI Divergence | Phát hiện đảo chiều |
| Volume Profile | Hỗ trợ/kháng cự từ volume |
| Order Flow | Áp lực mua/bán |
| SMC | Mức Smart Money |
| Box Flip | Tín hiệu phá vùng |
| Double Bollinger Bands | Phân vùng Kathy Lien |
| Lux NWE | Nadaraya-Watson LuxAlgo (WASM) — cắt dải + thiên hướng |
| ICT Sessions | Giải mã phiên Á/Âu/Mỹ + Judas Swing |
| ICT Liquidity | Range, thanh khoản ext/int, IFVG, sweep |

## Cấu Hình

Lưu tại `localStorage` key `btc-chart:config:v1`:

- `interval`: Khung thời gian hiện tại
- `symbol`: Cặp giao dịch
- `vis`: Cờ bật/tắt các overlay (gồm `smc`, `ict`, `liquidity`, `luxNwe`)
- `zoom`: Viewport cuối cùng
- `alerts`: Quy tắc cảnh báo
- `sound`: Âm thanh cảnh báo
- `signalConfig`: Chỉ báo nào được bật cho ML signal

## Preset Cấu Hình Tín Hiệu

| Preset | Chỉ Báo | Phong Cách |
|--------|---------|------------|
| Full (All) | Tất cả 15 | Độ chính xác cao nhất |
| Trend Following | MA50, MA200, Cross, ADX, MACD, Mom | Bắt xu hướng |
| Mean Reversion | NWE, RSI, StochRSI, Div, OBV | Bắt đảo chiều |
| Scalping M1 | VWAP, Vol, Mom, RSI, StochRSI | Lệnh ngắn |
| Volume Flow | OBV, VWAP, VolSpike, ADX, Mom | Theo dòng tiền |
| Momentum | RSI, MACD, Mom, StochRSI, ADX | Đo lực đẩy |
| Conservative | MA50, Cross, RSI, ADX | Ít, chất lượng cao |

## Trade Setup Confluence + Giải Thích

`calcTradeSetup` (`lib/trade-setup.ts`) đếm phiếu tăng/giảm từ mọi nguồn (ML, RSI,
NWE, ADX, Boucher, Lien, Lux NWE, ICT Judas, ICT Liquidity), gom vào
`reasons: string[]`. Ra hướng cần ≥2 phiếu bên thắng;
`confidence = min(100, phiếu_thắng×20 + chênh_lệch×10)`.

**Nút "?"** ở panel Trade Setup mở `ExplainModal`:
- gom mỗi reason thành tăng / giảm / bối cảnh kèm giải thích tiếng Việt
  (`explainReason` trong `lib/explain.ts`),
- hiển thị công thức độ tin cậy + mức Entry/SL/TP,
- liệt kê từ điển cho mọi chỉ báo (`INDICATOR_DOCS`).

Modal render **inline** (không qua `createPortal(document.body)`) vì plugin nằm
trong Shadow DOM — portal ra body sẽ mất CSS scoped.

## ICT: Sessions + Liquidity

- **ICT Sessions** (`lib/ict-sessions.ts`): giải mã phiên Á/Âu/Mỹ từ giờ UTC, lưu
  high/low mỗi phiên (liquidity pool), phát hiện **Judas Swing** London (quét
  thanh khoản phiên Á + đảo chiều), và ADR% đã dùng. Killzone UTC cố định;
  chỉ intraday (rỗng ở 4h/1d).
- **ICT Liquidity** (`lib/liquidity.ts`): 4 "liquidity hack" — (1) trading range
  từ HTF với equilibrium premium/discount, (2) phân loại thanh khoản external
  (BSL/SSL) vs internal (FVG), (3) FVG động → lật thành inverse-FVG, (4) cú quét
  thanh khoản tại mép range (mạnh nhất trong killzone). Đẩy vào
  `TradeSetupExtra.liquidity` cho confluence và tự vẽ overlay riêng.

Cả hai vẽ overlay giới hạn theo range (không phải dải full màn hình) để chart dễ
nhìn. Cả 3 overlay ICT/SMC vẽ lại khi scroll **và** resize (`syncSize`).
