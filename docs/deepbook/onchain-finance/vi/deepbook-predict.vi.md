# DeepBook Predict

> **Chỉ Testnet** — DeepBook Predict hiện là target tích hợp Testnet. Mainnet đã lên kế hoạch. Package ID sẽ thay đổi khi launch.

## Tổng quan

DeepBook Predict là **prediction market dựa trên expiry** trên Sui, nơi mọi strike và expiry được định giá theo bề mặt biến động (volatility surface) SVI on-chain. User mint binary positions (UP/DOWN) hoặc vertical ranges, và một vault dùng chung lấy phía đối lập của mọi giao dịch. LP supply quote asset tới vault và nhận `PLP` LP shares.

Đây **không phải** event-betting market thông thường — đó là protocol options-like với expiry rolling sub-hour trên BTC.

## Khi nào dùng

- Build frontend prediction market với pricing vol-aware
- Chạy bot vol-arb giữa Predict và option market khác
- Cung cấp liquidity (LP) để earn yield trên book được hedge
- Compose với `deepbook_margin` và `iron_bank` cho strategy leverage

## Khái niệm cốt lõi

### 4 shared object chính

```
Predict (singleton)
├── Giữ vault balances, pricing config, risk config
├── Quote-asset allowlist
├── Oracle strike grids
├── Withdrawal-limiter config
└── PLP TreasuryCap

PredictManager (per user)
├── Wrap BalanceManager
├── Lưu deposited quote balances
├── Track binary position quantities (table key bằng MarketKey)
└── Track vertical range quantities (table key bằng RangeKey)

OracleSVI (per asset+expiry)
├── Spot price
├── Forward price
├── Tham số volatility SVI
├── Lifecycle status
├── Last update timestamp
└── Settlement price (sau expiry)

Vault (bên trong Predict)
├── Số dư accepted quote asset
├── Mark-to-market liability
├── Maximum payout
└── State settled-oracle compact
```

## Loại vị thế

### Binary positions (nhị phân)

Key: `(oracle_id, expiry, strike, is_up)`

```move
struct MarketKey has copy, drop, store {
  oracle_id: ID,
  expiry: u64,
  strike: u64,
  direction: u8,  // 0 = up, 1 = down
}
```

- **UP position** — trả tiền nếu `settlement_price > strike`
- **DOWN position** — trả tiền nếu `settlement_price < strike`
- Định giá từ oracle fair price + protocol spread + utilization adjustment

### Vertical ranges (dải dọc)

Key: `(oracle_id, expiry, lower_strike, higher_strike)`

```move
struct RangeKey has copy, drop, store {
  oracle_id: ID,
  expiry: u64,
  lower_strike: u64,
  higher_strike: u64,
}
```

- Trả tiền khi `settlement_price ∈ (lower_strike, higher_strike]`
- Định giá như 1 instrument có giới hạn
- Hiệu quả vốn hơn binary cho góc nhìn range-bound

## Vòng đời Oracle

```
Inactive → Active → Pending Settlement → Settled
```

| State | Cho mint | Cho redeem | Cho update |
|-------|----------|------------|------------|
| Inactive | ❌ | ❌ | ❌ |
| Active | ✅ | ✅ (giá live) | ✅ |
| Pending Settlement | ❌ | ✅ (giá live) | Lần đầu sau expiry → đóng băng |
| Settled | ❌ | ✅ (giá settlement) | ❌ |

## Bề mặt volatility SVI

Oracle lưu 5 tham số SVI mô hình toàn bộ smile:

```
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
IV(K) = √(w(k) / T) × 100%
```

Trong đó:
- `k = ln(K/F)` — log-moneyness (K = strike, F = forward)
- `a` — mức biến động tổng (dịch dọc)
- `b` — slope (kiểm soát dốc cánh)
- `ρ` — skew (-1 đến 1, âm = put skew)
- `m` — dịch ngang của smile minimum
- `σ` — độ cong tại đỉnh (mượt ATM)
- `T` — time to expiry tính theo năm

### Mã hoá tham số on-chain

| Tham số | Format | Decode |
|---------|--------|--------|
| `a`, `b`, `m`, `sigma` | integer | `÷ 1e6` |
| `rho` | integer + `rho_negative` bool | `÷ 1e9`, đổi dấu nếu flag |
| `spot`, `forward`, `strike` | integer | `÷ 1e9` (USD) |

### Kiểm tra arbitrage butterfly

Cho 3 strike liên tiếp K₁ < K₂ < K₃:

```
IV_kỳ_vọng(K₂) = w·IV(K₁) + (1−w)·IV(K₃)
trong đó w = (K₃ − K₂) / (K₃ − K₁)
```

Vi phạm nếu `IV(K₂) > IV_kỳ_vọng × 1.02`. Cho thấy có cơ hội arbitrage.

## Kế toán Vault

```
vault_value = vault_balance − total_MTM
PLP_share_price = vault_value / total_PLP_supply
utilization = total_MTM / vault_value
max_payout_utilization = total_max_payout / vault_balance
available_liquidity = vault_balance − total_max_payout
```

### Tính LP share

```
new_shares = deposit_amount × (total_PLP_supply / vault_value)
```

Supplier đầu tiên nhận shares 1:1 với deposit. Sau đó nhận tỷ lệ với vault value.

### Vault risk

Vault lấy **phía đối lập** mọi trade — là counterparty. LP risk:

- BTC chạy ngược position → MTM tăng → vault value giảm → PLP price giảm
- Crash: nhiều DOWN binary thành ITM → vault payout → PLP loss

## Luồng người dùng

### Trader flow

```
1. Lấy oracle data từ Predict server công khai
2. Chọn oracle active và strike (phải align với tick_size)
3. Tạo hoặc tìm 1 PredictManager
4. Deposit DUSDC vào manager
5. Preview mint amount qua server
6. Submit tx mint_position hoặc mint_range
7. (Optional) Redeem trước expiry tại live oracle
8. Sau settlement: redeem tại settlement price
```

### LP flow

```
1. Check vault summary (balance, utilization, share price)
2. Gọi predict::supply với DUSDC amount
3. Nhận PLP shares tỷ lệ vault value
4. Earn yield từ vault PnL (đối nghịch loss của trader)
5. Withdraw bằng burn PLP — phụ thuộc available liquidity
```

## Pricing và risk

### Thành phần pricing

```
mint_cost = oracle_fair_price + protocol_spread + utilization_adjustment
```

- **oracle_fair_price** — derive từ SVI surface
- **protocol_spread** — bid/ask spread set bởi governance
- **utilization_adjustment** — tăng khi vault utilization tăng

### Enforce risk

Sau mỗi mint, vault assert:

```
total_MTM ≤ max_total_exposure_pct × vault_balance
```

Nếu mint vượt ngưỡng, tx abort. Bảo vệ LP khỏi over-exposure.

### Ask bounds

- **Global ask bounds** — max ask price toàn protocol cho bất kỳ oracle
- **Per-oracle ask bounds** — limit chặt hơn per oracle (set bởi oracle cap)

Mint với ask price post-spread nằm ngoài bounds bị reject.

## Validate strike

```
strike >= min_strike  AND  (strike − min_strike) % tick_size == 0
```

Ví dụ oracle:
- `min_strike` = `50_000_000_000_000` (= $50,000)
- `tick_size` = `1_000_000_000` (= $1)

Strike hợp lệ: $50,000, $50,001, $51,000, $75,000, ...
Không hợp lệ: $49,500 (dưới min), $50,000.50 (không align).

## Contract IDs (testnet, predict-testnet-4-16)

```
Predict Package:        0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
Predict Object:         0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
Predict Registry:       0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
Quote Asset (DUSDC):    0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
PLP Coin Type:          {package}::plp::PLP
Public Server:          https://predict-server.testnet.mystenlabs.com
```

## Endpoints public server

### State protocol & market

- `GET /status` — server health
- `GET /predicts/:id/state` — config protocol
- `GET /predicts/:id/oracles` — list oracles
- `GET /oracles/:id/state` — oracle detail (spot, forward, SVI)
- `GET /predicts/:id/quote-assets` — accepted quote assets
- `GET /oracles/:id/ask-bounds` — resolved ask bounds

### Vault & LP

- `GET /predicts/:id/vault/summary` — vault metrics
- `GET /predicts/:id/vault/performance?range=ALL` — lịch sử PLP share price
- `GET /lp/supplies` — lịch sử supply
- `GET /lp/withdrawals` — lịch sử withdrawal

### Manager & portfolio

- `GET /managers` — tất cả PredictManagers
- `GET /managers/:id/summary` — manager summary
- `GET /managers/:id/positions/summary` — open positions
- `GET /managers/:id/pnl?range=ALL` — manager PnL

### Lịch sử

- `GET /oracles/:id/prices` — lịch sử giá
- `GET /oracles/:id/svi` — lịch sử SVI parameters
- `GET /positions/minted` — lịch sử mint toàn cục
- `GET /positions/redeemed` — lịch sử redeem toàn cục
- `GET /ranges/minted`, `GET /ranges/redeemed` — lịch sử range
- `GET /trades/:oracle_id` — trades per oracle

## Tham chiếu hàm on-chain

### Tạo manager

```move
public fun predict::create_manager(ctx: &mut TxContext): ID
```

Tạo `PredictManager` shared, trả `ID`. **Object thực ra là shared** — phải query qua indexer hoặc events để dùng trong tx tiếp theo.

### Mint binary

```move
public fun predict::mint<T>(
  predict: &mut Predict,
  manager: &mut PredictManager,
  oracle: &OracleSVI,
  market_key: MarketKey,
  amount: u64,
  clock: &Clock,
  ctx: &mut TxContext,
)
```

`market_key` phải construct qua `market_key::new(oracle_id, expiry, strike, direction)`.

### Mint range

```move
public fun predict::mint_range<T>(
  predict: &mut Predict,
  manager: &mut PredictManager,
  oracle: &OracleSVI,
  range_key: RangeKey,
  amount: u64,
  clock: &Clock,
  ctx: &mut TxContext,
)
```

`range_key` phải construct qua `range_key::new(oracle_id, expiry, lower, higher)`.

### Redeem

```move
public fun predict::redeem<T>(...)
public fun predict::redeem_range<T>(...)
public fun predict::redeem_permissionless(...)  // cho settled positions
```

### Vault operations

```move
public fun predict::supply<T>(...)    // DUSDC → PLP
public fun predict::withdraw<T>(...)  // PLP → DUSDC
public fun predict::compact_settled_oracle(...)  // optimize gas
```

## Theo dõi event live

Subscribe các event sau cho update oracle low-latency:

- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

Filter theo `package = PREDICT_PACKAGE`.

## Bẫy thường gặp

### Manager không tìm thấy trong cùng PTB

`create_manager` trả `ID`, không phải object reference. `PredictManager` thực ra shared. **Không thể dùng trong cùng PTB.** Tách thành 2 transactions:

```
TX 1: predict::create_manager → đợi indexer → fetch manager_id
TX 2: tx.object(manager_id) → predict::mint_range(...)
```

### Strike phải align tick

```typescript
// ❌ Sai — giá USD random
const strikeRaw = Math.floor(75000.5 * 1e9)  // không align

// ✅ Đúng — snap về tick
const minStrike = 50_000_000_000_000
const tickSize = 1_000_000_000
const aligned = minStrike + Math.round((75000 * 1e9 - minStrike) / tickSize) * tickSize
```

### Cần type argument

`mint`, `mint_range`, `supply`, `withdraw` là generic theo `T`. Luôn pass:

```typescript
typeArguments: [DUSDC_TYPE]
```

### Object Clock

Mọi hàm trading cần system Clock tại `0x6`:

```typescript
arguments: [..., tx.object('0x6')]
```

## TypeScript SDK

SDK `@mysten/deepbook-v3` chưa có Predict bindings. Phải build PTB thủ công:

```typescript
import { Transaction } from '@mysten/sui/transactions'

const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const DUSDC_TYPE = '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'

// Mint range position
const tx = new Transaction()
tx.setSender(walletAddress)

const rangeKey = tx.moveCall({
  target: `${PREDICT_PACKAGE}::range_key::new`,
  arguments: [
    tx.pure.id(oracleId),
    tx.pure.u64(expiry),
    tx.pure.u64(lowerStrikeRaw),
    tx.pure.u64(upperStrikeRaw),
  ],
})

tx.moveCall({
  target: `${PREDICT_PACKAGE}::predict::mint_range`,
  typeArguments: [DUSDC_TYPE],
  arguments: [
    tx.object(PREDICT_ID),
    tx.object(managerId),
    tx.object(oracleId),
    rangeKey[0],
    tx.pure.u64(amountRaw),
    tx.object('0x6'),
  ],
})
```

## Ví dụ composability

### PLP + Hedge Vault

Supply DUSDC vào vault để earn yield. Mua OTM DOWN binary để cap left-tail drawdown. Net position = "PLP yield trừ crash insurance."

```
Capital: $5,000
- 80% supply vào PLP (earn yield)
- 20% mua DOWN binary tại strike -10% (insurance)

BTC ổn định: earn PLP yield, hedge expire vô giá trị
BTC crash: hedge payout, bù lại PLP loss
```

### Three-Protocol Margin Loop

Stack iron_bank + deepbook_margin + predict trong 1 PTB:

```
1. iron_bank::deposit(USDC) → USDsui shares
2. deepbook_margin::borrow(USDsui làm collateral) → dUSDC
3. predict::mint_range(dUSDC) × N positions
4. Tại settlement: payouts trả nợ margin, phần dư = lợi nhuận
```

Đường liquidation: nếu LTV vi phạm ngưỡng, đóng predict → trả margin → withdraw iron_bank.

## Hạn chế

- Chỉ Testnet (mainnet ID sẽ thay đổi)
- Cần DUSDC (request qua tally form)
- Hiện chỉ active oracle BTC (expiry sub-hour)
- Không có preview mint client-side — pricing tính on-chain
- LP risk không cap trên upside (vault hứng tất cả gain của trader)
- 1 oracle per expiry — chưa có multi-leg strategy

## Liên quan

- [DeepBookV3](./deepbookv3.vi.md) — quote asset (DUSDC) borrow từ layer này
- [DeepBook Margin](./deepbook-margin.vi.md) — composable cho leverage
- [Closed-Loop Token](./closed-loop-token.vi.md) / [PAS](./pas.vi.md) — DUSDC có thể là CLT/PAS trong tương lai
- [SDK Reference](./sdk-reference.vi.md) — code examples
- [Plugin source](../../../../plugins/sui-deepbook-predict/) — reference implementation đầy đủ
- [Test token request](https://tally.so/r/Xx102L)
