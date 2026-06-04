# Kế Hoạch Interactive Predict Position Chart

## Tóm Tắt

Thêm biểu đồ vị thế tương tác vào trải nghiệm Trade và Portfolio của DeepBook
Predict.

Chart phải cho phép:
- click một mức giá để chọn binary strike
- tự suy ra `UP` hoặc `DOWN` theo quan hệ với spot
- kéo một dải giá để chọn range position
- hiển thị các vị thế binary và range đã mint

Chart chỉ là lớp selector và visualization, không tự trade. Luồng PTB
mint/redeem do ví ký vẫn giữ nguyên.

## Các Thay Đổi Chính

### Chart Picker

- thêm `PredictPositionChart` trong Trade tab
- render price history của oracle đã chọn
- snap selection theo spot, min strike và tick size
- form input hiện có vẫn là source of truth của transaction state

### Position Overlays

- nạp open positions cho manager của ví đã kết nối
- binary position hiển thị bằng line ngang
- range position hiển thị bằng translucent band
- style theo trạng thái `open`, `awaiting-settlement`, `settled`, `claimable`

### Range-Aware Data

Không dùng `/positions/minted` hoặc `/trades/:oracle_id` cho range.

Dữ liệu range phải đến từ:
- `/ranges/minted?...`
- `/ranges/redeemed?...`
- `/managers/:manager_id/ranges` nếu endpoint có sẵn

## Types

`ChartPickMode`, `PositionOverlayStatus`, `ChartPositionSelection`,
`PositionOverlay`

## Notes Triển Khai

- thêm `lightweight-charts@4.2.0` làm dependency
- `TradePanel` sở hữu form state
- `PredictPositionChart` chỉ emit selection
- execution semantics và Move call không đổi

## Test Plan

- click trên/dưới spot
- click gần spot
- kéo range theo hai hướng
- invalid range drag
- open binary/range overlays
- range đã redeem không còn hiển thị
- đổi oracle làm mới chart và overlay
- ví chưa kết nối vẫn plan được nhưng không execute được
