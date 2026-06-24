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
├── components/
│   ├── ChartHeader.tsx       # Chọn symbol, khung thời gian, giá
│   ├── IndicatorToolbar.tsx  # Nút bật/tắt các overlay
│   ├── SignalPanel.tsx       # Gauge tín hiệu ML
│   ├── SignalConfigPanel.tsx # Chọn chỉ báo + preset
│   ├── TradeSetupPanel.tsx   # Entry/SL/TP + vốn/đòn bẩy
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
│   ├── useMarketData.ts   # Ticker, Funding, F&G, Klines, OI
│   ├── usePositions.ts    # CRUD vị thế + price lines
│   └── useOI.ts           # Tổng hợp Open Interest
└── lib/
    ├── types.ts           # Các kiểu dữ liệu
    ├── constants.ts       # Bảng màu, khung thời gian
    ├── symbols.ts         # Danh sách symbol đa sàn
    ├── format.ts          # Định dạng giá/volume
    ├── indicators.ts      # Toán học: MHBand, SMA, RSI, MACD, ADX...
    ├── ml.ts              # ML signal (weighted ensemble)
    ├── trade-setup.ts     # Tính Entry/SL/TP tự động
    ├── signal-config.ts   # Cấu hình chỉ báo + preset
    ├── boucher-scalping.ts # Hệ thống Boucher M1
    ├── lien-reversal.ts   # Hệ thống Kathy Lien DBB
    ├── overlays.ts        # Vẽ SMC + BoxFlip
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
                                                          │
                                                    ML Signal → Trade Setup
                                                          │
                                                    setState → Sidebar
```

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

## Cấu Hình

Lưu tại `localStorage` key `btc-chart:config:v1`:

- `interval`: Khung thời gian hiện tại
- `symbol`: Cặp giao dịch
- `vis`: Cờ bật/tắt các overlay (13 toggle)
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
