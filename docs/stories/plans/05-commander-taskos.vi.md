# Kế Hoạch Commander TaskOS Cho DeepBook

## Tóm Tắt

Định nghĩa lại mỗi người dùng đã kết nối như một **Commander** vận hành một
**TaskOS**. Thay vì tự duyệt plugin, người dùng ra lệnh, nhận mission, xem rủi
ro và phê duyệt thực thi.

- Commander = ví/người dùng đã kết nối
- TaskOS = lớp điều phối biến mục tiêu thành task
- Mission = objective nhìn thấy bởi người dùng
- Task = bước có thể thực thi hoặc review
- Plugin = capability provider

## Commander Profile

Rút ra từ trạng thái ví:
- wallet address
- network
- connected apps/plugins
- risk exposure
- recent activity
- mission progress
- streaks/achievements

## TaskOS Shell

Mục tiêu:
- static page: `deepbook.html`
- root app: `DeepBookTaskOS`
- tái sử dụng `SuiHostAPI`, `ShadowContainer`, dynamic plugin loading, wallet context

## Command Model

Dùng deterministic command routing ở V1, không cần LLM.

Nhóm lệnh:
- Trade
- Predict
- Risk
- Bot
- Rewards

## Mission và Task Model

Ví dụ mission:
- First DeepBook Trade
- Predict With Trend
- Daily Risk Review
- Bot Operator
- Claim Settlements

## Plugin Capability Registry

Xem plugin như capability provider:
- market-data
- swap
- orderbook
- portfolio
- predict
- risk
- bot
- quest
- history

## Approval và Safety Model

Mọi transaction task phải có:
- human-readable summary
- required wallet/network
- estimated effect
- risk warning
- max loss nếu liên quan
- bước cuối `Approve in Wallet`

## Types

`CommanderState`, `CommanderCommandIntent`, `MissionStatus`, `TaskStatus`
được dùng để mô hình hóa trạng thái và điều hướng tác vụ.

## Test Plan

- ví chưa kết nối → status `needs-wallet`
- ví đã kết nối → mission được khuyến nghị xuất hiện
- lệnh `predict trend` route đúng
- lệnh `review risk` route đúng
- stale oracle chặn execution task nhưng vẫn cho analyze
- claimable settlement kích hoạt claim mission
