# Predict Club Payout Preview

Tài liệu này ghi lại logic hiện tại cho `Win Probability`, `Indicative Payout` và `Capped Payout` trong giao diện Predict Club. Mục tiêu là có một điểm tham chiếu để tiếp tục nghiên cứu DeepBook Predict, SVI, payout/odds, và cách làm preview đáng tin cậy hơn.

> Trạng thái hiện tại: đây là preview phía UI, không phải settlement rule on-chain. Con số dùng để định hướng rủi ro trước khi execute.

## Nguồn Dữ Liệu

Predict Club lấy dữ liệu từ Predict Testnet server:

```text
Base URL: https://predict-server.testnet.mystenlabs.com
```

Các endpoint đang cần:

```text
GET /predicts/:predict_id/oracles
GET /oracles/:oracle_id/state
GET /oracles/:oracle_id/prices
GET /oracles/:oracle_id/svi/latest
GET /oracles/:oracle_id/svi
```

Field cần cho payout preview:

| Nhóm | Field | Ghi chú |
|---|---|---|
| Oracle | `oracle_id` | Oracle đang được chọn trên UI |
| Oracle | `expiry` | Milliseconds timestamp |
| Oracle | `status` | Chỉ nên dùng oracle `active` và chưa hết hạn |
| Price | `latest_price.forward` | Forward price, scale `1e9` từ API, UI normalize về USD |
| Price | `latest_price.spot` | Dùng hiển thị và fallback chart |
| SVI | `a`, `b`, `rho`, `rho_negative`, `m`, `m_negative`, `sigma` | Tham số volatility surface |
| Round | `direction` | `UP`, `DOWN`, hoặc `RANGE` |
| Round | `strike` | Strike USD cho `UP`/`DOWN` |
| Round | `lowerStrike`, `upperStrike` | Strike USD cho `RANGE` |
| Round | `amountDusdc` | Stake dùng để tính payout preview |

Với `/oracles/:id/state`, shape thực tế gồm:

```json
{
  "oracle": {
    "oracle_id": "...",
    "expiry": 1780678800000,
    "status": "active"
  },
  "latest_price": {
    "spot": 60198225985727,
    "forward": 60192904073219,
    "onchain_timestamp": 1780675374129
  },
  "latest_svi": {
    "a": 44235,
    "b": 457187,
    "rho": 940000034,
    "rho_negative": true,
    "m": 7660885,
    "m_negative": false,
    "sigma": 1000000,
    "onchain_timestamp": 1780675363154
  }
}
```

## Chuẩn Hóa Dữ Liệu

Price từ API đang scale `1e9`:

```text
forwardUsd = latest_price.forward / 1e9
spotUsd = latest_price.spot / 1e9
```

SVI params được normalize:

```text
a = raw.a / 1e6
b = raw.b / 1e6
rho = (raw.rho_negative ? -1 : 1) * raw.rho / 1e9
m = (raw.m_negative ? -1 : 1) * raw.m / 1e6
sigma = raw.sigma / 1e6
```

Time to expiry:

```text
T = max((expiryMs - nowMs) / YEAR_MS, 1 / 365)
YEAR_MS = 365.25 * 24 * 3600 * 1000
```

Ghi chú: `1 / 365` là floor hiện tại để tránh kỳ hạn quá ngắn làm công thức suy biến mạnh.

## Công Thức SVI Hiện Tại

Log-moneyness:

```text
k = ln(K / F)
```

Trong đó:

```text
F = forwardUsd
K = strikeUsd
```

Total variance theo SVI:

```text
w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))
```

Digital-style probability cho hướng `UP`:

```text
sqrtW = sqrt(w / T)
d2 = -k / sqrtW - sqrtW / 2
pUp = N(d2)
```

Trong đó `N(x)` là normal CDF.

Với `DOWN`:

```text
pDown = 1 - pUp
```

Với `RANGE`:

```text
pRange = pUp(lowerStrike) - pUp(upperStrike)
```

## Win Probability

`Win Probability` trên UI là xác suất hiển thị sau khi đã qua validation và display floor.

Validation hiện tại:

```text
SVI phải hợp lệ
forward > 0
expiry > 0
amountDusdc > 0
strike > 0 cho UP/DOWN
lowerStrike > 0 và upperStrike > 0 cho RANGE
lowerStrike < upperStrike cho RANGE
```

Nếu thiếu dữ liệu thật, UI hiển thị:

```text
Pricing preview unavailable
```

Các lý do có thể gặp:

```text
SVI unavailable
Forward or expiry unavailable
Stake amount unavailable
Strike unavailable
Range strikes unavailable
```

Nếu công thức trả xác suất rất nhỏ hoặc bằng `0`, UI không còn coi đó là unavailable. Thay vào đó dùng display floor:

```text
MIN_DISPLAY_PROBABILITY = 0.001
```

Nghĩa là:

```text
0.001 = 0.1%
```

Trên UI hiển thị:

```text
Win Probability <0.1%
```

## Indicative Payout

Khi probability đủ lớn để hiển thị trực tiếp:

```text
rewardMultiple = 1 / probability
indicativePayout = amountDusdc * rewardMultiple
```

Ví dụ:

```text
amountDusdc = 250
probability = 0.25
rewardMultiple = 1 / 0.25 = 4x
indicativePayout = 250 * 4 = 1,000 DUSDC
```

UI hiển thị:

```text
Indicative Payout +1,000 DUSDC
Win Probability 25.0%
```

## Capped Payout

Khi probability quá nhỏ, công thức `1 / probability` có thể tạo payout preview cực lớn hoặc vô hạn. Để tránh UI gây hiểu nhầm, Predict Club dùng cap hiển thị:

```text
MAX_REWARD_MULTIPLE = 1 / MIN_DISPLAY_PROBABILITY
MAX_REWARD_MULTIPLE = 1 / 0.001 = 1000x
```

Khi probability nhỏ hơn `0.1%` hoặc không còn đại diện tốt để hiển thị:

```text
displayProbability = 0.001
rewardMultiple = 1000
indicativePayout = amountDusdc * 1000
```

UI không gọi đây là `Indicative Payout`, mà gọi là:

```text
Capped Payout ≤...
Win Probability <0.1%
```

Ví dụ đang gặp với oracle `0x1830349f...2c7e5d`:

```text
forward ~= 60,193
strike = 68,600
direction = UP
amountDusdc = 250
```

Vì strike cách forward khá xa, probability rơi dưới ngưỡng hiển thị. UI hiện:

```text
Capped Payout ≤250,000 DUSDC
Win Probability <0.1%
```

Ý nghĩa: đây là upper-bound preview đã bị cap để tránh số payout vô lý. Không nên hiểu là quote thực thi chắc chắn.

## Khi Nào Unavailable Và Khi Nào Capped

| Trạng thái UI | Ý nghĩa |
|---|---|
| `Pricing preview unavailable` | Thiếu dữ liệu đầu vào hoặc dữ liệu không hợp lệ |
| `Indicative Payout` | Có probability hợp lệ và không bị floor |
| `Capped Payout` | Có đủ dữ liệu nhưng probability quá nhỏ, payout bị cap để hiển thị an toàn |
| `Win Probability <0.1%` | Probability thực tế nhỏ hơn ngưỡng hiển thị hiện tại |

## Điểm Cần Nghiên Cứu Thêm

1. Xác nhận công thức probability có đúng với semantics của DeepBook Predict contract hay chỉ là approximation từ SVI surface.
2. Tìm payout/odds thực tế từ contract hoặc quote API nếu có, thay vì tự suy ra bằng `1 / probability`.
3. Kiểm tra scale của `w`, `T`, và cách diễn giải total variance với expiry rất ngắn. Hiện code port từ `plugins/sui-deepbook-predict/domain/svi.ts`, nhưng cần xác nhận lại với tài liệu chính thức.
4. Xác định settlement rule: binary payout, range payout, vault payout, fee, spread, và pool/liquidity constraints.
5. Kiểm tra CORS/browser fetch trên UI vì curl server-side có dữ liệu đầy đủ nhưng browser có thể fail network khác.
6. Thiết kế UI cho extreme probability: nên hiển thị `No practical quote`, `Very low probability`, hay vẫn giữ `Capped Payout`.
7. Thêm telemetry debug cho preview:

```ts
{
  oracleId,
  forward,
  expiry,
  sviTimestamp,
  direction,
  strike,
  lowerStrike,
  upperStrike,
  rawProbability,
  displayProbability,
  rewardMultiple,
  reason,
}
```

## File Code Liên Quan

```text
plugins/predict-club/domain/payoutPreview.ts
plugins/predict-club/infrastructure/deepbookOracleService.ts
plugins/predict-club/presentation/RiskPanel.tsx
plugins/sui-deepbook-predict/domain/svi.ts
```

## Ghi Chú Kết Luận

`Pricing preview unavailable` chỉ nên dùng khi thiếu dữ liệu. Nếu API có đủ dữ liệu nhưng xác suất quá nhỏ, UI nên hiển thị trạng thái capped để người dùng hiểu rằng preview đang bị giới hạn hiển thị.

`Capped Payout` là một guardrail UI. Nó không thay thế quote thực tế từ Predict/DeepBook contract hoặc API nếu sau này tìm được nguồn odds/payout chính thức.
