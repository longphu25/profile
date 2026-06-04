# Kế Hoạch DeepBook Predict User Assist

## Tóm Tắt

Xây một lớp hỗ trợ người dùng cho `sui-deepbook-predict.html`, kết hợp bảng điều khiển
Predict hiện có với bối cảnh thị trường BTC từ BTC Chart Pro.

Mục tiêu là giúp first-time user và hackathon judge trả lời:
- Có thể giao dịch ngay không?
- Nên chờ hay phân tích trước?
- Có cần DUSDC không?
- Hướng nào phù hợp với bối cảnh BTC hiện tại?
- Max loss là gì?
- Sau khi quyết toán nên làm gì?
- Vị thế Predict hiện tại của tôi nằm ở đâu trên chart?

## Vị Trí Trong Idea Bank

Hướng chính:
- **#9 Predict Surface Studio**

Hướng phụ:
- **#10 PLP Risk Dashboard**
- **#8 Settled-Redeem Keeper Network**
- **#7 Vol-Arb Bot / Signal Monitor**
- **#1 Range Ladder Vault**
- **#2 PLP + Hedge Vault**
- frontend hướng người dùng mới với Action Hub và giao dịch có hướng dẫn

## Mô Hình Kiến Trúc

Trang host kết nối:
- ví Sui
- plugin Predict
- BTC signal context
- localStorage cho assistant prefs

## Các Thay Đổi Chính

- thêm `Predict Assistant`
- khuyến nghị một hành động tại một thời điểm:
  - `Ready to Trade`
  - `Wait`
  - `Analyze First`
  - `Claim Position`
  - `Fund DUSDC`
- giải thích khuyến nghị bằng trạng thái ví, DUSDC, độ mới của oracle, expiry,
  open/settled positions, vault risk, BTC context, max loss
- thêm `BTC Signal Context`
- chỉ xuất các nhãn xác suất:
  - `Bullish`
  - `Bearish`
  - `Neutral`
  - `No Trade`
- nâng cấp luồng giao dịch có hướng dẫn
- thêm hỗ trợ sau giao dịch
- thêm chart-first position selection
- thêm persistence và export

## Types

`PredictAssistAction`, `BtcSignalBias`, `AssistSeverity`, `PredictAssistState`

## User Flow

Người dùng mở app → assistant lấy dữ liệu Predict + bối cảnh BTC → đề xuất hành
động → người dùng bắt đầu giao dịch có hướng dẫn hoặc nhận vị thế/phân tích.

## Test Plan

- ví chưa kết nối
- ví đã kết nối nhưng không có DUSDC
- oracle khỏe
- oracle cũ
- expiry quá gần
- tín hiệu BTC bullish/bearish/neutral
- settled position
- regression cho các tab hiện có
