# Data Contract DeepBook Cho Predict Club

Tài liệu này định nghĩa dữ liệu DeepBook Predict mà Predict Club cần cho chọn
oracle, pricing preview, hiển thị contract quote, portfolio summary và vault
summary.

## Nguồn Dữ Liệu

Predict Club hiện dựa trên ba bề mặt dữ liệu:

- Predict Testnet server:

```text
https://predict-server.testnet.mystenlabs.com
```

- Sui Testnet RPC cho wallet, object, balance và `devInspect`.
- State local của Predict Club cho pledge V1 và demo escrow offers.

## Endpoint Predict Server

Bắt buộc:

```text
GET /predicts/:predict_id/oracles
GET /oracles/:oracle_id/state
GET /oracles/:oracle_id/prices
GET /oracles/:oracle_id/svi/latest
GET /oracles/:oracle_id/svi
```

Tùy chọn nếu có:

```text
GET /oracles/:oracle_id/vaults
GET /managers/:manager_id/positions
```

Nếu endpoint tùy chọn chưa có hoặc chưa ổn định, dùng Sui object reads và
`devInspect` khi package có read function phù hợp.

## Oracle State

Predict Club cần:

| Field | Mục đích |
| --- | --- |
| `oracle_id` | oracle đang chọn |
| `status` | gating active/stale/closed |
| `expiry` | expiry round và quote validation |
| `latest_price.spot` | hiển thị spot trên decision strip |
| `latest_price.forward` | input fair value và contract quote |
| `latest_price.onchain_timestamp` | freshness check |
| `latest_svi` | win probability và degraded fallback |

Price từ API quan sát được scale `1e9`:

```text
spotUsd = latest_price.spot / 1e9
forwardUsd = latest_price.forward / 1e9
```

SVI normalize theo `1e9`, với flag âm riêng cho tham số có dấu:

```text
a = raw.a / 1e9
b = raw.b / 1e9
rho = (raw.rho_negative ? -1 : 1) * raw.rho / 1e9
m = (raw.m_negative ? -1 : 1) * raw.m / 1e9
sigma = raw.sigma / 1e9
```

## Pricing Preview

UI có hai khái niệm pricing liên quan nhưng khác nhau:

- contract quote: giá trị có thể thực thi từ Move function Predict qua
  `devInspect`
- local fair value: xác suất và fallback giải thích từ SVI

Contract quote nên điều khiển:

- contract price
- estimated cost
- gross if win
- potential profit
- risk/reward

SVI fair value nên điều khiển:

- win probability
- degraded preview khi quote không có
- so sánh giải thích giữa quote và fair value

Quy tắc:

- Không trình bày payout chỉ từ SVI như odds thực thi được đảm bảo.
- Nếu quote fail, hiển thị `Preview unavailable` hoặc degraded preview có lý do.
- Không đưa raw Move abort vào UI chính.

## Input Quote

Binary quote cần:

- oracle id
- direction: above hoặc below
- strike
- amount hoặc contract count
- manager hoặc wallet context nếu Move function yêu cầu

Range quote cần:

- oracle id
- lower strike
- upper strike
- amount hoặc contract count
- manager hoặc wallet context nếu Move function yêu cầu

Validation:

- strike phải dương
- lower strike phải nhỏ hơn upper strike
- forward phải dương
- expiry phải ở tương lai
- oracle phải active
- SVI phải có để hiển thị probability

## Mapping Lỗi Quote

UI nên map lỗi thấp tầng thành lý do ngắn:

| Dấu hiệu thấp tầng | Lý do hiển thị |
| --- | --- |
| Move abort trong pricing config | Contract quote từ chối strike hoặc price này |
| missing SVI | SVI unavailable |
| missing forward | Forward price unavailable |
| stale timestamp | Oracle data is stale |
| insufficient balance | Not enough DUSDC |
| liquidity cap failure | Vault liquidity is insufficient |
| unsupported position shape | Position type unsupported in this UI |

## Dữ Liệu Portfolio

Predict Club cần positions theo wallet:

- binary positions
- range positions
- trạng thái open/settled/claimable
- strike hoặc range
- expiry
- entry cost
- potential payout
- oracle id
- manager id

Quy tắc triển khai:

- Range positions vẫn phải hiển thị ngay cả khi UI chưa parse đủ mọi field.
  Dùng row `unsupported` hoặc `details unavailable` thay vì ẩn.

## Dữ Liệu Vault

Predict Club cần:

- available liquidity
- total liquidity
- max payout
- utilization
- total MTM nếu có
- available withdrawal nếu có
- wallet PLP balance
- wallet LP share

Nếu field không resolve được từ server hoặc chain reads, hiển thị
`Unavailable`. Không dùng số demo nếu UI không ghi rõ là demo/local.

## Cache Và Rate Limit

Hành vi cache bắt buộc:

- chia sẻ in-flight request theo `network:address` hoặc `network:oracle`
- cache wallet balances/profile ngắn hạn, hiện tại 30 giây
- cache oracle state và SVI riêng để giải thích stale pricing
- giữ snapshot tốt gần nhất cho wallet profile, manager và vault summaries
- dùng cache khi Sui public RPC trả `429 Too Many Requests`

## Quyền Sở Hữu Dữ Liệu

Khuyến nghị:

- `deepbookOracleService`: đọc oracle, price và SVI từ Predict server
- `deepbookPredictPricingService`: contract quote và PredictManager reads
- module domain `payoutPreview`: SVI fair value và degraded preview output
- `PredictClubContext`: shared app snapshot và risk aggregation
- `sui-wallet-profile`: presentation wallet profile và generic wallet reads

Các panel nên đọc snapshot từ context thay vì tự fetch độc lập.

## Validation

Kiểm tra tối thiểu cho data contract work:

- unit tests cho normalization và display formatting
- tests cho quote error mapping
- tests cho risk aggregation
- Playwright smoke test cho unavailable states
- manual test với active oracle đã biết khi public API/RPC khả dụng
