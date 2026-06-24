# BTC Chart Plugin - Hướng Dẫn Sử Dụng

## Bắt Đầu

Mở `btc-chart.html` trong trình duyệt (qua `bun run dev`). Chart tải dữ liệu BTC/USDT 1H từ Binance Futures, sau đó kết nối WebSocket để cập nhật real-time.

## Bố Cục Giao Diện

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Symbol | Khung TG | Giá | OHLCV | Trạng thái Live   │
├─────────────────────────────────────────────────────────────┤
│ Toolbar: Nút bật/tắt chỉ báo | Âm thanh | Thông báo | Xuất │
├────────────────────────────────────────────┬────────────────┤
│                                            │                │
│        Chart Chính                         │   Sidebar      │
│        (Nến + overlay)                     │   - Signal     │
│                                            │   - Trade Setup│
│                                            │   - Config     │
│                                            │   - Scalping   │
├────────────────────────────────────────────│   - Reversal   │
│ Pane Oscillator (RSI/ADX/Stoch/OBV)       │   - Vị thế     │
│                                            │   - Thị trường │
├────────────────────────────────────────────┴────────────────┤
│ Status: Trạng thái WS | Thời gian | Số đếm OF/Box          │
└─────────────────────────────────────────────────────────────┘
```

## Đổi Symbol

- Dùng dropdown chọn từ danh sách có sẵn (BTC, ETH, SOL...)
- Nhập symbol tùy chỉnh vào ô input (tự động kiểm tra Binance)
- Hỗ trợ Binance, Bybit, MEXC, OKX

## Bật/Tắt Chỉ Báo

Click nút trên toolbar:

| Nút | Overlay |
|-----|---------|
| MH Band | Kênh Midnight Hunter |
| MA50 | Trung bình động 50 |
| MA200 | Trung bình động 200 |
| DBB | Double Bollinger Bands (Kathy Lien) |
| SMC | Smart Money Concepts |
| Box Flip | Tín hiệu phá vùng |
| Order Flow | Áp lực mua/bán |
| VWAP | VWAP + dải |
| RSI Div | Mũi tên phân kỳ RSI |
| Vol Profile | Biểu đồ volume ngang |
| Volume | Thanh volume |
| Vol Spike | Đánh dấu volume bất thường |

## Hệ Thống Tín Hiệu

Panel ML Signal hiện gauge 0-100%:

- **STRONG BUY/SELL**: Nhiều chỉ báo đồng thuận mạnh
- **BUY/SELL**: Đồng thuận vừa
- **NEUTRAL**: Tín hiệu lẫn lộn

### Cấu Hình Tín Hiệu

Click "Signal Config" để mở panel cấu hình:

1. **Preset nhanh**: Click nút preset để chuyển bộ chỉ báo
2. **Toggle riêng**: Bật/tắt từng đặc trưng
3. Thay đổi có hiệu lực ngay lập tức

## Trade Setup

Tự động tính Entry, SL, TP khi 2+ tín hiệu đồng thuận:

- Hiện hướng (LONG/SHORT) với % confidence
- **Nhập Vốn** (mặc định $10) và **Đòn bẩy** (mặc định x10)
- Tự tính: Size, Qty, Lỗ/Lời $, Giá thanh lý
- Nhóm tín hiệu theo nguồn (Indicators, Boucher, Lien)

## Boucher M1 Scalping

Panel thu gọn cho phương pháp box scalping Boucher:

- **ON/OFF**: Nút bật/tắt hệ thống
- **Thu gọn**: Hiện tốc độ + tín hiệu + win rate
- **Mở rộng**: Đầy đủ số liệu, box, entry, ladder
- Tốt nhất trên khung M1

## Kathy Lien Reversal

Panel thu gọn cho hệ thống đảo chiều Double Bollinger Band:

- **ON/OFF**: Nút bật/tắt hệ thống
- **Thu gọn**: Hiện zone + đảo chiều + squeeze
- **Mở rộng**: Tất cả mức DBB, squeeze, kiệt sức, chi tiết

## Cảnh Báo

Đặt cảnh báo giá hoặc RSI:

- Phát âm thanh + thông báo trình duyệt
- Tự động reset sau khi kích hoạt
- Bật/tắt riêng từng cảnh báo

## Vị Thế

Theo dõi vị thế thủ công:

- Hiện PnL chưa thực hiện
- Gợi ý SL/TP theo ATR + NWE
- Vẽ đường giá trên chart

## Điều Khiển

- **Desktop**: Cuộn chuột zoom, kéo di chuyển, crosshair khi hover
- **Mobile**: Pinch zoom, kéo chạm, tap cho crosshair
- **Oscillator**: Kéo thanh resize để điều chỉnh chiều cao

## Xuất / Nhập

- **Snapshot**: Tải ảnh chart PNG
- **Export Config**: Lưu tất cả cài đặt ra JSON
- **Import Config**: Nạp cài đặt từ file JSON

## Mobile

Giao diện hoàn toàn responsive:

- **768px+**: Chia đôi (chart trái, sidebar phải)
- **< 768px**: Xếp chồng (chart trên, sidebar dưới cuộn được)
- **< 480px**: Chế độ gọn, toolbar cuộn ngang
