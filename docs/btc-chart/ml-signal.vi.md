# BTC Chart - Hệ Thống ML Signal

## Tổng Quan

Hệ thống chấm điểm dựa trên tập hợp 15 đặc trưng kỹ thuật có trọng số, cho ra điểm 0-1 với nhãn hướng (STRONG BUY, BUY, NEUTRAL, SELL, STRONG SELL).

## Đặc Trưng

| Key | Nhãn | Trọng Số | Tăng | Giảm |
|-----|------|----------|------|------|
| NWE_pos | Vị trí Band | 1.5 | Giá gần band dưới | Giá gần band trên |
| Price>NWE_mid | P>Mid | 2.0 | Đóng > NWE giữa | Đóng < NWE giữa |
| Price>MA50 | P>MA50 | 1.5 | Đóng > SMA50 | Đóng < SMA50 |
| Price>MA200 | P>MA200 | 1.0 | Đóng > SMA200 | Đóng < SMA200 |
| MA50>MA200 | MA50/200 | 2.0 | Golden cross | Death cross |
| RSI | RSI | 2.0 | RSI < 30 (quá bán) | RSI > 70 (quá mua) |
| MACD_hist | MACD | 1.5 | Histogram > 0 | Histogram < 0 |
| MACD_acc | MACD Acc | 1.0 | Hist tăng | Hist giảm |
| Mom5 | Mom5 | 1.0 | Lợi nhuận 5 nến dương | Lợi nhuận 5 nến âm |
| VolSpike | VolSpike | 0.8 | Spike + nến xanh | Spike + nến đỏ |
| ADX | ADX/DMI | 2.0 | ADX>20 + DI+ > DI- | ADX>20 + DI- > DI+ |
| StochRSI | StochRSI | 1.2 | %K < 20 (quá bán) | %K > 80 (quá mua) |
| OBV | OBV | 1.0 | Độ dốc 10 nến dương | Độ dốc 10 nến âm |
| VWAP | VWAP | 1.2 | Đóng > VWAP | Đóng < VWAP |
| Divergence | RSI Div | 2.2 | Phân kỳ tăng | Phân kỳ giảm |

## Tính Điểm

```
raw = tổng(giá_trị_đặc_trưng * trọng_số) / tổng(trọng_số)
score = (raw + 2) / 4    # Chuẩn hóa về 0..1
```

Đặc trưng bị tắt trong SignalConfig sẽ bị loại khỏi cả tử số và mẫu số.

## Nhãn

| Khoảng Điểm | Nhãn |
|-------------|------|
| > 0.75 | STRONG BUY |
| > 0.58 | BUY |
| > 0.42 | NEUTRAL |
| > 0.25 | SELL |
| <= 0.25 | STRONG SELL |

## Cấu Hình Tín Hiệu

Người dùng chọn đặc trưng nào tham gia qua:

- **Preset**: Nhóm chọn nhanh (Trend, Reversal, Scalp, Volume, Momentum, Conservative, All)
- **Toggle riêng**: Nhóm theo loại (Trend, Momentum, Volume, Band/Reversal)
- **Lưu lại**: Lưu vào localStorage, giữ qua reload
