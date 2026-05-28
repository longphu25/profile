# DeepBookV3 — CLOB Phi tập trung trên Sui

## Tổng quan

DeepBookV3 là Central Limit Order Book (CLOB) hoàn toàn on-chain trên Sui. Tận dụng parallel execution và phí thấp của Sui để xây sàn giao dịch hiệu năng cao tại protocol layer. Khác với AMM, mọi order khớp với order book thật.

DeepBookV3 **không** kèm UI. Nó expose Move modules + TypeScript SDK để DEX, ví, app trading build trên đó.

## Khi nào dùng

- Build DEX spot hoặc trading frontend trên Sui
- Thêm trading limit-order vào ví
- Chạy bot market-making, arbitrage, volume
- Compose với margin (`deepbook_margin`) hoặc prediction (`deepbook_predict`)

## Kiến trúc (3 shared object)

```
Pool (1 cho mỗi market)
├── Book   — orders + matching engine
├── State  — governance, history, accounts
└── Vault  — funds + DEEP price oracle

PoolRegistry (singleton)
└── Track tất cả pools, ngăn duplicate, enforce versioning

BalanceManager (1 cho user, dùng chung mọi pool)
└── Giữ funds của user để trade
```

### Pool

Object shared chính. Public function nhận `&mut Pool` hoặc `&Pool`. Mỗi Pool đại diện 1 market (vd `SUI/USDC`). 3 component nội bộ:

#### Book

Quản lý matching engine. Giữ 2 `BigVector<Order>` cho bids và asks, kèm metadata.

- `OrderInfo` — full data của order với fills tích luỹ trong matching
- `Order` — order compact lưu trong book (data tối thiểu để match)
- `Fill` — record match (1 phần hoặc đầy đủ)

Khi place order: tạo `OrderInfo`, match với phía đối lập (tích fills), phần còn lại convert thành `Order` compact và inject vào book.

#### State

3 sub-module:

- **Governance** — fees pool và yêu cầu stake, được DEEP staker vote mỗi epoch
- **History** — volume tích luỹ, fees collected, fees to burn (theo epoch và history)
- **Account** — data per-user (volume, stake, vote, rebate chưa claim, settled/owed)

Mỗi tx kích hoạt `process_create` để tính phí, update accounts, sinh ra tuple settled/owed cho Vault apply.

#### Vault

Quản lý transfer token vật lý giữa pool và `BalanceManager`:

```move
public fun settle_balance_manager(...) {
  // So sánh balances_in vs balances_out
  // Nếu out > in: vault deposit chênh lệch vào BM
  // Nếu in > out: vault withdraw chênh lệch từ BM
  // Lặp cho base, quote, DEEP
}
```

Cũng lưu `DeepPrice` struct với tối đa 100 data point từ pool whitelisted DEEP/USDC hoặc DEEP/SUI. Dùng để convert phí trade sang DEEP.

### BalanceManager

Account user dùng lại được. **1 BalanceManager dùng cho tất cả pool.** Cung cấp:

- Deposit/withdraw bất kỳ coin type
- Sinh proof-of-ownership để trade
- Mint capabilities: `TradeCap`, `DepositCap`, `WithdrawalCap` (uỷ quyền)

```move
public struct BalanceManager has key {
  id: UID,
  owner: address,
  balances: Bag,  // coin_type → Balance
}
```

### PoolRegistry

Singleton dùng khi tạo pool. Enforce uniqueness (không có cặp `(base, quote)` trùng) và track version package.

### BigVector

Cấu trúc dữ liệu tự build cho order book — B+ tree on-chain:

- Truy cập gần như constant time (log base `max_fan_out`)
- Insert, remove, iterate
- Mỗi node lưu thành dynamic field riêng

## Token DEEP & tokenomics

DEEP là utility token. Dùng cho:

- **Trading fees** — pay bằng DEEP rẻ hơn ~20% so với input token
- **Staking** — giảm taker fee 1 nửa (xuống 0.25 bps stable / 2.5 bps volatile)
- **Governance** — vote per-pool trade params mỗi epoch

### Cấu trúc phí (governance bound)

| Loại pool | Side | Min bps | Max bps |
|-----------|------|---------|---------|
| Volatile | Taker | 1 | 10 |
| Volatile | Maker | 0 | 5 |
| Stable | Taker | 0.1 | 1 |
| Stable | Maker | 0 | 0.5 |
| Whitelisted | Both | 0 | 0 |

### Voting power

```
V = min(S, V_c) + max(S - V_c, 0)
trong đó V_c = 100,000 DEEP (cutoff)
```

Quorum = 1/2 tổng voting power. Proposal/vote reset mỗi epoch. User submit/vote từ epoch sau khi stake.

### Maker rebates

Maker đủ điều kiện (DEEP stake đủ + đóng góp volume maker) hưởng rebate:

```
Incentives_i = max[F_i × (1 + ΣF_j∈M̄ / ΣF_j∈M) × (1 - (ΣL_j - L_i) / p), 0]
```

Trong đó `M` = makers stake đủ, `M̄` = không đủ, `F_i` = fees từ volume của maker i, `L_i` = liquidity cung cấp, `p` = phaseout point. Nếu volume pool vượt median 28 ngày, không có rebate. Max rebate per epoch = tổng DEEP collected.

## Luồng đặt order

```
User submit order
  ↓
Pool.place_order_int(...)
  ↓
1. Tạo OrderInfo (với input params)
  ↓
2. Book.create_order
   ├── Validate inputs (quantity, price, expiry, type)
   ├── Match phía đối lập → tích Fills
   └── Nếu còn qty: insert thành Order vào BigVector
  ↓
3. State.process_create
   ├── Update maker accounts từ Fills
   ├── Tính taker fee (giảm theo stake nếu đủ điều kiện)
   ├── Update history với fees collected
   └── Tính settled (base, quote, deep) và owed (base, quote, deep)
  ↓
4. Vault.settle_balance_manager
   └── Apply settled/owed lên BalanceManager của caller
```

## Loại order

```typescript
enum OrderType {
  NO_RESTRICTION = 0,       // limit chuẩn, có thể match
  IMMEDIATE_OR_CANCEL = 1,  // IOC: fill được bao nhiêu, huỷ phần dư
  FILL_OR_KILL = 2,         // FOK: fill all hoặc nothing
  POST_ONLY = 3,            // không bao giờ take, chỉ make
}
```

## Chống self-match

```typescript
enum SelfMatchingOptions {
  SELF_MATCHING_ALLOWED = 0,
  CANCEL_TAKER = 1,    // huỷ taker mới nếu match maker của chính mình
  CANCEL_MAKER = 2,    // huỷ maker cũ nếu match taker của chính mình
}
```

## State Account

Mỗi `Account` (1-1 với `BalanceManager`) track:

- **Settled balances** — pool nợ user (vault trả ra ở tx kế tiếp)
- **Owed balances** — user nợ pool (vault trừ ở tx kế tiếp)
- Maker rebates chưa claim (per-epoch, claim qua `claimRebates`)
- Stake active và proposal đã vote
- Volume cho epoch hiện tại

## Pool ví dụ

### Pool mainnet (chọn lọc)

| Cặp | Pool key | Base scalar | Quote scalar |
|-----|----------|-------------|--------------|
| SUI/USDC | `SUI_USDC` | 1e9 | 1e6 |
| DEEP/SUI | `DEEP_SUI` | 1e6 | 1e9 |
| WAL/USDC | `WAL_USDC` | 1e9 | 1e6 |
| XBTC/USDC | `XBTC_USDC` | 1e8 | 1e6 |
| WBTC/USDC | `WBTC_USDC` | 1e8 | 1e6 |

### Pool testnet

| Cặp | Pool key | Ghi chú |
|-----|----------|---------|
| SUI/DBUSDC | `SUI_DBUSDC` | Dùng cho ví dụ SDK |
| DEEP/SUI | `DEEP_SUI` | Pool fee-payment DEEP |
| DBTC/DBUSDC | `DBTC_DBUSDC` | Cặp BTC test |

Pool definitions ship trong `@mysten/deepbook-v3` qua `mainnetPools` / `testnetPools`.

## Contract IDs (mainnet)

```
DEEPBOOK_PACKAGE_ID:  0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748
REGISTRY_ID:          0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d
DEEP_TREASURY_ID:     0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe
```

## Contract IDs (testnet)

```
DEEPBOOK_PACKAGE_ID:  0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c
REGISTRY_ID:          0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1
DEEP_TREASURY_ID:     0x69fffdae0075f8f71f4fa793549c11079266910e8905169845af1f5d00e09dcb
```

## Tham khảo nhanh TypeScript SDK

Xem [sdk-reference.vi.md](./sdk-reference.vi.md) để biết API đầy đủ. Pattern thường gặp:

```typescript
import { DeepBookClient, mainnetPools, mainnetCoins } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'

const dbClient = new DeepBookClient({
  client: new SuiGrpcClient({ network: 'mainnet', baseUrl: '...' }),
  network: 'mainnet',
  address: walletAddress,
  pools: mainnetPools,
  coins: mainnetCoins,
  balanceManagers: { main: { address: bmId } },
})

// Place limit order
const tx = new Transaction()
tx.add(dbClient.deepBook.placeLimitOrder({
  poolKey: 'SUI_USDC',
  balanceManagerKey: 'main',
  clientOrderId: Date.now().toString(),
  price: 1.5,
  quantity: 10,
  isBid: true,
  orderType: OrderType.NO_RESTRICTION,
  payWithDeep: true,
}))
```

## Indexer

Endpoint công khai DeepBookV3 Indexer:

- Mainnet: `https://deepbook-indexer.mainnet.mystenlabs.com`
- Testnet: `https://deepbook-indexer.testnet.mystenlabs.com`

Endpoint thường dùng:

| Endpoint | Trả về |
|----------|--------|
| `GET /get_pools` | Metadata pool (lot_size, min_size, decimals) |
| `GET /summary` | Volume 24h + thay đổi giá per pool |
| `GET /ticker` | last_price hiện tại per pool |
| `GET /orderbook/:pool?level=2&depth=N` | Bids + asks |
| `GET /trades/:pool` | Trades gần đây |
| `GET /historical_volume/:pool` | OHLCV lịch sử |
| `GET /orders/:pool/:bm_id` | Open orders của user |

## Lỗi thường gặp

### Pool không có trong SDK

```
Error: Pool X not in SDK
```

Đảm bảo `pools` config có pool key. Dùng `mainnetPools` / `testnetPools` từ SDK hoặc define custom.

### Swap trả 3 coin

`swapExactBaseForQuote` và `swapExactQuoteForBase` trả `[baseCoin, quoteCoin, deepCoin]`. Phải transfer cả 3:

```typescript
// ❌ Sai — UnusedValueWithoutDrop
const [base] = db.deepBook.swapExactBaseForQuote(...)(tx)
tx.transferObjects([base], owner)

// ✅ Đúng
const result = db.deepBook.swapExactBaseForQuote(...)(tx)
tx.transferObjects([...result], owner)
```

### Đừng pass `packageIds` cho margin

Cho margin operations, để SDK auto-resolve:

```typescript
// ❌ Sai — gây marginPools = {}
new DeepBookClient({ ..., packageIds: mainnetPackageIds, marginManagers: {...} })

// ✅ Đúng
new DeepBookClient({ ..., network: 'mainnet', marginManagers: {...} })
```

## Liên quan

- [DeepBook Margin](./deepbook-margin.vi.md) — leverage trên DeepBookV3
- [DeepBook Predict](./deepbook-predict.vi.md) — prediction market vol-surface
- [SDK Reference](./sdk-reference.vi.md) — API TypeScript thực tế
- [Whitepaper: DeepBook Token](https://docs.sui.io/assets/files/deepbook-3e24e6e1deeb8cd860682c1fb473b597.pdf)


---

## Tài liệu tham khảo

### Sui official docs

- [DeepBookV3 Overview](https://docs.sui.io/onchain-finance/deepbookv3/deepbook)
- [Design](https://docs.sui.io/onchain-finance/deepbookv3/design)
- [Contract Information](https://docs.sui.io/onchain-finance/deepbookv3/contract-information)
- [Indexer](https://docs.sui.io/onchain-finance/deepbookv3/deepbookv3-indexer)
- [DeepBookV3 Whitepaper (PDF)](https://docs.sui.io/assets/files/deepbook-3e24e6e1deeb8cd860682c1fb473b597.pdf)

### SDK & CLI tools

- **[@mysten/deepbook-v3](https://www.npmjs.com/package/@mysten/deepbook-v3)** — TypeScript SDK chính thức
- **[mcxross/deepbook-cli](https://github.com/mcxross/deepbook-cli)** — CLI + TUI production cho DeepBook (spot + margin + predict). Reference tốt cho transaction structure chính xác. Support:
  - `deepbook spot buy/sell/limit` — trading order book
  - `deepbook swap` — swap pool trực tiếp
  - `deepbook orderbook`, `deepbook trades`, `deepbook ohlcv` — provider-backed reads
  - `deepbook stream` — SSE cho real-time data
  - `deepbook run twap/dca/grid/trailing-stop` — strategy loops
- **[mcxross/skills](https://github.com/mcxross/skills)** — Skill packages cho AI agent, bao gồm skill `deepbook-cli`
- **[KZN-Labs/DeepDive](https://github.com/KZN-Labs/DeepDive)** — Server streaming order book real-time (Go). Listen chain events, reconstruct in-memory book, serve qua WebSocket + REST. Reference architecture cho data layer:
  - Event subscriber (suix_queryEvents, polling)
  - Order book registry single-writer (BTree per pool)
  - Protocol WebSocket snapshot + delta
  - REST snapshot và ticker

### Source code

- [Sui repository](https://github.com/MystenLabs/sui)
- [DeepBookV3 source](https://github.com/MystenLabs/deepbookv3)
- [TypeScript SDK source](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3)
