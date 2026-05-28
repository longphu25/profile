# DeepBook Margin

## Tổng quan

DeepBook Margin mở rộng DeepBookV3 với **trading leverage**. User vay vốn từ `MarginPool` để mở vị thế lớn hơn collateral. `MarginManager` wrap `BalanceManager` chuẩn và thêm capability borrow/repay/risk-management.

Live trên Sui Mainnet. Production-ready từ v3 (Feb 2026).

## Khi nào dùng

- Long/short với leverage trên cặp spot DeepBookV3
- Earn yield bằng cho vay liquidity tới `MarginPool`
- Build bot trading tự động cần leverage
- Compose với protocol DeFi khác (vd Predict ranges fund bằng margin debt)

## Kiến trúc (4 shared object)

```
MarginRegistry (singleton)
└── Track tất cả MarginPool và MarginManager
└── Lưu risk parameters per cặp (base, quote)
└── Bật/tắt margin trading per pool

MarginPool (1 cho mỗi asset)
├── State (supply/borrow shares, interest accrual)
├── ProtocolConfig (rates, caps, spread)
├── ProtocolFees (chia referral/protocol/maintainer)
└── PositionManager (positions per supplier)

MarginManager (1 cho user per pool)
├── Wrap BalanceManager (DeepBookV3)
├── Track borrowed shares (base hoặc quote, không cả 2)
└── Authorized trade trên 1 DeepBookV3 pool

PoolProxy
└── Wrapper route lệnh trade qua MarginManager
```

## MarginPool

Quản lý liquidity cho 1 asset. Vd `SUI Margin Pool`, `USDC Margin Pool`. Component:

### State

Kế toán dạng share:

- **Supply shares** — sở hữu tỷ lệ của lender trong asset đã supply
- **Borrow shares** — nghĩa vụ nợ tỷ lệ của borrower

Lãi tích luỹ liên tục theo **utilization rate**:

```
Utilization Rate = Total Borrowed / Total Supplied
```

Update mỗi khi supply, borrow, repay, hoặc withdraw.

### ProtocolConfig

```
- Tham số lãi suất (mô hình kinked)
- Supply cap
- Max utilization rate (vd 80%)
- Min borrow amount (anti-spam)
- Protocol spread (% lãi đi vào protocol)
```

### Mô hình lãi suất (kinked)

```
nếu utilization < kink (vd 80%):
  rate = base_rate + slope_1 × utilization
ngược lại:
  rate = base_rate + slope_1 × kink + slope_2 × (utilization - kink)
```

Dưới kink: tăng tuyến tính, vừa phải. Trên kink: tăng dốc, ngăn over-borrow.

### Chia ProtocolFees

Khi borrower trả lãi:

```
Protocol spread (vd 10%) → pool protocol
Phần còn lại (vd 90%) → suppliers (theo tỷ lệ shares)

Trong protocol spread:
  50% → referral fees (referrer của supplier)
  25% → protocol treasury
  25% → pool maintainer
```

### Ví dụ

100 USDC lãi mà borrower trả:
- 90 USDC chia cho suppliers
- 5 USDC cho referral
- 2.5 USDC cho protocol treasury
- 2.5 USDC cho maintainer

## MarginManager

Wrap `BalanceManager` và thêm operations margin. Mỗi manager **bind vào 1 DeepBookV3 pool**.

### Ràng buộc borrow

- Chỉ borrow từ **1 MarginPool tại 1 thời điểm** (base HOẶC quote, không cả 2)
- Đơn giản hoá tính toán risk — không có phức tạp cross-collateral
- Repay xong mới mở slot vay asset kia

### Risk ratio

```
Risk Ratio = Total Assets / Total Debt
```

Cao hơn = khoẻ hơn. Position bị liquidate khi ratio rơi dưới ngưỡng.

### Ngưỡng action (mặc định)

| Ngưỡng | Mặc định | Ý nghĩa |
|--------|----------|---------|
| Min Withdraw Risk Ratio | 2.0 | Có thể withdraw collateral khi trên ngưỡng |
| Min Borrow Risk Ratio | 1.25 | Có thể vay mới khi trên ngưỡng |
| Liquidation Risk Ratio | 1.1 | Bị liquidate khi dưới ngưỡng |
| Target Liquidation Risk Ratio | 1.25 | Target sau partial liquidation |

### Luồng liquidation

```
1. Risk Ratio rơi dưới 1.1 (hoặc ngưỡng cặp-cụ thể)
2. Bất kỳ ai cũng có thể gọi MarginManager.liquidate(...)
3. Liquidator cung cấp coin để repay
4. Tất cả open order của manager bị huỷ
5. Hệ thống tính max debt repayable
6. Collateral chuyển cho liquidator + reward (vd 5%)
7. Pool có thể nhận thêm reward (vd 3%)
8. Nếu asset không đủ: pool ghi nợ xấu
```

Liquidation có thể là **partial** (đưa ratio về target) hoặc **full** (đóng position toàn bộ).

## MarginRegistry

Object điều phối trung tâm. Lưu:

- Margin pool đăng ký theo asset type
- DeepBookV3 pool được bật (pool nào cho phép margin trading)
- Risk parameters per cặp `(base_pool, quote_pool)`
- Master list mọi `MarginManager`

## Risk parameters (mainnet)

### SUI/USDC — leverage 5x

| Parameter | Giá trị |
|-----------|---------|
| Min Withdraw Risk Ratio | 2.0 |
| Min Borrow Risk Ratio | 1.25 |
| Liquidation Risk Ratio | 1.1 |
| Target Liquidation Risk Ratio | 1.25 |
| User Liquidation Reward | 2% |
| Pool Liquidation Reward | 3% |

### WAL/USDC và DEEP/USDC — leverage 3x

| Parameter | Giá trị |
|-----------|---------|
| Min Withdraw Risk Ratio | 2.0 |
| Min Borrow Risk Ratio | 1.5 |
| Liquidation Risk Ratio | 1.2 |
| Target Liquidation Risk Ratio | 1.5 |
| User Liquidation Reward | 2% |
| Pool Liquidation Reward | 3% |

## Contract IDs (mainnet)

```
MARGIN_PACKAGE_ID (v3): 0xfbd322126f1452fd4c89aedbaeb9fd0c44df9b5cedbe70d76bf80dc086031377
MARGIN_REGISTRY_ID:     0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742
LIQUIDATION_PACKAGE_ID: 0xf17bff1bf21e9587acc5708714e520aa967f82f256f626938a33c4109b08adb9
```

## Contract IDs (testnet)

```
MARGIN_PACKAGE_ID:      0xd6a42f4df4db73d68cbeb52be66698d2fe6a9464f45ad113ca52b0c6ebd918b6
MARGIN_REGISTRY_ID:     0x48d7640dfae2c6e9ceeada197a7a1643984b5a24c55a0c6c023dac77e0339f75
LIQUIDATION_PACKAGE_ID: 0x8d69c3ef3ef580e5bf87b933ce28de19a5d0323588d1a44b9c60b4001741aa24
```

## Lifecycle thường gặp

### Trader (long với leverage)

```typescript
// 1. Tạo margin manager bind vào pool SUI/USDC
tx.add(dbClient.marginManager.newMarginManager('SUI_USDC'))

// 2. Deposit USDC làm collateral
tx.add(dbClient.marginManager.depositQuote({
  managerKey: 'main',
  amount: 1000  // 1000 USDC collateral
}))

// 3. Vay thêm USDC dựa trên đó (vd 700 thêm cho leverage 1.7x)
tx.add(dbClient.marginManager.borrowQuote('main', 700))

// 4. Place lệnh buy với leverage qua PoolProxy
tx.add(dbClient.poolProxy.placeLimitOrder({
  poolKey: 'SUI_USDC',
  marginManagerKey: 'main',
  clientOrderId: '1',
  price: 1.5,
  quantity: 1133,  // ~1700 USDC tại giá $1.5
  isBid: true,
  orderType: OrderType.NO_RESTRICTION,
  payWithDeep: false,
}))

// 5. Sau đó: đóng position, trả nợ, withdraw phần còn lại
tx.add(dbClient.marginManager.repayQuote('main'))  // trả hết
tx.add(dbClient.marginManager.withdrawQuote('main', remaining))
```

### Lender (supply để earn yield)

```typescript
// 1. Supply USDC vào pool USDC margin, nhận SupplierCap
const [supplierCap] = tx.add(dbClient.marginPool.supply({
  asset: 'USDC',
  amount: 10000,
}))
tx.transferObjects([supplierCap], owner)

// 2. Sau đó: withdraw cùng lãi tích luỹ
tx.add(dbClient.marginPool.withdraw({
  asset: 'USDC',
  supplierCap,
  amount: 10500,  // bao gồm lãi
}))
```

## Cân nhắc rủi ro

### Cho trader

- **Leverage khuếch đại loss** — biến động ngược 10% với leverage 5x = mất 50%
- **Tích luỹ lãi** — chi phí carry bào mòn lợi nhuận theo thời gian
- **Chi phí liquidation** — mất 5% reward thêm vào loss collateral
- **Rủi ro oracle** — biến động giá đột ngột có thể trigger liquidation nhanh hơn react

### Cho lender

- **Nợ xấu** — nếu liquidation không đủ cover debt, lender hứng loss
- **Rủi ro utilization** — utilization cao có thể delay withdrawal (max_utilization_rate)
- **Smart contract risk** — bug trong logic liquidation có thể ảnh hưởng funds
- **Volatility lãi suất** — rate dao động theo utilization

## Indexer

```
https://deepbook-margin-indexer.mainnet.mystenlabs.com
```

Endpoints (thường gặp):

- `GET /margin-pools` — list mọi margin pool
- `GET /margin-pools/:asset/state` — supply, borrow, utilization, rates
- `GET /margin-managers/:owner` — margin managers của user
- `GET /margin-managers/:id/state` — base/quote assets và debts
- `GET /liquidations` — events liquidation gần đây

## Pattern thường gặp

### Theo dõi sức khoẻ

```typescript
// Check risk ratio hiện tại
const state = await dbClient.getMarginManagerState('main')
const totalAssets = parseFloat(state.baseAsset) * basePrice + parseFloat(state.quoteAsset)
const totalDebt = parseFloat(state.baseDebt) * basePrice + parseFloat(state.quoteDebt)
const riskRatio = totalAssets / totalDebt

if (riskRatio < 1.2) {
  console.warn('Position sắp liquidate!')
}
```

### Auto-rebalance trước liquidation

```typescript
// Nếu risk ratio dưới 1.3, repay 1 phần debt
if (riskRatio < 1.3) {
  // Huỷ orders, withdraw settled, repay
  tx.add(dbClient.poolProxy.cancelAllOrders('main'))
  tx.add(dbClient.poolProxy.withdrawSettledAmounts('main'))
  tx.add(dbClient.marginManager.repayBase('main'))  // partial
}
```

### Bot liquidator

```typescript
// Định kỳ scan tất cả margin manager
const managers = await fetch(`${MARGIN_INDEXER}/margin-managers`)
for (const m of managers) {
  const state = await dbClient.getMarginManagerState(m.id)
  const riskRatio = computeRiskRatio(state)
  if (riskRatio < 1.1) {
    // Liquidate để kiếm lời
    const tx = new Transaction()
    tx.add(dbClient.marginManager.liquidate({
      poolKey: m.pool,
      marginManagerId: m.id,
      repayAmount: ...,
    }))
  }
}
```

## Liên quan

- [DeepBookV3](./deepbookv3.vi.md) — base CLOB layer
- [DeepBook Predict](./deepbook-predict.vi.md) — composable với margin (Three-Protocol Loop)
- [SDK Reference](./sdk-reference.vi.md) — API TypeScript đầy đủ
- [Risk Ratio docs](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/risk-ratio)


---

## Tài liệu tham khảo

### Sui official docs

- [DeepBook Margin Overview](https://docs.sui.io/onchain-finance/deepbook-margin/)
- [Design](https://docs.sui.io/onchain-finance/deepbook-margin/design)
- [Margin Risks](https://docs.sui.io/onchain-finance/deepbook-margin/margin-risks)
- [Contract Information](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information)
- [Risk Ratio](https://docs.sui.io/onchain-finance/deepbook-margin/contract-information/risk-ratio)
- [Margin SDK](https://docs.sui.io/onchain-finance/deepbook-margin-sdk/)
- [Margin Indexer](https://docs.sui.io/onchain-finance/deepbook-margin/deepbook-margin-indexer)

### CLI tools

- **[mcxross/deepbook-cli](https://github.com/mcxross/deepbook-cli)** — Bao gồm full margin trading flow:
  - `deepbook margin pools` — discover margin pools
  - `deepbook margin managers` — list margin managers của user
  - `deepbook margin deposit/market/limit/position/close` — lifecycle đầy đủ
  - `--leverage`, `--reduce-only`, `--no-pay-with-deep`, `--dry-run` flags
  - Tự chọn compatible manager hoặc tạo mới trong tx
- **[mcxross/skills](https://github.com/mcxross/skills)** — Skill `deepbook-cli` cho AI agents

### Source

- [DeepBookV3 source (margin module)](https://github.com/MystenLabs/deepbookv3/tree/main/packages/deepbook/sources)
- [TypeScript SDK source](https://github.com/MystenLabs/ts-sdks/tree/main/packages/deepbook-v3/src/transactions) — xem `marginManager.ts`, `marginPool.ts`, `marginLiquidations.ts`, `poolProxy.ts`
