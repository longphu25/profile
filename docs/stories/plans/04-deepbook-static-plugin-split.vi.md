# Kế Hoạch Tách DeepBook Static App & Plugin

## Trạng Thái

Các phần shell chính như `deepbook.html`, `src/deepbook/main.tsx`,
`DeepBookSuite.tsx`, Mission Control và nhóm tab chính đã hoàn thành.

## Tóm Tắt

Không nên tiếp tục tạo một static HTML riêng cho từng plugin nhỏ. Với
DeepBook, nên có một static page tổng:

- HTML: `deepbook.html`
- React entry: `src/deepbook/main.tsx`
- Root app: `src/deepbook/DeepBookSuite.tsx`

Mục tiêu là biến các plugin DeepBook hiện có thành một **DeepBook Suite** với:
- navigation
- action hub
- wallet context
- recommended actions
- lazy plugin loading

Các trang chuyên biệt vẫn giữ làm deep link:
- `sui-deepbook-predict.html`
- `sui-deepbook-hedging-bot.html`
- `sui-plugin.html`
- `sui-plugin-wasm.html`

## Cách Chia Plugin

Chia theo **user workflow**, không chia quá nhỏ theo widget.

### 1. DeepBook Core Apps

- `sui-deepbook-home`
- `sui-swap`
- `sui-deepbook-orderbook`
- `sui-deepbook-portfolio`
- `sui-deepbook-predict`

### 2. Market & Analytics Apps

- `sui-pool-explorer`
- `sui-price-feed`
- `sui-deepbook-history`
- `sui-deepbook-analysis`
- `sui-deepbook-market-radar` (planned)

### 3. Risk & Margin Apps

- `sui-margin-manager`
- `sui-deepbook-risk-center` (planned)

### 4. Bot & Automation Apps

- `sui-hedging-monitor`
- `sui-deepbook-hedging-bot`
- `sui-deepbook-bot-arena` (planned)

### 5. Gamification Apps

- `sui-deepbook-quest-board`
- `sui-deepbook-achievement-profile`
- `sui-deepbook-leaderboard`

### 6. Predict Strategy Apps

Giữ phần cốt lõi trong `sui-deepbook-predict`, và tách các module nâng cao khi cần:
- `sui-deepbook-trend-predict`
- `sui-deepbook-predict-backtest`

## Thiết Kế Static HTML

### Trang Được Khuyến Nghị

Dùng:

```text
deepbook.html
```

### Bố Cục Trang

- Sticky top bar
- First viewport với Mission Control
- Main workspace
- Secondary rail trên desktop
- Mobile ưu tiên action cards

### Navigation Groups

- `Home`
- `Trade`
- `Predict`
- `Portfolio`
- `Bots`
- `Rewards`
- `Advanced`

## Public Interfaces / Types

```ts
type DeepBookAppGroup =
  | 'home'
  | 'trade'
  | 'predict'
  | 'portfolio'
  | 'bots'
  | 'rewards'
  | 'advanced'
```

## Mặc Định Triển Khai

- tái sử dụng `SuiHostAPI`
- giữ pattern đường dẫn plugin cho dev/prod
- chỉ load Home/Mission Control ban đầu
- lazy-load các plugin khác
- không nhồi toàn bộ logic DeepBook vào một plugin khổng lồ

## Test Plan

- mở `deepbook.html` không có ví
- kết nối ví
- mở nhóm Trade/Predict/Bots
- kiểm tra mobile/narrow viewport
- regression cho các trang standalone và `bun run build`

## Giả Định

- `deepbook.html` là tên static page tốt nhất
- mục tiêu chính là một DeepBook product suite
- plugin hiện có nên được nhóm lại và tái sử dụng thay vì viết lại
