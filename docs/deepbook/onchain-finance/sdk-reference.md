# `@mysten/deepbook-v3` SDK Reference

> Version: **1.4.1** | Peer: `@mysten/sui ^2.17.0` | Node: `>=22`

## Installation

```bash
bun add @mysten/deepbook-v3 @mysten/sui
# or
npm install @mysten/deepbook-v3 @mysten/sui
```

## Top-level exports

```typescript
import {
  // Main client
  DeepBookClient,
  deepbook,             // SuiClient extension factory
  DeepBookConfig,

  // Contract classes (transaction builders)
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

  // Pyth integration
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

## Client setup

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

### As SuiClient extension

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

// Use as: client.deepbook.deepBook.placeLimitOrder(...)
```

## DeepBookClient interface

The client exposes 13 transaction-builder properties and many query methods:

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

  // Query methods (sync via internal QueryContext)
  checkManagerBalance(managerKey, coinKey): Promise<ManagerBalance>
  getBalanceManagerIds(owner): Promise<string[]>
  getOrders(...): Promise<Order[]>
  getMarginManagerState(managerKey): Promise<MarginManagerState>
  // ... and many more
}
```

## BalanceManagerContract

Methods that build Move calls. Each returns a function `(tx: Transaction) => result`:

| Method | Purpose |
|--------|---------|
| `createAndShareBalanceManager()` | Create + share new BM (one-time) |
| `createBalanceManagerWithOwner(owner)` | Create with specific owner |
| `depositIntoManager(managerKey, coinKey, amount)` | Deposit coin |
| `withdrawFromManager(managerKey, coinKey, amount)` | Withdraw coin |
| `withdrawAllFromManager(managerKey, coinKey)` | Withdraw all of one type |
| `checkManagerBalance(managerKey, coinKey)` | Read balance (returns devInspect-able) |
| `generateProof(managerKey)` | Owner proof for trading |
| `generateProofAsTrader(managerId, tradeCapId)` | Delegated trader proof |
| `mintTradeCap(managerKey)` | Delegate trading authority |
| `mintDepositCap(managerKey)` | Delegate deposit authority |
| `mintWithdrawalCap(managerKey)` | Delegate withdrawal authority |
| `revokeTradeCap(managerKey, capId)` | Revoke delegation |

### Example: deposit + place order

```typescript
const tx = new Transaction()

// Deposit 100 USDC into BalanceManager
tx.add(dbClient.balanceManager.depositIntoManager('main', 'USDC', 100))

// Place a buy order
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

Main trading interface (60+ methods). Key categories:

### Order placement

| Method | Purpose |
|--------|---------|
| `placeLimitOrder(params)` | Place limit order |
| `placeMarketOrder(params)` | Place market order |
| `modifyOrder(params)` | Modify existing order |
| `cancelOrder(...)` | Cancel one order |
| `cancelAllOrders(poolKey, bmKey)` | Cancel all in pool |
| `cancelLiveOrder(...)` | Cancel only if still live |

### Swaps

| Method | Purpose |
|--------|---------|
| `swapExactBaseForQuote(params)` | Sell base, get quote |
| `swapExactQuoteForBase(params)` | Sell quote, get base |
| `swapExactQuantity({...isBaseToCoin})` | Generic swap |
| `swapExactBaseForQuoteWithManager(...)` | Use BM funds |
| `swapExactQuoteForBaseWithManager(...)` | Use BM funds |

> **Important:** Swap calls return `[baseCoin, quoteCoin, deepCoin]`. Always transfer all three:
> ```typescript
> const result = dbClient.deepBook.swapExactBaseForQuote(...)(tx)
> tx.transferObjects([...result], owner)  // ✅
> ```

### Account & order queries (devInspect)

| Method | Purpose |
|--------|---------|
| `account(poolKey, managerKey)` | User's account state |
| `accountOpenOrders(...)` | List open orders |
| `getAccountOrderDetails(...)` | Detailed order info |
| `getOrder(poolKey, orderId)` | Single order |
| `getOrders(poolKey, orderIds[])` | Batch query |
| `lockedBalance(...)` | Funds locked in orders |

### Pool data

| Method | Purpose |
|--------|---------|
| `midPrice(poolKey)` | Current mid price |
| `whitelisted(poolKey)` | Is pool whitelisted? |
| `stablePool(poolKey)` | Is pool a stable pair? |
| `vaultBalances(poolKey)` | Vault contents |
| `getLevel2Range(poolKey, ...)` | Order book L2 |
| `getLevel2TicksFromMid(poolKey, ticks)` | L2 around mid |
| `poolTradeParams(poolKey)` | Current fees + stake req |
| `poolTradeParamsNext(poolKey)` | Next-epoch params |
| `getPoolDeepPrice(poolKey)` | DEEP/quote price points |

### Pricing helpers (devInspect)

| Method | Purpose |
|--------|---------|
| `getQuoteQuantityOut(poolKey, baseQty)` | "Sell X base, get how much quote?" |
| `getBaseQuantityOut(poolKey, quoteQty)` | "Spend X quote, get how much base?" |
| `getQuantityOut(...)` | Generic |
| `getBaseQuantityIn(...)` | Inverse |
| `getQuoteQuantityIn(...)` | Inverse |
| `getOrderDeepRequired(...)` | DEEP needed for order |

### Order validation

| Method | Purpose |
|--------|---------|
| `canPlaceLimitOrder(params)` | Check before placing |
| `canPlaceMarketOrder(params)` | Check before placing |
| `checkLimitOrderParams(...)` | Param validation |
| `checkMarketOrderParams(...)` | Param validation |

### Pool creation

| Method | Purpose |
|--------|---------|
| `createPermissionlessPool(params)` | Create new pool (costs DEEP) |

## MarginManagerContract

Margin trading operations. Always bind manager to one DeepBookV3 pool.

| Method | Purpose |
|--------|---------|
| `newMarginManager(poolKey)` | Create + share new MM |
| `newMarginManagerWithInitializer(poolKey)` | Create + initialize in same PTB |
| `depositBase({managerKey, amount})` | Deposit base asset |
| `depositQuote({managerKey, amount})` | Deposit quote asset |
| `depositDeep({managerKey, amount})` | Deposit DEEP for fees |
| `withdrawBase(managerKey, amount)` | Withdraw base |
| `withdrawQuote(managerKey, amount)` | Withdraw quote |
| `withdrawDeep(managerKey, amount)` | Withdraw DEEP |
| `borrowBase(managerKey, amount)` | Borrow from base margin pool |
| `borrowQuote(managerKey, amount)` | Borrow from quote margin pool |
| `repayBase(managerKey, amount?)` | Repay base debt (omit = repay all) |
| `repayQuote(managerKey, amount?)` | Repay quote debt |
| `liquidate({...})` | Liquidate someone else's position |

### Query methods (devInspect)

| Method | Purpose |
|--------|---------|
| `managerState(...)` | Full state in one call |
| `calculateAssets(...)` | Total assets |
| `calculateDebts(...)` | Total debts |
| `borrowedShares(...)` | Borrow share count |
| `hasBaseDebt(...)` | Has any base debt? |
| `accountExists(...)` | Manager initialized? |

### Direct query (in TypeScript)

```typescript
const state = await dbClient.getMarginManagerState('main')
// Returns: { baseAsset, quoteAsset, baseDebt, quoteDebt, ... }
```

## PoolProxyContract

Wraps DeepBookContract calls so margin managers can trade. Use this instead of `deepBook.placeLimitOrder` when trading via a `MarginManager`:

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

// Other proxied methods:
tx.add(dbClient.poolProxy.cancelAllOrders('main'))
tx.add(dbClient.poolProxy.withdrawSettledAmounts('main'))
tx.add(dbClient.poolProxy.updateCurrentPrice('SUI_USDC'))
```

## MarginPoolContract

For lenders (suppliers):

| Method | Purpose |
|--------|---------|
| `supply({asset, amount})` | Supply liquidity, receive `SupplierCap` |
| `withdraw({...})` | Withdraw + interest (burn cap) |
| `state(asset)` | Pool state (devInspect) |
| `interestRate(asset)` | Current borrow rate |

## FlashLoanContract

Borrow + use + repay in one PTB:

```typescript
const [coin, receipt] = tx.add(dbClient.flashLoans.borrowBaseAsset({
  poolKey: 'SUI_USDC',
  amount: 1000,
}))

// Use the coin somewhere...

tx.add(dbClient.flashLoans.returnBaseAsset({
  poolKey: 'SUI_USDC',
  borrowedCoin: coin,
  receipt,
}))
```

## GovernanceContract

| Method | Purpose |
|--------|---------|
| `stake(poolKey, managerKey, amount)` | Stake DEEP in pool |
| `unstake(poolKey, managerKey)` | Unstake (next epoch) |
| `submitProposal({...})` | Propose new fees |
| `vote(poolKey, managerKey, proposalId)` | Vote on proposal |

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

Includes: `DEEP`, `SUI`, `USDC`, `WAL`, `SUIUSDE`, `XBTC`, `USDSUI`, `WUSDC`, `WETH`, `BETH`, `WBTC`, `WUSDT`, `NS`, `TYPUS`, `AUSD`, `DRF`, `SEND`, `IKA`, `ALKIMI`, ...

Each coin has:
```typescript
{
  address: string,        // package address
  type: string,           // full type with module + struct
  scalar: number,         // 10^decimals
  feed?: string,          // Pyth price feed ID
  currencyId?: string,    // Pyth currency ID
  priceInfoObjectId?: string,
}
```

### `testnetCoins`

Includes test variants: `DBUSDC`, `DBTC`, `DBUSDT` (DeepBook test coins). DUSDC for Predict is separate (not in this map).

### Pool maps

```typescript
import { mainnetPools, testnetPools } from '@mysten/deepbook-v3'

// Each pool has:
{
  address: string,        // Pool object ID
  baseCoin: string,       // Coin key from coins map
  quoteCoin: string,
}
```

## Common patterns

### Top-up gas before trading

```typescript
const balanceManager = await dbClient.checkManagerBalance('main', 'SUI')
if (balanceManager.balance < 0.1) {
  tx.add(dbClient.balanceManager.depositIntoManager('main', 'SUI', 0.5))
}
```

### Read all manager balances at once

```typescript
const balances = await dbClient.checkManagerBalancesWithAddress(
  [bmIdA, bmIdB],
  ['SUI', 'USDC', 'DEEP']
)
// Returns: { '0xa...': { SUI: 10, USDC: 100, DEEP: 0 }, '0xb...': {...} }
```

### Get current trading params

```typescript
const params = await dbClient.poolTradeParams('SUI_USDC')
// { takerFee, makerFee, stakeRequired }
```

### Estimate swap output

```typescript
const result = await dbClient.getQuoteQuantityOut('SUI_USDC', 10)
// "selling 10 SUI returns X USDC + DEEP fee Y"
```

### Decode an order ID

```typescript
const decoded = await dbClient.decodeOrderId(orderId)
// { isBid, price, orderId, ... }
```

## Error patterns

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Pool X not in SDK` | Pool key missing from config | Add to `pools` map |
| `UnusedValueWithoutDrop` | Swap return value not transferred | Spread all return coins |
| `MoveAbort code 5` | POST_ONLY would cross | Increase tick gap |
| `MoveAbort code 8` | `withdraw('main', 0)` | Query state, withdraw exact amount × 0.999 |
| `MoveAbort code 10` | `repayBase` with no debt | Wrap in try/catch |
| `Type mismatch` | Wrong type argument | Verify generic `<T>` |
| `Insufficient gas` | BM has no SUI | Top up SUI before order |

## Pyth integration

For oracle-priced features (margin price feeds, liquidation):

```typescript
import { SuiPythClient, mainnetPythConfigs } from '@mysten/deepbook-v3'

const pyth = new SuiPythClient({
  client: suiClient,
  pythStateId: mainnetPythConfigs.PYTH_STATE_ID,
  wormholeStateId: mainnetPythConfigs.WORMHOLE_STATE_ID,
})

// Update price feeds before trading
await pyth.updatePriceFeeds(tx, ['BTC', 'SUI'], priceUpdateData)
```

## Testing

The SDK ships its full source in `node_modules/@mysten/deepbook-v3/src/`. Reading it is the fastest way to understand exact behavior. Key files:

- `src/client.ts` — main client class (211 lines, sets up everything)
- `src/transactions/deepbook.ts` — main trading API (1600+ lines)
- `src/transactions/marginManager.ts` — margin operations (~1000 lines)
- `src/transactions/balanceManager.ts` — BM operations (~400 lines)
- `src/utils/constants.ts` — coins, pools, package IDs
- `src/utils/config.ts` — DeepBookConfig class
- `src/types/index.ts` — all TypeScript types

## Related

- [DeepBookV3](./deepbookv3.md) — protocol overview
- [DeepBook Margin](./deepbook-margin.md) — margin trading concepts
- [DeepBook Predict](./deepbook-predict.md) — separate from this SDK (build PTBs manually)
- [Sui TypeScript SDK 2 migration](../../../.agents/skills/sui-sdk-2-migration/SKILL.md)
