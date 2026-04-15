# DeepBook Balance Manager — Technical Guide

## Balance Manager là gì?

Balance Manager là **on-chain shared object** trên Sui, hoạt động như tài khoản giao dịch trên DeepBook v3. Nó giữ tokens (DEEP, SUI, USDC...) và cho phép đặt limit orders trên orderbook.

Tương tự tài khoản margin trên sàn CEX — bạn deposit tiền vào, đặt orders, rồi withdraw ra khi xong.

```
Wallet (ví)                    Balance Manager (on-chain)
┌──────────┐    deposit →     ┌──────────────────────┐
│ 10 SUI   │ ──────────────→  │ SUI: 8.0             │
│ 300 DEEP │                  │ DEEP: 0.0            │
└──────────┘    ← withdraw    │                      │
                              │ Open Orders:          │
                              │  BUY 100 DEEP @0.03  │
                              └──────────────────────┘
```

### Đặc điểm

| Thuộc tính | Giá trị |
|-----------|---------|
| Object type | `{DEEPBOOK_PKG}::balance_manager::BalanceManager` |
| Ownership | **Shared object** (không thuộc ví nào, ai có proof đều dùng được) |
| Tạo bởi | `balance_manager::new` + `transfer::public_share_object` |
| Persist | Tồn tại vĩnh viễn trên chain cho đến khi destroy |
| Phí tạo | ~0.01 SUI gas |

### Tại sao cần Balance Manager?

DeepBook v3 **không cho phép** đặt limit orders trực tiếp từ wallet. Phải:
1. Tạo Balance Manager
2. Deposit tokens vào manager
3. Đặt orders qua manager (cần `TradeProof`)
4. Orders filled → tokens swap trong manager
5. Withdraw tokens về wallet khi xong

Swap (market orders) thì **không cần** Balance Manager — swap trực tiếp từ wallet.

---

## Lifecycle

```
1. CREATE    → balance_manager::new → shared object
2. DEPOSIT   → deposit tokens từ wallet vào manager
3. TRADE     → placeLimitOrder (cần generateProof)
4. SETTLE    → orders filled → tokens swap trong manager
5. CANCEL    → cancelAllOrders → settled tokens available
6. WITHDRAW  → withdrawAllFromManager → tokens về wallet
```

---

## SDK API Reference

### Tạo Balance Manager

```typescript
import { DeepBookClient } from '@mysten/deepbook-v3'

const tx = new Transaction()
tx.add(dbClient.balanceManager.createAndShareBalanceManager())
await signAndExec(keypair, tx, 'mainnet')
```

Trả về shared object — cần parse object ID từ transaction effects.

### Tìm Balance Manager đã tạo

```typescript
// Cách 1: SDK query (cần registry)
const ids = await dbClient.getBalanceManagerIds(walletAddress)

// Cách 2: JSON-RPC getOwnedObjects (không tìm shared objects)
// Cách 3: Parse objectChanges từ create transaction
const txData = await fetch(RPC, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'sui_getTransactionBlock',
    params: [digest, { showObjectChanges: true }],
  }),
})
// Find: type === 'created' && objectType includes 'BalanceManager'
```

### Config DeepBookClient với Balance Manager

```typescript
const dbClient = new DeepBookClient({
  client, address: walletAddress, network: 'mainnet',
  coins: mainnetCoins,
  pools: mainnetPools,
  packageIds: mainnetPackageIds,
  balanceManagers: {
    main: { address: '0xBALANCE_MANAGER_ID' }
  },
})
```

### Deposit

```typescript
const tx = new Transaction()
tx.add(dbClient.balanceManager.depositIntoManager(
  'main',     // managerKey (from config)
  'SUI',      // coinKey (from SDK coins)
  5.0         // amount (human readable)
))
await signAndExec(keypair, tx, 'mainnet')
```

### Place Limit Order (POST_ONLY = Maker)

```typescript
import { OrderType } from '@mysten/deepbook-v3'

const tx = new Transaction()
tx.add(dbClient.deepBook.placeLimitOrder({
  poolKey: 'DEEP_SUI',
  balanceManagerKey: 'main',
  clientOrderId: Date.now().toString(),
  price: 0.03017,        // bid price
  quantity: 100,          // base quantity (DEEP)
  isBid: true,            // true = buy, false = sell
  orderType: OrderType.POST_ONLY,  // maker only, fee = 0
  payWithDeep: false,
}))
await signAndExec(keypair, tx, 'mainnet')
```

### Cancel All Orders

```typescript
const tx = new Transaction()
tx.add(dbClient.deepBook.cancelAllOrders('DEEP_SUI', 'main'))
await signAndExec(keypair, tx, 'mainnet')
```

### Check Manager Balance

```typescript
// Single coin
const bal = await dbClient.checkManagerBalanceWithAddress(bmId, 'SUI')
// bal.balance = 5.123 (human readable)

// Multiple managers × multiple coins
const bals = await dbClient.checkManagerBalancesWithAddress(
  [bmIdA, bmIdB],
  ['SUI', 'DEEP', 'USDC']
)
// bals['0xBM_A']['0x2::sui::SUI'] = 5.123
```

### Withdraw

```typescript
// Withdraw specific amount
const tx = new Transaction()
tx.add(dbClient.balanceManager.withdrawFromManager(
  'main', 'SUI', 3.0, recipientAddress
))

// Withdraw all of a coin type
const tx = new Transaction()
tx.add(dbClient.balanceManager.withdrawAllFromManager(
  'main', 'SUI', recipientAddress
))
```

---

## Pool Constraints

Mỗi pool có constraints cho orders:

| Param | DEEP_SUI | SUI_USDC | Ý nghĩa |
|-------|----------|----------|---------|
| lot_size | 1,000,000 (1 DEEP) | 1,000,000,000 (1 SUI) | Qty phải là bội số |
| min_size | 10,000,000 (10 DEEP) | 10,000,000,000 (10 SUI) | Qty tối thiểu |
| tick_size | 10,000,000 (0.01 SUI) | 10,000 (0.00001 USDC) | Price phải là bội số |

```typescript
// Fetch constraints
const pools = await fetch(`${INDEXER}/get_pools`).then(r => r.json())
const pool = pools.find(p => p.pool_name === 'DEEP_SUI')
const lotSize = pool.lot_size / 10 ** pool.base_asset_decimals
const minSize = pool.min_size / 10 ** pool.base_asset_decimals

// Round quantity
qty = Math.floor(rawQty / lotSize) * lotSize
if (qty < minSize) throw new Error('Qty too small')
```

---

## OrderType Enum

```typescript
enum OrderType {
  NO_RESTRICTION = 0,      // Taker hoặc maker
  IMMEDIATE_OR_CANCEL = 1, // Fill ngay hoặc cancel
  FILL_OR_KILL = 2,        // Fill hết hoặc cancel hết
  POST_ONLY = 3,           // Chỉ maker, reject nếu would cross
}
```

**POST_ONLY** là quan trọng nhất cho hedging bot — đảm bảo order là maker (fee = 0).

---

## Vấn đề thường gặp

### 1. `withdraw_with_proof` abort code 3
**Nguyên nhân:** Manager không đủ balance cho order.
**Fix:** Check `checkManagerBalanceWithAddress` trước khi place order. Tính `qty * price <= available`.

### 2. `validate_inputs` abort code 2
**Nguyên nhân:** Quantity không đúng lot_size hoặc < min_size.
**Fix:** Round qty xuống bội số lot_size, check >= min_size.

### 3. Object version conflict
**Nguyên nhân:** 2 transactions dùng cùng Balance Manager object quá nhanh.
**Fix:** Thêm delay 1.5s giữa các tx, hoặc gộp vào 1 PTB.

### 4. Balance Manager created but not queryable
**Nguyên nhân:** BM là shared object, `getOwnedObjects` không tìm thấy. `getBalanceManagerIds` cần registry sync.
**Fix:** Parse object ID từ `sui_getTransactionBlock` response (`showObjectChanges: true`).

### 5. Tokens bị "giam" trong manager
**Nguyên nhân:** Deposit vào manager nhưng chưa withdraw.
**Fix:** Cancel all orders → withdrawAllFromManager cho mỗi coin type.

---

## Token Recycling

Sau mỗi maker cycle, tokens swap trong manager:
- A (Long): deposit SUI → buy DEEP → manager có DEEP thay vì SUI
- B (Short): deposit DEEP → sell DEEP → manager có SUI thay vì DEEP

Cần recycle:
```
A: withdraw DEEP → swap DEEP→SUI → deposit SUI
B: withdraw SUI → swap SUI→DEEP → deposit DEEP
```

**Quan trọng:** Swap phải dùng DeepBookClient **không có** `balanceManagers` config để tránh reference cùng BM object → version conflict.

```typescript
// ĐÚNG: plain client cho swap
const plainDb = new DeepBookClient({
  client, address, network,
  coins, pools, packageIds,
  // KHÔNG có balanceManagers
})

// SAI: client có BM → swap tx reference BM object → conflict
const dbWithBM = new DeepBookClient({
  ...,
  balanceManagers: { main: { address: bmId } },
})
```

---

## Mainnet Package IDs

```
DEEPBOOK_PACKAGE_ID: 0xf48222c4e057fa468baf136bff8e12504209d43850c5778f76159292a96f621e
REGISTRY_ID: 0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d
DEEP_TREASURY_ID: 0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe
```
