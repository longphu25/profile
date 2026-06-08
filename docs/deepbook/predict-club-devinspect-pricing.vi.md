# Ghi Chú DevInspect Pricing Cho Predict Club

Tài liệu này ghi lại cách định giá quan sát được từ UI DeepBook Predict testnet
công khai tại `https://predict.magicdima.xyz` vào ngày 2026-06-06. Dùng tài liệu
này làm tham chiếu khi thay payout preview hiện tại của Predict Club bằng luồng
quote gần với thực thi thật hơn.

## Nguồn Đã Quan Sát

Trang đã kiểm tra:

- `https://predict.magicdima.xyz/oracles/0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951`

Các API server công khai đã thấy:

- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/state`
- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/svi`
- `GET https://predict-server.testnet.mystenlabs.com/oracles/:oracle_id/svi/latest`
- `GET https://predict-server.testnet.mystenlabs.com/trades/:oracle_id`
- `GET https://predict-server.testnet.mystenlabs.com/predicts/:predict_id/oracles`
- `GET https://predict-server.testnet.mystenlabs.com/managers?owner=:wallet`

Các hằng số testnet quan sát được trong bundle công khai:

| Field | Value |
| --- | --- |
| Network | `testnet` |
| Package ID | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict ID | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Quote asset | `DUSDC` |
| Quote decimals | `6` |
| Quote type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| PLP type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Clock ID | `0x6` |

## Luồng Pricing

UI đã quan sát không dùng công thức payout đơn giản kiểu `1 / probability` cho
panel New Position. Nó dựng một Sui transaction rồi gọi
`devInspectTransactionBlock` để quote chi phí mint all-in trước khi người dùng
ký giao dịch.

Với ABOVE và BELOW:

1. Dựng `market_key::new(oracle_id, expiry, strike, is_up)`.
2. Gọi `predict::get_trade_amounts`.
3. Khi thực thi, gọi `predict::mint`.

Với RANGE:

1. Dựng `range_key::new(oracle_id, expiry, low_strike, high_strike)`.
2. Gọi `predict::get_range_trade_amounts`.
3. Khi thực thi, gọi `predict::mint_range`.

Nếu người dùng chưa có PredictManager, UI chuyển qua bước tạo manager trước.
Nếu manager đã tồn tại nhưng thiếu DUSDC, execution phải deposit DUSDC vào
manager trước khi mint.

## Công Thức Hiển Thị Giá Trong UI

Input quantity trên UI là số contract nguyên. Một contract tương ứng
`1_000_000` quote base units vì DUSDC có 6 decimals.

Với:

- `contracts`: số contract nguyên từ UI.
- `mintCost`: chi phí DUSDC đã quote cho toàn bộ contract yêu cầu.
- `grossIfWin`: `contracts * 1 DUSDC`.

UI đã quan sát tính:

```text
contractPrice = mintCost / contracts
estimatedCost = mintCost
grossIfWin = contracts * 1 DUSDC
potentialPayout = grossIfWin - mintCost
riskReward = potentialPayout / mintCost
```

Ghi chú nhãn: label `Potential payout` trong UI đã quan sát thực chất là lợi
nhuận tiềm năng sau khi trừ cost, không phải gross payout. Trong Predict Club
nên ưu tiên nhãn `Potential profit` hoặc hiển thị đồng thời `Cost` và
`Gross if win`.

Ví dụ từ round BTC đã kiểm tra:

```text
Contracts: 100
Contract price: 0.7350 DUSDC
Estimated cost: 73.5019 DUSDC
Gross if win: 100.0000 DUSDC
Potential profit: 26.4981 DUSDC
Risk/Reward: 26.4981 / 73.5019 = 0.36
```

## Công Thức Fair Value Từ SVI

UI cũng hiển thị tham số SVI và có thể suy ra fair value từ oracle state. Phần
này hữu ích để giải thích, validate và fallback, nhưng chưa đủ để tái tạo giá
thực thi all-in vì contract có thể áp spread, utilization và các risk check
khác.

Scale quan sát được:

```text
a = raw_a / 1e9
b = raw_b / 1e9
rho = signed(raw_rho, rho_negative) / 1e9
m = signed(raw_m, m_negative) / 1e9
sigma = raw_sigma / 1e9
```

Với strike `K` và forward `F`:

```text
k = ln(K / F)
d = k - m
w = max(a + b * (rho * d + sqrt(d * d + sigma * sigma)), 2^-52)
vol = sqrt(w)
d2 = -((k + w / 2) / vol)
aboveFair = NormalCDF(d2)
belowFair = 1 - aboveFair
rangeFair = aboveFair(lowStrike) - aboveFair(highStrike)
```

Mẫu từ oracle
`0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951` tại thời
điểm kiểm tra:

```text
Displayed strike: 59,000
Raw strike: 59,000 * 1e9 = 59000000000000
Forward: 60650626321011
Spot: 60654873219100
a: 222080
b: 21762204
rho: -271513412
m: 10044882
sigma: 51985568

k ~= -0.0275925
w ~= 0.00184117
vol ~= 0.0429088
d2 ~= 0.621595
aboveFair ~= 0.732896
```

Điều này giải thích vì sao một contract ABOVE tại `59,000` hiển thị quanh
`0.733-0.735` DUSDC trong lúc oracle và SVI vẫn cập nhật live.

## Kế Hoạch Triển Khai Cho Predict Club

1. Thêm `deepbookPredictPricingService` cho quote preview.
   - Load oracle state từ `/oracles/:id/state`.
   - Load SVI history/latest từ `/oracles/:id/svi` hoặc `/svi/latest` để giải
     thích và kiểm tra stale state.
   - Load manager state từ `/managers?owner=:wallet` khi ví đã kết nối.

2. Triển khai quote path bằng `devInspect`.
   - ABOVE/BELOW: dựng market key và gọi `predict::get_trade_amounts`.
   - RANGE: dựng range key và gọi `predict::get_range_trade_amounts`.
   - Trả về `contractPrice`, `estimatedCost`, `grossIfWin`,
     `potentialProfit`, `riskReward` và raw quote payload.

3. Giữ hàm SVI local làm fair-value fallback.
   - Port `computeFairValue` và `computeRangeFairValue`.
   - Đánh dấu fallback output là `degraded: true`.
   - Hiển thị `Preview unavailable` khi thiếu forward, SVI, strike hoặc
     quantity không hợp lệ.

4. Cập nhật nhãn UI.
   - Đổi `Indicative Payout` thành `Potential profit` nếu số đang hiển thị là
     net profit.
   - Hiển thị `Gross if win` riêng để tránh hiểu nhầm.
   - Giữ `Win Probability` gắn với SVI fair value và đánh dấu approximate nếu
     contract quote không trả metadata xác nhận.

5. Thêm test deterministic.
   - Unit test normalize SVI và fair value ABOVE/BELOW/RANGE.
   - Mock `devInspectTransactionBlock` cho quote preview.
   - Thêm Playwright coverage cho quote hợp lệ, quote unavailable, stale SVI và
     ví đã kết nối nhưng chưa có manager.

## Guardrail Sản Phẩm

- Không trình bày SVI fair value như quote thực thi được đảm bảo.
- Không hiển thị số payout cực lớn từ công thức `1 / probability`.
- Với UI execution, ưu tiên quote từ contract qua `devInspect`.
- Nếu không tạo được quote preview, hiển thị lý do thay vì tự bịa odds.
- Nếu API state có `ask_bounds`, validate average ask với min/max bounds trước
  khi enable execution.

## Portfolio Và Open Contracts

Trang đã quan sát:

- `https://predict.magicdima.xyz/positions`

Tiêu đề trang là `Portfolio`, với mô tả:

```text
Manager-owned BTC/DUSDC positions for the connected wallet.
```

Route này dùng địa chỉ ví đã kết nối để:

1. Query event manager từ Predict server:
   `GET /managers?owner=:wallet`.
2. Chọn manager event mới nhất có `owner` khớp ví đang kết nối.
3. Load Move object của manager bằng `manager_id`.
4. Đọc các field sau từ manager object:
   - `balance_manager`
   - `owner`
   - `positions`
   - `range_positions`
5. Đọc số dư DUSDC trong manager từ dynamic fields của BalanceManager.
6. Chỉ đọc bảng binary `positions` để hiển thị.

Manager object đã có đủ metadata cho cả hai bảng:

```text
positionsSize = manager.positions.fields.size
rangePositionsSize = manager.range_positions.fields.size
hasPositions = positionsSize > 0 || rangePositionsSize > 0
```

Tuy vậy, route hiện tại chỉ gọi loader cho binary positions. Nó chưa page qua
`range_positions`, nên RANGE positions đã được biết ở mức metadata manager
nhưng chưa được chart hoặc list.

Shape binary position quan sát được từ bundle:

```ts
interface BinaryManagerPosition {
  id: string
  oracleId: string
  expiry: number
  isUp: boolean
  strike: number
  quantity: bigint
}
```

Table hiển thị:

- oracle link
- side: ABOVE hoặc BELOW
- strike
- quantity
- cost preview
- PnL preview
- expiry
- settlement
- state
- close action

Với oracle active, cost và live close preview dùng
`predict::get_trade_amounts` qua `devInspect`. Với oracle settled, payout được
tính local từ `settlement_price`:

```text
ABOVE thắng khi settlement_price > strike
BELOW thắng khi settlement_price <= strike
settled redeem payout = quantity nếu thắng, ngược lại 0
```

Close flow dựng một transaction do ví ký gồm:

1. Gọi `predict::redeem` hoặc `predict::redeem_permissionless`.
2. Gọi `predict_manager::withdraw` cho phần DUSDC payout dương.
3. Transfer DUSDC đã withdraw về ví đang kết nối.

### Vì Sao RANGE Chưa Hiển Thị

UI public ghi rõ `Range positions are not displayed yet` ở chart header và phần
helper text của table. Component chart chỉ hiểu:

```ts
direction: 'ABOVE' | 'BELOW'
strike: number
quantity: number
upQuantity: number
downQuantity: number
```

Nó chưa có model range key với `lowStrike` và `highStrike`. Muốn support RANGE
positions cần thêm loader, chart bucket, renderer cho row, close preview và
settled payout rule riêng.

Predict Club nên xem đây là gap sản phẩm thật, không chỉ là chỉnh text UI.

Kế hoạch triển khai:

1. Thêm `loadBinaryManagerPositions(manager.positionsTableId)`.
2. Thêm `loadRangeManagerPositions(manager.rangePositionsTableId)`.
3. Biểu diễn portfolio row bằng discriminated union:

   ```ts
   type PortfolioPosition =
     | { kind: 'binary'; oracleId: string; expiry: number; isUp: boolean; strike: number; quantity: bigint }
     | { kind: 'range'; oracleId: string; expiry: number; lowStrike: number; highStrike: number; quantity: bigint }
   ```

4. Dùng `predict::get_trade_amounts` cho binary close preview.
5. Dùng `predict::get_range_trade_amounts` cho RANGE close preview.
6. Với settled RANGE payout, phải xác nhận semantics contract trước khi ship.
   Rule có khả năng là `lowStrike < settlement_price <= highStrike`, nhưng cần
   verify bằng Move code hoặc một settled RANGE position đã quan sát được.
7. Cập nhật chart để binary và range positions có cách hiển thị khác nhau.
8. Thêm table rows cho RANGE với low/high strikes và close action.
9. Thêm test cho manager chỉ có range positions, manager mixed binary/range,
   active close preview, settled payout và oracle state unavailable.

## Vaults

Trang đã quan sát:

- `https://predict.magicdima.xyz/vaults`

Đây là giao diện LP cho shared DUSDC vault của Predict. Wallet có thể supply
DUSDC liquidity để nhận PLP shares, hoặc burn PLP shares để withdraw DUSDC.

Headline của UI:

```text
Supply DUSDC liquidity or withdraw by burning PLP shares.
```

### Nguồn State

Vault state được đọc từ Predict Move object:

```text
Predict ID: 0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
```

Các field quan sát được:

```text
treasury_cap.total_supply.fields.value -> tổng PLP supply
vault.balance                         -> số dư DUSDC vault
vault.total_mtm                       -> estimated open position payout / mark-to-market
vault.total_max_payout                -> max payout exposure
withdrawal_limiter.available          -> limiter available
withdrawal_limiter.capacity           -> limiter capacity
withdrawal_limiter.enabled            -> trạng thái limiter
```

Giá trị suy ra:

```text
vaultValue = vault.balance - vault.total_mtm
availableLiquidity = max(vault.balance - vault.total_max_payout, 0)
availableWithdrawal = min(predict::available_withdrawal(), availableLiquidity)
```

Khi withdrawal limiter disabled, `predict::available_withdrawal()` có thể cao
hơn `availableLiquidity`, nên UI vẫn cap withdrawable amount theo max-payout
coverage.

### Vị Thế Wallet Trong Vault

UI đọc balance của wallet cho:

- DUSDC quote asset.
- PLP shares.

Wallet LP share:

```text
walletLpShare = walletPlpBalance / totalPlpSupply
```

### Công Thức Supply Và Withdraw

Với supply, input là DUSDC và estimated output là PLP:

```text
if totalPlpSupply == 0 or vaultValue <= 0:
  estimatedPlp = inputDusdc
else:
  estimatedPlp = inputDusdc * totalPlpSupply / vaultValue
```

Với withdraw, input là PLP và estimated output là DUSDC:

```text
if totalPlpSupply == 0:
  estimatedDusdc = 0
else:
  estimatedDusdc = inputPlp * vaultValue / totalPlpSupply
```

Validation:

- Wallet phải connected.
- Vault data phải load xong.
- Supply amount không được vượt wallet DUSDC balance.
- Withdraw amount không được vượt wallet PLP balance.
- Withdraw output không được vượt `availableWithdrawal`.

### Transactions

Supply dựng wallet-signed transaction:

```text
predict::supply<DUSDC>(predict_id, dusdc_coin, clock)
transfer PLP trả về cho wallet
```

Withdraw dựng wallet-signed transaction:

```text
predict::withdraw<DUSDC>(predict_id, plp_coin, clock)
transfer DUSDC trả về cho wallet
```

### Activity

Trang đọc liquidity activity từ:

```text
GET https://predict-server.testnet.mystenlabs.com/lp/supplies
GET https://predict-server.testnet.mystenlabs.com/lp/withdrawals
```

Chart gom supply/withdrawal events theo ngày cho 14 ngày gần nhất. UI hỗ trợ
log và linear display. Table hiển thị 25 event mới nhất.

Field supply event được dùng:

```text
amount
checkpoint
checkpoint_timestamp_ms
event_digest
event_index
sender
shares_minted
supplier
```

Field withdrawal event được dùng:

```text
amount
checkpoint
checkpoint_timestamp_ms
event_digest
event_index
sender
shares_burned
withdrawer
```

### Probe Script

Repo hiện có script read-only để probe luồng wallet/oracle:

```bash
rtk bun scripts/predict-club-probe.mjs \
  --wallet 0x70b56e23fff713cc617cc8e14f3c947e9ee9ced42547fcd952b69df4bee32f70 \
  --oracle 0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951 \
  --side above \
  --strike 59000 \
  --contracts 100
```

Script báo:

- balance SUI, DUSDC và PLP của wallet
- PredictManager events của wallet
- latest manager object, table id và manager DUSDC balance
- oracle state và SVI
- vault state, PLP supply, wallet LP share, withdrawal limiter, LP activity
- SVI fair-value preview
- quote contract `devInspect` cho New Position

Kết quả quan sát với wallet trên vào 2026-06-06:

```text
Wallet DUSDC: 4589.999977
Wallet PLP: 9.98825
Latest manager: 0xe90434f33f278143075900b8b0e0bf5af8570808ff0d26251e259f69318975a4
Manager DUSDC: 41.750257
Binary positions size: 1
Range positions size: 0

Vault balance: 1,013,120.593474 DUSDC
Estimated open position payout: 475.684153 DUSDC
Total max payout: 1,358.041785 DUSDC
Vault value: 1,012,644.909321 DUSDC
Total PLP supply: 1,009,842.026186 PLP
Wallet LP share: khoảng 0.0010%

New Position ABOVE 59,000, 100 contracts:
SVI fair probability: khoảng 75.1%
Contract price: khoảng 0.75968 DUSDC
Estimated cost: khoảng 75.968 DUSDC
Potential profit: khoảng 24.032 DUSDC
Risk/Reward: khoảng 0.316
```

Quote chính xác thay đổi theo oracle price và SVI live.

### Hàm Ý Cho Predict Club

- Execution panel của Predict Club nên hiển thị vault liquidity và max-payout
  coverage khi quote trade.
- `availableWithdrawal` quan trọng cho UX LP withdraw, không phải điều kiện ký
  trade của member, nhưng cùng vault state giúp giải thích liquidity risk.
- PLP supply và wallet LP share có thể thành view "club LP" riêng nếu sản phẩm
  hỗ trợ group liquidity provision sau này.
- Không trộn manager DUSDC balance với wallet DUSDC balance; wallet có thể có
  DUSDC nhưng manager vẫn cần deposit trước khi mint.

### Triển Khai Hiện Tại Trong Predict Club - 2026-06-07

UI hiện dùng một pricing snapshot duy nhất cho round đang hoạt động:

- `deepbookPredictPricingService` đọc Predict server oracle state và latest SVI,
  rồi build SVI fair-value preview local.
- Cùng service gọi quote contract Predict dạng read-only qua
  `devInspectTransactionBlock`:
  - ABOVE/BELOW: `predict::get_trade_amounts`
  - RANGE: `predict::get_range_trade_amounts`
- `Win Probability` đến từ SVI fair value.
- `Contract Price`, `Estimated Cost`, `Gross If Win`, `Potential Profit` và
  `Risk/Reward` đến từ quote contract.
- Nếu quote contract không có, UI hiển thị `Contract quote unavailable` kèm lý
  do thay vì fallback sang multiplier hard-code.
- Context portfolio manager-owned được đọc từ bảng binary `positions` và bảng
  RANGE `range_positions` trong manager object.
- Context vault được đọc từ shared Predict object và gồm total balance, MTM, max
  payout, available liquidity, available withdrawal, total PLP supply, wallet
  PLP balance và wallet LP share.

Ghi chú công thức:

```text
estimatedCost = mintCost / 10^6
grossIfWin = requestedContractQuantity / 10^6
potentialProfit = max(grossIfWin - estimatedCost, 0)
riskReward = potentialProfit / estimatedCost
rewardMultiple = grossIfWin / estimatedCost
```

SVI parameters từ Predict server dùng scale 1e9:

```text
a = raw.a / 1e9
b = raw.b / 1e9
rho = sign(raw.rho_negative) * raw.rho / 1e9
m = sign(raw.m_negative) * raw.m / 1e9
sigma = raw.sigma / 1e9
```

Ranh giới hiện tại:

- `devInspect` là quote, không phải execution. Ví thật vẫn phải ký transaction
  và kết quả on-chain cuối có thể thay đổi nếu oracle price/SVI đổi trước khi
  ký.
- `Win Probability` và contract cost là hai nguồn liên quan nhưng không giống
  nhau: SVI fair value ước tính xác suất, còn contract quote trả về mint cost và
  payout amounts hiện tại.
- Test mock contract-quote vẫn còn pending; unit test deterministic hiện cover
  scale SVI, binary/range fair value và hành vi unavailable khi thiếu SVI.
