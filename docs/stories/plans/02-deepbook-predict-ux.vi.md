# Kế Hoạch Tối Ưu UX Cho DeepBook Predict

## Tóm Tắt

Tối ưu dashboard cho first-time trader, giảm số bước cần thiết để dùng sản
phẩm, và tạo ấn tượng mạnh trong 30-60 giây đầu mà vẫn giữ các tab kỹ thuật cho
judge và power user.

Chiến lược UX: thêm Dashboard Shell / Action Hub phía trên plugin hiện tại và
biến sản phẩm từ "13 technical tabs" thành "3 primary user actions":

- `Start Guided Trade`
- `Analyze Market`
- `Earn with PLP`

## First-Screen Action Hub

- Trạng thái gọn ở hero:
  - BTC spot / forward
  - selected oracle expiry + time left
  - oracle health
  - wallet state
  - DUSDC balance nếu có
- CTA:
  - `Start Guided Trade`
  - `Analyze Market`
  - `Earn with PLP`
- Nếu ví chưa kết nối, CTA chính là `Connect Wallet`
- Nếu oracle stale, CTA trade bị vô hiệu hóa và route sang `Analyze Market`

## Guided Trade Flow

1. `Choose Market`
2. `Choose Prediction`
3. `Enter Amount`
4. `Preview`
5. `Submit`

Mục tiêu chấp nhận: người dùng mới tạo được một trade trong tối đa 5 thao tác
sau khi kết nối ví.

## Đơn Giản Hóa Điều Hướng

Primary tabs:
- `Market`
- `Trade`
- `Portfolio`
- `Vault`

Advanced group:
- `Surface`
- `Risk`
- `Strategy`
- `PLP+Hedge`
- `Loop`
- `Arb`
- `Lending`
- `Spot`
- `Keeper`

## Thông Tin Thân Thiện Với Người Dùng

- `What can I do now?`
- `Recommended next action`
- `Safety strip`

## Types

```ts
type UserIntent = 'trade' | 'analyze' | 'earn' | 'claim'
type GuidedTradeStep = 'market' | 'prediction' | 'amount' | 'preview' | 'submit'
type FeatureStatus = 'live' | 'simulated' | 'experimental' | 'requires-wallet'
```

## Test Plan

- Ví chưa kết nối: CTA chính là connect wallet
- Ví đã kết nối, oracle khỏe: guided flow đi tới preview và signing
- Oracle stale: chặn trade và giải thích rõ
- Không có DUSDC: chỉ rõ token thiếu và hành động tiếp theo
- Mobile: primary actions vẫn dễ thấy, advanced tabs không gây rối
- Regression: các flow cũ vẫn render được
