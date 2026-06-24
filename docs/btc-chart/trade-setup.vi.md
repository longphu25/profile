# Trade Setup - Hệ Thống Đồng Thuận

## Tổng Quan

Trade Setup tự động tính Entry, Stop Loss, Take Profit dựa trên đồng thuận tín hiệu từ nhiều hệ thống:

1. **ML Signal** (tập hợp chỉ báo có trọng số)
2. **Boucher M1 Scalping** (box, 3-bar reversal, tốc độ)
3. **Kathy Lien Reversal** (chuyển zone DBB, squeeze, kiệt sức)

## Logic Quyết Định

### Nguồn Tín Hiệu

| Nguồn | Điều Kiện Tăng | Điều Kiện Giảm |
|-------|----------------|----------------|
| ML Score | >= 0.65 | <= 0.35 |
| RSI | < 35 (quá bán) | > 65 (quá mua) |
| NWE Zone | Giá tại band dưới | Giá tại band trên |
| ADX | >= 25 (xác nhận xu hướng) | >= 25 (xác nhận xu hướng) |
| Boucher Entry | Tín hiệu Long (3 nến) | Tín hiệu Short (3 nến) |
| Boucher 3-Bar | Reversal tăng (3 nến) | Reversal giảm (3 nến) |
| Boucher Speed | Fast + entry cùng hướng | Fast + entry cùng hướng |
| Lien Reversal | Tín hiệu đảo chiều tăng | Tín hiệu đảo chiều giảm |
| Lien High Conf | Confidence >= 70 | Confidence >= 70 |
| Lien Squeeze | Breakout lên | Breakout xuống |
| Lien Exhaustion | Tại band dưới | Tại band trên |

### Quyết Định Hướng

- **Cần tối thiểu 2 tín hiệu** cùng một hướng
- Số tín hiệu tăng phải lớn hơn giảm (hoặc ngược lại)
- Nếu không thỏa: "No confluence"

### Công Thức Confidence

```
confidence = min(100, max(bull, bear) * 20 + abs(bull - bear) * 10)
```

Cao hơn khi nhiều tín hiệu đồng thuận và biên chênh lệch lớn.

### Stop Loss

- **Long**: min(swing low 20 nến, NWE lower) * 0.998
- **Short**: max(swing high 20 nến, NWE upper) * 1.002

### Take Profit

- **TP1**: 2x risk từ entry (R:R 1:2)
- **TP2**: NWE band đối diện hoặc 3x risk (cái nào xa hơn)

## Tính Toán Vị Thế

Người dùng nhập:
- **Vốn** (mặc định $10)
- **Đòn bẩy** (mặc định x10, tối đa x125)

Hệ thống tự tính:

| Trường | Công Thức |
|--------|-----------|
| Size | vốn * đòn bẩy |
| Quantity | size / entry |
| Lỗ (SL) | qty * abs(entry - sl) |
| Lời (TP1) | qty * abs(tp1 - entry) |
| Lời (TP2) | qty * abs(tp2 - entry) |
| Giá thanh lý | entry * (1 - 1/leverage) cho long |

## Giao Diện

Panel Trade Setup hiện:

- Hướng (LONG/SHORT) với màu sắc
- Phần trăm tin cậy
- Ô nhập Vốn ($) + Ô nhập Đòn bẩy (x1-x125)
- Mức giá: Entry, SL, TP1, TP2 với % rủi ro
- Chi tiết vị thế: Size, Qty, Lỗ $, Lời $, Giá thanh lý
- Lý do nhóm theo nguồn:
  - **Indicators** (tag xám): ML, RSI, ADX, NWE
  - **Boucher** (tag xanh mint): Entry, 3-Bar, Box Speed
  - **Lien** (tag xanh dương): Reversal, High Conf, Squeeze, Exhaustion
