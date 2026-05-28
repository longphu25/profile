# `@mysten/deepbook-v3` SDK Reference

> Version: **1.4.1** | Peer: `@mysten/sui ^2.17.0` | Node: `>=22`

## Cài đặt

```bash
bun add @mysten/deepbook-v3 @mysten/sui
# hoặc
npm install @mysten/deepbook-v3 @mysten/sui
```

## Top-level exports

```typescript
import {
  // Client chính
  DeepBookClient,
  deepbook,             // factory mở rộng SuiClient
  DeepBookConfig,

  // Lớp contract (transaction builders)
  BalanceManagerContract,
  DeepBookContract,
  DeepBookAdminContract,
  FlashLoanContract,
  GovernanceContract,
  MarginAdminContract,
  MarginMaintainerContract,
  MarginManagerContract,
  MarginPoolContract,
  PoolProxyContract,
  MarginTPSLContract,

  // Tích hợp Pyth
  SuiPythClient,
  SuiPriceServiceConnection,

  // BCS types
  Account, Balances, Order, OrderDeepPrice, VecSet,

  // Enums
  OrderType, SelfMatchingOptions,

  // Constants
  mainnetCoins, testnetCoins,
  mainnetPools, testnetPools,
  mainnetMarginPools, testnetMarginPools,
  mainnetPackageIds, testnetPackageIds,
  mainnetPythConfigs, testnetPythConfigs,
  DEEP_SCALAR, FLOAT_SCALAR, GAS_BUDGET, MAX_TIMESTAMP,
  POOL_CREATION_FEE_DEEP, PRICE_INFO_OBJECT_MAX_AGE_MS,
} from '@mysten/deepbook-v3'
```

## Setup client

### Standalone

```typescript
import { DeepBookClient, mainnetPools, mainnetCoins } from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'

const dbClient = new DeepBookClient({
  client: new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
  }),
  network: 'mainnet',
  address: walletAddress,
  pools: mainnetPools,
  coins: mainnetCoins,
  balanceManagers: { main: { address: bmId } },
})
```

### Là extension của SuiClient

```typescript
import { deepbook } from '@mysten/deepbook-v3'
import { createSuiClient } from '@mysten/sui/client'

const client = createSuiClient({ network: 'mainnet' }).$extend(
  deepbook({
    address: walletAddress,
    pools: mainnetPools,
    coins: mainnetCoins,
    balanceManagers: { main: { address: bmId } },
  })
)

// Dùng: client.deepbook.deepBook.placeLimitOrder(...)
```

## Interface DeepBookClient

Client expose 13 transaction-builder và nhiều query method:

```typescript
class DeepBookClient {
  // Transaction builders
  balanceManager: BalanceManagerContract
  deepBook: DeepBookContract
  deepBookAdmin: DeepBookAdminContract
  flashLoans: FlashLoanContract
  governance: GovernanceContract
  marginAdmin: MarginAdminContract
  marginMaintainer: MarginMaintainerContract
  marginPool: MarginPoolContract
  marginManager: MarginManagerContract
  marginRegistry: MarginRegistryContract
  marginLiquidations: MarginLiquidationsContract
  poolProxy: PoolProxyContract
  marginTPSL: MarginTPSLContract

  // Query methods (sync qua QueryContext nội bộ)
  checkManagerBalance(managerKey, coinKey): Promise<ManagerBalance>
  getBalanceManagerIds(owner): Promise<string[]>
  getOrders(...): Promise<Order[]>
  getMarginManagerState(managerKey): Promise<MarginManagerState>
  // ... và nhiều method khác
}
```

## BalanceManagerContract

Method build Move call. Mỗi method trả về `(tx: Transaction) => result`:

| Method | Mục đích |
|--------|----------|
| `createAndShareBalanceManager()` | Tạo + share BM mới (1 lần) |
| `createBalanceManagerWithOwner(owner)` | Tạo với owner cụ thể |
| `depositIntoManager(managerKey, coinKey, amount)` | Deposit coin |
| `withdrawFromManager(managerKey, coinKey, amount)` | Withdraw coin |
| `withdrawAllFromManager(managerKey, coinKey)` | Withdraw all 1 type |
| `checkManagerBalance(managerKey, coinKey)` | Đọc balance (devInspect-able) |
| `generateProof(managerKey)` | Owner proof cho trading |
| `generateProofAsTrader(managerId, tradeCapId)` | Proof của trader uỷ quyền |
| `mintTradeCap(managerKey)` | Uỷ quyền trading |
| `mintDepositCap(managerKey)` | Uỷ quyền deposit |
| `mintWithdrawalCap(managerKey)` | Uỷ quyền withdrawal |
| `revokeTradeCap(managerKey, capId)` | Thu hồi uỷ quyền |

### Ví dụ: deposit + place order

```typescript
const tx = new Transaction()

// Deposit 100 USDC vào BalanceManager
tx.add(dbClient.balanceManager.depositIntoManager('main', 'USDC', 100))

// Place lệnh buy
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

await client.signAndExecute({ transaction: tx, signer })
```

## DeepBookContract

Interface trading chính (60+ method). Nhóm chính:

### Place order

| Method | Mục đích |
|--------|----------|
| `placeLimitOrder(params)` | Place limit order |
| `placeMarketOrder(params)` | Place market order |
| `modifyOrder(params)` | Modify order |
| `cancelOrder(...)` | Cancel 1 order |
| `cancelAllOrders(poolKey, bmKey)` | Cancel all trong pool |
| `cancelLiveOrder(...)` | Cancel chỉ khi vẫn live |

### Swaps

| Method | Mục đích |
|--------|----------|
| `swapExactBaseForQuote(params)` | Bán base, lấy quote |
| `swapExactQuoteForBase(params)` | Bán quote, lấy base |
| `swapExactQuantity({...isBaseToCoin})` | Swap generic |
| `swapExactBaseForQuoteWithManager(...)` | Dùng funds BM |
| `swapExactQuoteForBaseWithManager(...)` | Dùng funds BM |

> **Quan trọng:** Swap calls trả `[baseCoin, quoteCoin, deepCoin]`. Phải transfer cả 3:
> ```typescript
> const result = dbClient.deepBook.swapExactBaseForQuote(...)(tx)
> tx.transferObjects([...result], owner)  // ✅
> ```

### Query Account & order (devInspect)

| Method | Mục đích |
|--------|----------|
| `account(poolKey, managerKey)` | State account của user |
| `accountOpenOrders(...)` | List open orders |
| `getAccountOrderDetails(...)` | Detailed order info |
| `getOrder(poolKey, orderId)` | 1 order |
| `getOrders(poolKey, orderIds[])` | Batch query |
| `lockedBalance(...)` | Funds lock trong orders |

### Pool data

| Method | Mục đích |
|--------|----------|
| `midPrice(poolKey)` | Mid price hiện tại |
| `whitelisted(poolKey)` | Pool whitelisted? |
| `stablePool(poolKey)` | Pool stable pair? |
| `vaultBalances(poolKey)` | Nội dung vault |
| `getLevel2Range(poolKey, ...)` | Order book L2 |
| `getLevel2TicksFromMid(poolKey, ticks)` | L2 quanh mid |
| `poolTradeParams(poolKey)` | Fees + stake req hiện tại |
| `poolTradeParamsNext(poolKey)` | Params epoch sau |
| `getPoolDeepPrice(poolKey)` | DEEP/quote price points |

### Helper pricing (devInspect)

| Method | Mục đích |
|--------|----------|
| `getQuoteQuantityOut(poolKey, baseQty)` | "Bán X base, được bao nhiêu quote?" |
| `getBaseQuantityOut(poolKey, quoteQty)` | "Tiêu X quote, được bao nhiêu base?" |
| `getQuantityOut(...)` | Generic |
| `getBaseQuantityIn(...)` | Inverse |
| `getQuoteQuantityIn(...)` | Inverse |
| `getOrderDeepRequired(...)` | DEEP cần cho order |

### Validate order

| Method | Mục đích |
|--------|----------|
| `canPlaceLimitOrder(params)` | Check trước khi place |
| `canPlaceMarketOrder(params)` | Check trước khi place |
| `checkLimitOrderParams(...)` | Validate params |
| `checkMarketOrderParams(...)` | Validate params |

### Tạo pool

| Method | Mục đích |
|--------|----------|
| `createPermissionlessPool(params)` | Tạo pool mới (tốn DEEP) |

## MarginManagerContract

Operations margin trading. Luôn bind manager vào 1 DeepBookV3 pool.

| Method | Mục đích |
|--------|----------|
| `newMarginManager(poolKey)` | Tạo + share MM mới |
| `newMarginManagerWithInitializer(poolKey)` | Tạo + initialize trong cùng PTB |
| `depositBase({managerKey, amount})` | Deposit base asset |
| `depositQuote({managerKey, amount})` | Deposit quote asset |
| `depositDeep({managerKey, amount})` | Deposit DEEP cho fees |
| `withdrawBase(managerKey, amount)` | Withdraw base |
| `withdrawQuote(managerKey, amount)` | Withdraw quote |
| `withdrawDeep(managerKey, amount)` | Withdraw DEEP |
| `borrowBase(managerKey, amount)` | Vay từ base margin pool |
| `borrowQuote(managerKey, amount)` | Vay từ quote margin pool |
| `repayBase(managerKey, amount?)` | Trả nợ base (bỏ trống = trả hết) |
| `repayQuote(managerKey, amount?)` | Trả nợ quote |
| `liquidate({...})` | Liquidate position của người khác |

### Query method (devInspect)

| Method | Mục đích |
|--------|----------|
| `managerState(...)` | Full state trong 1 call |
| `calculateAssets(...)` | Total assets |
| `calculateDebts(...)` | Total debts |
| `borrowedShares(...)` | Số borrow share |
| `hasBaseDebt(...)` | Có nợ base? |
| `accountExists(...)` | Manager đã initialize? |

### Query trực tiếp (TypeScript)

```typescript
const state = await dbClient.getMarginManagerState('main')
// Trả: { baseAsset, quoteAsset, baseDebt, quoteDebt, ... }
```

## PoolProxyContract

Wrap DeepBookContract calls để margin manager trade. Dùng thay cho `deepBook.placeLimitOrder` khi trade qua `MarginManager`:

```typescript
tx.add(dbClient.poolProxy.placeLimitOrder({
  poolKey: 'SUI_USDC',
  marginManagerKey: 'main',
  clientOrderId: '1',
  price: 1.5,
  quantity: 10,
  isBid: true,
  orderType: OrderType.POST_ONLY,
  selfMatchingOption: SelfMatchingOptions.CANCEL_TAKER,
  payWithDeep: false,
}))

// Method proxy khác:
tx.add(dbClient.poolProxy.cancelAllOrders('main'))
tx.add(dbClient.poolProxy.withdrawSettledAmounts('main'))
tx.add(dbClient.poolProxy.updateCurrentPrice('SUI_USDC'))
```

## MarginPoolContract

Cho lender (supplier):

| Method | Mục đích |
|--------|----------|
| `supply({asset, amount})` | Supply liquidity, nhận `SupplierCap` |
| `withdraw({...})` | Withdraw + lãi (burn cap) |
| `state(asset)` | State pool (devInspect) |
| `interestRate(asset)` | Lãi suất borrow hiện tại |

## FlashLoanContract

Borrow + use + repay trong 1 PTB:

```typescript
const [coin, receipt] = tx.add(dbClient.flashLoans.borrowBaseAsset({
  poolKey: 'SUI_USDC',
  amount: 1000,
}))

// Dùng coin ở đâu đó...

tx.add(dbClient.flashLoans.returnBaseAsset({
  poolKey: 'SUI_USDC',
  borrowedCoin: coin,
  receipt,
}))
```

## GovernanceContract

| Method | Mục đích |
|--------|----------|
| `stake(poolKey, managerKey, amount)` | Stake DEEP vào pool |
| `unstake(poolKey, managerKey)` | Unstake (epoch sau) |
| `submitProposal({...})` | Đề xuất fees mới |
| `vote(poolKey, managerKey, proposalId)` | Vote proposal |

## Constants

### `mainnetPackageIds`

```typescript
{
  DEEPBOOK_PACKAGE_ID: '0x0e735f8c93a95722efd73521aca7a7652c0bb71ed1daf41b26dfd7d1ff71f748',
  REGISTRY_ID: '0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d',
  DEEP_TREASURY_ID: '0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe',
  MARGIN_PACKAGE_ID: '0x124bb3d8105d6d301c0d40feaa54d65df6b301e4d8ddd5eb8475b0f8a18cff2e',
  MARGIN_REGISTRY_ID: '0x0e40998b359a9ccbab22a98ed21bd4346abf19158bc7980c8291908086b3a742',
  LIQUIDATION_PACKAGE_ID: '0xf17bff1bf21e9587acc5708714e520aa967f82f256f626938a33c4109b08adb9',
}
```

### `mainnetCoins`

Bao gồm: `DEEP`, `SUI`, `USDC`, `WAL`, `SUIUSDE`, `XBTC`, `USDSUI`, `WUSDC`, `WETH`, `BETH`, `WBTC`, `WUSDT`, `NS`, `TYPUS`, `AUSD`, `DRF`, `SEND`, `IKA`, `ALKIMI`, ...

Mỗi coin có:
```typescript
{
  address: string,        // package address
  type: string,           // full type với module + struct
  scalar: number,         // 10^decimals
  feed?: string,          // Pyth price feed ID
  currencyId?: string,    // Pyth currency ID
  priceInfoObjectId?: string,
}
```

### `testnetCoins`

Bao gồm test variants: `DBUSDC`, `DBTC`, `DBUSDT` (DeepBook test coins). DUSDC cho Predict riêng (không có trong map này).

### Pool maps

```typescript
import { mainnetPools, testnetPools } from '@mysten/deepbook-v3'

// Mỗi pool có:
{
  address: string,        // Pool object ID
  baseCoin: string,       // Coin key từ map coins
  quoteCoin: string,
}
```

## Pattern thường gặp

### Top-up gas trước khi trade

```typescript
const balanceManager = await dbClient.checkManagerBalance('main', 'SUI')
if (balanceManager.balance < 0.1) {
  tx.add(dbClient.balanceManager.depositIntoManager('main', 'SUI', 0.5))
}
```

### Đọc tất cả balance manager 1 lần

```typescript
const balances = await dbClient.checkManagerBalancesWithAddress(
  [bmIdA, bmIdB],
  ['SUI', 'USDC', 'DEEP']
)
// Trả: { '0xa...': { SUI: 10, USDC: 100, DEEP: 0 }, '0xb...': {...} }
```

### Lấy params trading hiện tại

```typescript
const params = await dbClient.poolTradeParams('SUI_USDC')
// { takerFee, makerFee, stakeRequired }
```

### Estimate output swap

```typescript
const result = await dbClient.getQuoteQuantityOut('SUI_USDC', 10)
// "bán 10 SUI thu X USDC + DEEP fee Y"
```

### Decode order ID

```typescript
const decoded = await dbClient.decodeOrderId(orderId)
// { isBid, price, orderId, ... }
```

## Pattern lỗi

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| `Pool X not in SDK` | Pool key thiếu trong config | Thêm vào map `pools` |
| `UnusedValueWithoutDrop` | Return value swap không transfer | Spread tất cả return coin |
| `MoveAbort code 5` | POST_ONLY would cross | Tăng tick gap |
| `MoveAbort code 8` | `withdraw('main', 0)` | Query state, withdraw chính xác × 0.999 |
| `MoveAbort code 10` | `repayBase` không có nợ | Wrap try/catch |
| `Type mismatch` | Sai type argument | Verify generic `<T>` |
| `Insufficient gas` | BM không có SUI | Top up SUI trước order |

## Tích hợp Pyth

Cho tính năng giá từ oracle (margin price feeds, liquidation):

```typescript
import { SuiPythClient, mainnetPythConfigs } from '@mysten/deepbook-v3'

const pyth = new SuiPythClient({
  client: suiClient,
  pythStateId: mainnetPythConfigs.PYTH_STATE_ID,
  wormholeStateId: mainnetPythConfigs.WORMHOLE_STATE_ID,
})

// Update price feeds trước khi trade
await pyth.updatePriceFeeds(tx, ['BTC', 'SUI'], priceUpdateData)
```

## Testing

SDK ship full source tại `node_modules/@mysten/deepbook-v3/src/`. Đọc đó là cách nhanh nhất hiểu hành vi chính xác. File chính:

- `src/client.ts` — class client chính (211 dòng, setup mọi thứ)
- `src/transactions/deepbook.ts` — API trading chính (1600+ dòng)
- `src/transactions/marginManager.ts` — operations margin (~1000 dòng)
- `src/transactions/balanceManager.ts` — operations BM (~400 dòng)
- `src/utils/constants.ts` — coins, pools, package IDs
- `src/utils/config.ts` — class DeepBookConfig
- `src/types/index.ts` — tất cả TypeScript types

## Liên quan

- [DeepBookV3](./deepbookv3.vi.md) — tổng quan protocol
- [DeepBook Margin](./deepbook-margin.vi.md) — concept margin trading
- [DeepBook Predict](./deepbook-predict.vi.md) — riêng biệt (build PTB thủ công)
- [Sui TypeScript SDK 2 migration](../../../../.agents/skills/sui-sdk-2-migration/SKILL.md)
