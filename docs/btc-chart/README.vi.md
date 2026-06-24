# BTC Chart Plugin - Tài Liệu

Tài liệu kỹ thuật và hướng dẫn sử dụng cho plugin BTC Chart Pro.

## Tài Liệu

| File | Mô Tả |
|------|-------|
| [TECHNICAL.vi.md](./TECHNICAL.vi.md) | Kiến trúc, luồng dữ liệu, cấu trúc file, chỉ báo |
| [ml-signal.vi.md](./ml-signal.vi.md) | Hệ thống tín hiệu ML (15 đặc trưng) |
| [trade-setup.vi.md](./trade-setup.vi.md) | Trade Setup tự động (Entry/SL/TP) |
| [boucher-scalping.vi.md](./boucher-scalping.vi.md) | Hệ thống Scalping M1 Jean-Francois Boucher |
| [lien-reversal.vi.md](./lien-reversal.vi.md) | Hệ thống đảo chiều Kathy Lien (DBB) |
| [USER-GUIDE.vi.md](./USER-GUIDE.vi.md) | Hướng dẫn sử dụng (giao diện, tính năng, mobile) |

## Tham Chiếu Nhanh

### Hệ Thống Giao Dịch

1. **ML Signal**: Tập hợp 15 chỉ báo kỹ thuật, cấu hình qua preset
2. **Boucher M1 Scalping**: Box theo ATR, 3-bar reversal, ladder, đọc tốc độ
3. **Kathy Lien Reversal**: Double Bollinger Band, chuyển zone, squeeze, kiệt sức

### Cách Chúng Hoạt Động Cùng Nhau

Cả 3 hệ thống đều cấp dữ liệu vào **Trade Setup** (đồng thuận nhiều tín hiệu):

```
ML Signal (score > 0.65 hoặc < 0.35) ──┐
RSI (< 35 hoặc > 65) ──────────────────┤
NWE Zone (tại biên band) ──────────────┤
ADX (>= 25 xu hướng mạnh) ────────────┤
                                        ├──→ Trade Setup (cần 2+ đồng thuận)
Boucher Entry (3 nến gần nhất) ────────┤      → Entry, SL, TP, Confidence
Boucher 3-Bar Reversal ────────────────┤      → Vốn, Đòn bẩy, Lời/Lỗ $
Boucher Box Speed ─────────────────────┤
                                        │
Lien Reversal Signal ──────────────────┤
Lien High Confidence ──────────────────┤
Lien Squeeze Breakout ─────────────────┤
Lien Exhaustion ───────────────────────┘
```

### Sàn Hỗ Trợ

Binance (futures + spot), Bybit, MEXC, OKX

### Khung Thời Gian

1m, 5m, 15m, 1h, 4h, 1d
