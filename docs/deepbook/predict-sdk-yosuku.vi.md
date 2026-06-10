# Ghi Chú Về Yosuku DeepBook Predict SDK

Nguồn đã xem ngày 2026-06-10:

- GitHub: <https://github.com/yosuku-lab/predict-sdk>
- npm package: `@yosuku/deepbook-predict`
- Repo HEAD quan sát được: `fa6f5a347585578b5c9ef9d9467a106e3ca96301`
- Tag mới nhất quan sát được: `v0.2.0`

## Vì Sao Quan Trọng

`@yosuku/deepbook-predict` là lớp TypeScript SDK cho DeepBook Predict. SDK này
bổ sung các phần `@mysten/deepbook-v3` không có: SVI pricing, xác suất digital
option, PTB builders cho DeepBook Predict, market/range key builders, typed
indexer và kiểm chứng quote on-chain bằng `devInspect`.

Điều này liên quan trực tiếp tới Predict Club vì preview và execution plan của
chúng ta cũng cần cùng một boundary:

- Preview off-chain từ oracle state, SVI và forward.
- Kiểm chứng quote on-chain từ `predict::get_trade_amounts`.
- Dựng PTB cho mint, range mint, redeem và manager operations.
- Chuẩn hóa scaling giữa USD hiển thị, strike/price 1e9-scaled và DUSDC 6
  decimals.

## Package Shape

Cách cài theo README của repo:

```bash
npm install @yosuku/deepbook-predict @mysten/sui
```

Các điểm chính:

- Package name: `@yosuku/deepbook-predict`
- Tên cũ: `@yosuku/predict`
- Peer dependency: `@mysten/sui ^2.17.0`
- Runtime target: DeepBook Predict testnet
- Main exports: `PredictClient`, `PredictIndexer`, PTB builders, scaling helpers
- Pricing subpath: `@yosuku/deepbook-predict/pricing`

SDK bake sẵn testnet config đã verify cho package/object IDs, DUSDC, PLP, clock
và indexer server. Xem các ID đó như snapshot testnet, không phải mainnet truth
bền vững.

## Pricing Model

SDK dựng lại giá DeepBook Predict từ SVI surface của indexer:

```text
w(k) = a + b * (rho * (k - m) + sqrt((k - m)^2 + sigma^2))
k = ln(strike / forward)
d2 = (ln(forward / strike) - w / 2) / sqrt(w)
price_up = N(d2)
```

Sau đó SDK áp spread model của DeepBook Predict quanh fair price. Điểm triển
khai quan trọng từ changelog: ask được clamp trước, rồi bid mỗi phía được suy
ra từ opposite ask để book không bị crossed ở vùng deep ITM/OTM.

Các constant quan sát trong `src/pricing.ts`:

```text
BASE_SPREAD = 0.02
MIN_SPREAD = 0.005
MIN_ASK = 0.01
MAX_ASK = 0.99
UTIL_MULT = 2.0
```

Với Predict Club, điều này xác nhận không nên dùng multiplier hard-code cho
payout preview. Preview phải derive probability và indicative price từ
`latest_svi`, `forward`, direction/range người dùng chọn và amount.

## Kiểm Chứng Quote On-Chain

SDK có `quoteOnChain` / `getTradeAmountsOnChain`, dựng read-only transaction
kind rồi gọi JSON-RPC `sui_devInspectTransactionBlock` vào:

```text
predict::get_trade_amounts(predict, oracle, key, quantity, clock)
```

Return values được decode thành:

- `mintCost`: DUSDC base units cần để mở position.
- `redeemPayout`: DUSDC base units khi close/redeem position.

Hướng này khớp với Predict Club hiện tại: dùng SVI off-chain cho UI preview
nhanh, rồi dùng `devInspect` làm quote có thẩm quyền trong execution review và
error handling.

## Indexer Endpoints Và Field

SDK chỉ expose các endpoint đã quan sát là có dữ liệu hữu ích:

- `/status`
- `/oracles`
- `/oracles/:id/state`
- `/oracles/:id/prices/latest`
- `/oracles/:id/svi/latest`
- `/positions/minted`
- `/positions/redeemed`
- `/managers`
- `/managers/:id/positions`
- `/predicts/:id/vault/summary`

Ghi chú field quan trọng:

- `oracleState()` trả `{ oracle, latest_price, latest_svi, ask_bounds }`.
- Server trả nhiều numeric field dưới dạng JS number, không phải string.
- Manager positions dùng envelope `{ minted, redeemed }`.
- `?status=` không filter `/oracles` ở server-side; client phải tự filter
  active/settled.
- `?owner=` có filter `/managers` ở server-side.

## Quy Tắc Scaling

Ghi chú scaling của SDK khớp với assumption nên giữ trong Predict Club:

| Domain | Scaling |
|--------|---------|
| Strike / spot / forward / SVI params | 1e9-scaled on-chain |
| DUSDC balances/cost/payout | 6 decimals |
| One contract | `1_000_000` base units = 1 DUSDC max payout |
| Human USD strike | `usd * 1_000_000_000` |

Helper nên mirror hoặc import:

- `usdToScaled(63000)` cho strike input.
- `scaledToUsd(value)` cho strike/spot/forward display.
- `contracts(1)` cho một contract max payout $1.
- `dusdc(value)` cho hiển thị micro-DUSDC.

## Kế Hoạch Tích Hợp Predict Club

1. Đánh giá nên phụ thuộc trực tiếp vào `@yosuku/deepbook-predict` hay port một
   subset nhỏ vào domain layer của repo.
2. Nếu phụ thuộc trực tiếp, pin version và giữ testnet IDs configurable để app
   theo kịp deployment DeepBook Predict.
3. Thay phần payout preview math trùng lặp bằng pricing primitives của SDK hoặc
   parity tests đối chiếu với SDK.
4. Thêm adapter `quoteOnChain` quanh Sui client và JSON-RPC endpoint hiện có cho
   execution review.
5. Thêm tests so sánh output preview với SDK `quote()` cho các strike đại diện:
   deep OTM, near ATM, deep ITM và range cases.
6. Giữ copy UI rõ ràng: off-chain preview là indicative; `devInspect` quote là
   execution gate.

## Câu Hỏi Mở

- SDK cover UP/DOWN và `mintRange` builders, nhưng Predict Club vẫn cần UX
  mapping cục bộ cho ABOVE/RANGE/BELOW và capped payout display.
- Cần verify baked testnet deployment trong SDK có khớp oracle IDs Predict Club
  đang dùng không.
- Range fair value nên được đối chiếu với range builder/key logic của SDK trước
  khi thay thế code preview range hiện tại.
- Package nói `quoteOnChain` browser-safe; vẫn nên test trong Vite/browser bundle
  của repo trước khi dùng trong production UI code.
