# Hệ Thống Scalping M1 Boucher

## Nguồn Gốc

Dựa trên phương pháp range-scalping của Jean-Francois Boucher (Jasper4x). Chuyển từ forex (EUR/USD, box 9 pip cố định) sang crypto (BTC/USDT, box động theo ATR).

## Khái Niệm Cốt Lõi

### 1. Box Theo ATR

Box size = ATR(14) trên khung thời gian hiện tại. Tự động thích ứng với biến động BTC.

- **Box** = 1 đơn vị ATR của biến động giá theo chiều dọc
- Giá vượt trên box tạo box mới phía trên
- Giá xuống dưới box tạo box mới phía dưới
- Các box lịch sử được theo dõi để phân tích tốc độ

### 2. Trigger 3-Bar Reversal

Tín hiệu vào lệnh chính. Phát hiện lực đảo chiều tại biên box:

- **Long**: Nến 1 giảm, Nến 2 trung tính, Nến 3 tăng đóng trên đỉnh Nến 1 (apex)
- **Short**: Nến 1 tăng, Nến 2 trung tính, Nến 3 giảm đóng dưới đáy Nến 1 (nadir)

Hiển thị marker `3B+` / `3B-` trên chart.

### 3. Ladder Levels

Hỗ trợ/kháng cự tự động, cách nhau 1 box size:

- Lọc bỏ level có 0 lần chạm
- Vai trò (support/resistance) theo vị trí tương đối với giá hiện tại
- Số lần chạm cho biết độ mạnh

### 4. Entry (Bán Xanh / Mua Đỏ)

- **Bán**: Nến xanh chạm resistance trong ngưỡng 0.3 box
- **Mua**: Nến đỏ chạm support trong ngưỡng 0.3 box
- `confirmed: true` khi trùng với 3-bar reversal

### 5. Đọc Tốc Độ

So sánh tốc độ di chuyển của box với trung vị:

- **Fast** (< 60% trung vị): Momentum tiếp tục
- **Slow** (> 150% trung vị): Vùng mean-reversion
- **Normal**: Bình thường

### 6. Quản Lý Rủi Ro

- **Envelope**: 4 box từ entry (bảo vệ tài khoản)
- **Target**: 1 ATR (nhanh, lặp lại được)
- **Win Rate**: Backtest trên các tín hiệu gần đây

## Tích Hợp Chart

- **Markers**: `3B+` (mũi tên xanh lên) và `3B-` (mũi tên vàng xuống)
- **Panel**: Thu gọn được với nút ON/OFF
  - Thu gọn: Hiện tốc độ + hướng tín hiệu + WR%
  - Mở rộng: Đầy đủ số liệu, box, entry, ladder

## Đóng Góp Vào Trade Setup

- Entry gần đây (3 nến): +1 bull/bear
- 3-Bar reversal: +1 bull/bear
- Box speed fast + entry cùng hướng: +1 bull/bear
