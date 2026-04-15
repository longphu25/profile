# DeepBook Margin Bot — Error Log & Fixes

Tất cả lỗi đã gặp khi chạy margin bot trên mainnet, nguyên nhân gốc, và cách khắc phục.

---

## 1. Margin pool not found for key: USDC

**Error**: `Margin pool not found for key: USDC`

**Nguyên nhân**: Truyền `packageIds` vào `DeepBookClient` constructor → SDK không auto-resolve `marginPools` → defaults to `{}` → `getMarginPool('USDC')` fails.

**Fix**: Bỏ `packageIds` khỏi `DeepBookClient` constructor cho margin operations. SDK tự resolve tất cả (coins, pools, marginPools, packageIds) từ network name.

```typescript
// SAI
new DeepBookClient({ client, address, network, coins, pools, packageIds, marginManagers: {...} })

// ĐÚNG
new DeepBookClient({ client, address, network, coins, pools, marginManagers: {...} })
```

---

## 2. POST_ONLY Cross — abort code 5

**Error**: `MoveAbort abort code: 5, in order_info::assert_execution`

**Nguyên nhân**: POST_ONLY order bị reject vì bid >= best ask (hoặc ask <= best bid). Xảy ra khi:
- Orderbook data stale (giá thay đổi giữa fetch và submit)
- Spread quá nhỏ (1 tick)
- Chỉ offset 1 tick không đủ

**Fix**:
1. Offset bid/ask 3 ticks thay vì 1: `safeBid = min(bestBid, bestAsk - tickSize * 3)`
2. Auto-retry 3 lần khi gặp abort code 5
3. Mỗi retry re-fetch orderbook và tăng offset lên 5 ticks

```typescript
safeBid = Math.min(bidPrice, askPrice - tickSize * 3)
safeAsk = Math.max(askPrice, bidPrice + tickSize * 3)
// Retry: offset 5 ticks
```

---

## 3. InsufficientCoinBalance — deposit thất bại

**Error**: `InsufficientCoinBalance in command 0`

**Nguyên nhân**: Wallet không đủ token để deposit vào MarginManager. Ví dụ: B cần deposit 2.1 SUI nhưng chỉ có 1.17 SUI.

**Fix**:
1. Fetch wallet balances trước khi tính deposit amount
2. Cap deposit = min(needed, available * 0.95)
3. Recalculate qty dựa trên leg nhỏ hơn
4. Auto-rebalance: swap token thừa → token thiếu trước mỗi cycle

```typescript
const aDeposit = Math.min(quotePerLeg, aAvail * 0.95)
const bDeposit = Math.min(qty, bAvail * 0.95)
qty = Math.floor(Math.min(qty, effectiveQtyFromA, effectiveQtyFromB) / lotSize) * lotSize
```

---

## 4. Qty < min size

**Error**: `Qty 0 < min 1` hoặc `Qty 0.8 < min 1`

**Nguyên nhân**: Sau khi cap deposit theo available balance, qty bị giảm xuống dưới pool minimum size (1 SUI cho SUI_USDC).

**Gốc rễ**: Tokens nằm sai ví — A có SUI dư nhưng thiếu USDC, B có USDC dư nhưng thiếu SUI.

**Fix**: Auto-rebalance trước mỗi cycle:
- Tính collateral cần: `halfNotional / borrowFactor`
- A thiếu quote → swap base→quote
- B thiếu base → swap quote→base
- Re-fetch balances sau swap

---

## 5. Floating point — qty không chính xác

**Error**: `Qty: 1.9000000000000001` → gây lỗi khi submit order

**Nguyên nhân**: JavaScript floating point arithmetic.

**Fix**: `qty = parseFloat(qty.toFixed(9))` sau mỗi phép tính qty.

---

## 6. USDC balance = 0 (sai decimals)

**Error**: `A has 0.00 USDC` nhưng thực tế có 3.92 USDC

**Nguyên nhân**: `findBal` chia cho `1e6` hay `1e9` dựa trên `symbol === 'USDC'` (case-sensitive). Caller truyền `'usdc'` (lowercase) → so sánh fail → USDC bị chia cho `1e9` → ra 0.003.

**Fix**: Dùng `symbol.toUpperCase()` cho comparison, hoặc truyền decimals trực tiếp từ pool metadata.

```typescript
// SAI
return match ? parseInt(match.totalBalance, 10) / (symbol === 'USDC' ? 1e6 : 1e9) : 0

// ĐÚNG
return match ? parseInt(match.totalBalance, 10) / 10 ** decimals : 0
```

---

## 7. React state async — mmId null khi cycle chạy

**Error**: Bot idle sau khi tạo Margin Manager thành công. `executeMarginCycle` return sớm vì `mmIdA === null`.

**Nguyên nhân**: `_setMmIdA(id)` là React state update (async). `executeMarginCycle()` chạy ngay sau nhưng state chưa cập nhật.

**Fix**: Dùng `useRef` để sync giá trị ngay lập tức:

```typescript
const mmIdARef = useRef(mmIdA)
const setMmIdA = (id: string) => { mmIdARef.current = id; _setMmIdA(id) }
// Trong executeMarginCycle:
const curMmIdA = mmIdARef.current  // đọc từ ref, không từ state
```

---

## 8. Withdraw abort code 8 — MM rỗng

**Error**: `MoveAbort abort code: 8, in margin_manager::withdraw`

**Nguyên nhân**: Gọi `withdrawBase('main', 0)` khi MM không có assets. `0` không có nghĩa "withdraw all" — nó gây abort.

**Fix**:
1. Query `getMarginManagerState` trước withdraw
2. Chỉ withdraw nếu asset > 0
3. Withdraw `amount * 0.999` (tránh rounding error)
4. Check debt = 0 trước withdraw (có debt → withdraw bị block)

```typescript
const state = await db.getMarginManagerState('main')
if (parseFloat(state.baseAsset) > 0) {
  db.marginManager.withdrawBase('main', parseFloat(state.baseAsset) * 0.999)(tx)
}
```

---

## 9. Repay abort code 10 — không có debt

**Error**: `MoveAbort abort code: 10, in margin_manager::repay_base`

**Nguyên nhân**: Gọi `repayBase('main')` khi không có base debt. SDK `repay(None)` = repay all, nhưng abort nếu debt = 0.

**Fix**: Mỗi repay trong tx riêng với try/catch:

```typescript
try { db.marginManager.repayBase('main')(tx); await signAndExec(kp, tx, net) }
catch { /* no base debt, skip */ }
```

---

## 10. Cross-asset debt — không repay được

**Error**: MM A có 5 SUI asset + 0.37 USDC debt. `repayQuote` cần USDC trong MM nhưng chỉ có SUI.

**Nguyên nhân**: Sau khi order fill, MM có asset loại này nhưng debt loại kia. `repayQuote` repay từ MM's quote assets, nhưng MM không có USDC.

**Fix**: Deposit token cần thiết từ wallet trước khi repay:

```typescript
if (quoteDebt > 0) {
  const needed = quoteDebt * 1.02  // +2% buffer cho interest
  const available = await walletBal(quoteSymbol)
  if (available < needed) {
    // Swap base→quote từ wallet
    swapExactBaseForQuote(...)
  }
  db.marginManager.depositQuote({ managerKey: 'main', amount: needed })(tx)
  db.marginManager.repayQuote('main')(tx)
}
```

---

## 11. Swap UnusedValueWithoutDrop

**Error**: `UnusedValueWithoutDrop { result_idx: 3 }`

**Nguyên nhân**: `swapExactQuoteForBase` trả về 3 coins (base, quote, deep). Nếu không `transferObjects` tất cả → Move VM abort vì unused value.

**Fix**: Transfer tất cả return values:

```typescript
// SAI
const baseCoin = db.deepBook.swapExactQuoteForBase({...})(tx)
tx.transferObjects([baseCoin], addr)  // thiếu quoteCoin, deepCoin

// ĐÚNG
const result = db.deepBook.swapExactQuoteForBase({...})(tx)
tx.transferObjects([...result], addr)  // spread all 3 coins
```

---

## 12. Gas exhaustion — cả 2 ví hết SUI

**Error**: `Both wallets low on SUI gas (A: 0.04, B: 0.03)`

**Nguyên nhân**: Mỗi cycle tiêu ~0.04 SUI gas (4-5 txs). Sau nhiều cycles + cleanup, cả 2 ví cạn SUI.

**Fix**:
1. Auto-topup: transfer 0.3 SUI từ ví giàu hơn khi ví kia < 0.2 SUI
2. Gas topup trong cleanup: nếu ví cần repay nhưng < 0.2 SUI → transfer từ ví kia
3. Error message rõ ràng khi cả 2 đều thiếu

---

## 13. Swap fail khi thiếu gas

**Error**: `Unable to perform gas selection due to insufficient SUI balance`

**Nguyên nhân**: Ví B cần swap USDC→SUI để repay base debt, nhưng không đủ SUI cho gas của swap tx.

**Fix**: Transfer SUI gas từ ví kia TRƯỚC khi swap:

```typescript
const suiBal = await walletBal('SUI')
if (suiBal < 0.2 && (baseDebt > 0 || quoteDebt > 0)) {
  // Transfer 0.3 SUI from other wallet for gas
  const otherKp = kp === kpA ? kpB : kpA
  tx.splitCoins(tx.gas, [tx.pure.u64(300_000_000)])
  tx.transferObjects([coin], addr)
  await signAndExec(otherKp, tx, net)
}
```

---

## 14. Cleanup không refresh UI

**Error**: Sau cleanup thành công, Accounts tab vẫn hiện MM balances cũ.

**Fix**: Gọi `fetchMmBals()` + `fetchBalance()` ở cuối `cleanupMargin`:

```typescript
// Cuối cleanupMargin:
fetchMmBals()
if (keypairARef.current) fetchBalance(addr).then(setBalA)
if (keypairBRef.current) fetchBalance(addr).then(setBalB)
```

---

## 15. Strategy dropdown thiếu "Margin"

**Error**: UI không có option "Margin" trong strategy selector.

**Nguyên nhân**: `onChange` handler chỉ cast sang `'taker' | 'maker' | 'volume' | 'directional'` — thiếu `'margin'`.

**Fix**: Thêm option + cast đúng type:

```tsx
<option value="margin">Margin (2 wallets, borrow+POST_ONLY, max points)</option>
onChange={(e) => setConfig(c => ({ ...c, strategy: e.target.value as BotConfig['strategy'] }))}
```

---

## Tổng kết Pattern

| Category | Errors | Root Cause |
|----------|--------|------------|
| SDK config | #1, #7 | packageIds override, marginPools empty |
| On-chain abort | #2, #8, #9, #10 | POST_ONLY cross, empty MM, no debt, cross-asset |
| Balance | #3, #4, #6, #12, #13 | Insufficient funds, wrong decimals, gas exhaustion |
| JavaScript | #5, #7 | Floating point, React async state |
| Move VM | #11 | Unused return values |
| UI | #14, #15 | Missing refresh, missing option |
