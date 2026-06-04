# Lộ Trình DeepBook Interactive App Suite và Trend Predict

## Tóm Tắt

Xây một hệ sinh thái DeepBook tương tác hơn, tập trung vào giao dịch có yếu tố
game hóa cho power user, cùng một lớp Trend Predict cho các chiến lược định
hướng của DeepBook Predict.

Nguyên tắc quan trọng: Trend Predict không bao giờ được trình bày như logic
chiến thắng bảo đảm. Tín hiệu trend và momentum chỉ là công cụ hỗ trợ xác suất.

## DeepBook Home Hub

Hub cấp cao liên kết các app hiện có:

- `Trade Now`
- `Predict With Trend`
- `Manage Risk`
- `Run Bots`
- `Earn Points`
- `Analyze Markets`

## Lớp Game Hóa

- Daily quests
- Streaks
- Achievements
- Leaderboards

Ở V1, leaderboard có thể là local/session-based hoặc suy ra từ dữ liệu indexer.

## Trend Predict App

Mục đích: giúp người dùng tìm entry UP/DOWN tốt hơn bằng cách khớp expiry của
Predict với tín hiệu trend/momentum BTC.

### Quy Tắc Cốt Lõi

- trend-following là tín hiệu xác suất, không phải máy in lợi nhuận
- khớp timeframe của tín hiệu với expiry
- regime filter dựa trên SMA50/SMA100
- momentum filter dựa trên ROC
- neutral/sideway → không trade định hướng
- chỉ trade khi edge dương sau phí/slippage

### Kết Quả UX

- `Signal`
- `Confidence`
- `Reason`
- `Suggested Predict Action`
- `Risk Warning`
- `Backtest Required`

## Các App Module

- DeepBook Mission Control
- Trading Quest Board
- Trend Predict Lab
- Smart Trade Launcher
- Risk Review Center
- Bot Arena
- Market Radar
- Achievement Profile

## Types

```ts
type DeepBookIntent =
  | 'trade'
  | 'predict-trend'
  | 'analyze'
  | 'manage-risk'
  | 'run-bot'
  | 'earn-points'
```

## Test Plan

- Regime bullish chỉ cho tín hiệu UP khi MA và momentum xác nhận
- Regime bearish chỉ cho tín hiệu DOWN khi điều kiện giảm xác nhận
- Sideway regime trả `NO_TRADE`
- Quest completion cập nhật local mission state
- Các plugin DeepBook hiện có vẫn truy cập được
