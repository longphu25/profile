# Hệ Thống Đảo Chiều Kathy Lien (Double Bollinger Band)

## Nguồn Gốc

Dựa trên chiến lược Double Bollinger Band (DBB) của Kathy Lien từ sách "Day Trading and Swing Trading the Currency Market". Chuyển đổi sang crypto với phát hiện đảo chiều theo zone, phân tích squeeze, và kiệt sức động lực.

## Khái Niệm Cốt Lõi

### 1. Double Bollinger Bands (DBB)

Hai bộ Bollinger Band trên cùng SMA(20):

- **Bands ngoài**: SMA +/- 2 độ lệch chuẩn (vùng xu hướng mạnh)
- **Bands trong**: SMA +/- 1 độ lệch chuẩn (vùng động lực)

Tạo ra 3 vùng giao dịch riêng biệt.

### 2. Ba Vùng

| Vùng | Vị Trí Giá | Ý Nghĩa |
|------|-----------|---------|
| **Buy Zone** | Trên +1SD | Động lực tăng mạnh, xu hướng tiếp tục |
| **Sell Zone** | Dưới -1SD | Động lực giảm mạnh, xu hướng tiếp tục |
| **Neutral Zone** | Giữa -1SD và +1SD | Sideway, tích lũy, hoặc đảo chiều |

### 3. Phát Hiện Đảo Chiều

Đảo chiều xảy ra khi giá chuyển zone:

- **Đảo chiều tăng**: Giá từ Sell Zone sang Neutral (hoặc Buy)
- **Đảo chiều giảm**: Giá từ Buy Zone sang Neutral (hoặc Sell)

Chấm điểm tin cậy (0-100):

| Yếu Tố | Điểm |
|---------|------|
| Chuyển zone | +40 cơ bản |
| Chạm band ngoài | +20 |
| Xác nhận nến | +15 |
| Squeeze breakout cùng hướng | +15 |
| Động lực 3 nến | +10 |

### 4. Bollinger Squeeze

Phát hiện giai đoạn biến động thấp (bandwidth < 50% trung bình 120 nến):

- **Squeeze hoạt động**: Chỉ báo nhấp nháy, bùng nổ sắp tới
- **Hướng breakout**: Xác định khi squeeze kết thúc (giá vs SMA)

### 5. Kiệt Sức Động Lực

Phát hiện khi giá chạm band ngoài nhưng thân nến co lại trong 3 nến cuối. Báo hiệu lực đẩy hiện tại đang yếu đi.

### 6. Phân Loại Chế Độ

- **Trending Up**: 5+ nến trong 8 nến cuối ở Buy Zone
- **Trending Down**: 5+ nến trong 8 nến cuối ở Sell Zone
- **Range**: Không thỏa điều kiện nào

### 7. ADR% Đã Dùng

Đo phần trăm Average Daily Range (14 nến) đã bị tiêu thụ. Trên 80% là cảnh báo (ít khả năng đi tiếp).

## Tích Hợp Chart

- **DBB Lines**: 5 đường trên chart giá (SMA tím gạch, +/-2SD liền, +/-1SD gạch). Bật/tắt bằng nút "DBB".
- **Markers**: `REV+` (mũi tên xanh dương lên) và `REV-` (mũi tên tím xuống)
- **Panel**: Thu gọn được với nút ON/OFF
  - Thu gọn: Hiện zone + tín hiệu đảo chiều + squeeze
  - Mở rộng: Tất cả mức DBB, squeeze, kiệt sức, ADR%, chi tiết tín hiệu

## Đóng Góp Vào Trade Setup

- Tín hiệu đảo chiều mới nhất: +1 bull/bear
- Tin cậy cao (>= 70): +1 thêm
- Squeeze breakout: +1 theo hướng breakout
- Kiệt sức tại biên band: +1 ngược xu hướng
