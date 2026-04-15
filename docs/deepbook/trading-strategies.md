# DeepBook Trading Strategies — Lessons Learned

Kinh nghiệm thực tế từ việc chạy hedging bot trên mainnet.

---

## Strategy Comparison

| | Volume Farm | Maker (POST_ONLY) | Taker (Market Swap) |
|---|---|---|---|
| Wallets | **1** | 2 | 2 |
| Balance Manager | **Không cần** | Cần 2 BMs | Không cần |
| Auto-balance | **Không** | Cần | Cần |
| Token recycling | **Không** | Cần (phức tạp) | Cần |
| Chi phí/cycle | ~0.1% spread | ~0 (maker fee=0) | ~0.2% spread |
| Gas/cycle | ~0.006 SUI (2 tx) | ~0.009 SUI (3 tx) | ~0.012 SUI (4 tx) |
| Complexity | **Thấp** | Rất cao | Trung bình |
| Rủi ro mất vốn | **Rất thấp** | Trung bình-Cao | Trung bình |
| Volume/cycle | 2× notional | 2× notional | 2× notional |
| Points/cycle | Giống nhau | Giống nhau | Giống nhau |

### Khuyến nghị

- **Vốn nhỏ ($10-50):** Volume Farm — đơn giản, an toàn, tích points
- **Vốn trung bình ($50-500):** Volume Farm hoặc Taker
- **Vốn lớn ($500+):** Maker nếu hiểu rủi ro, Volume Farm nếu muốn an toàn

---

## Volume Farm Strategy (Recommended)

```
Flow:
1. Import 1 key (Account A)
2. Wallet có SUI
3. Cycle: BUY DEEP → hold 5-15s → SELL DEEP
4. Repeat
```

**Ưu điểm:**
- 1 ví, không cần Balance Manager
- Không cần auto-balance hay token recycling
- Không bị object version conflict
- Chi phí chỉ ~0.1% spread + gas
- Tokens luôn ở trong wallet (không bị "giam")

**Chi phí thực tế ($10 notional, DEEP_SUI):**
- Spread cost: ~$0.01/cycle
- Gas: ~0.003 SUI/cycle (~$0.003)
- Total: ~$0.013/cycle
- 24h (~2000 cycles): ~$26 cost
- Volume: ~$40K/day → ~40K points

---

## Maker Strategy — Vấn đề thực tế

### Tại sao Maker phức tạp hơn dự kiến

1. **Balance Manager lifecycle**: Tạo → deposit → trade → settle → withdraw → recycle
2. **Token recycling**: Sau mỗi cycle, tokens swap trong manager. A hết SUI (có DEEP), B hết DEEP (có SUI). Cần withdraw → swap → re-deposit.
3. **Object version conflict**: Balance Manager là shared object. 2 tx liên tiếp dùng cùng BM → version mismatch → tx rejected.
4. **Insufficient balance**: Deposit amount phải chính xác. Quá ít → order rejected. Quá nhiều → tokens locked.
5. **Pool constraints**: lot_size, min_size, tick_size phải đúng. Sai → MoveAbort.

### Chi phí ẩn của Maker

| Chi phí | Mô tả |
|---------|-------|
| Recycle swap | Mỗi lần recycle mất ~0.1-0.3% spread (taker swap) |
| Gas cho recycle | 3-4 tx mỗi lần recycle (~0.01 SUI) |
| Failed transactions | Tx fail vẫn tốn gas |
| Opportunity cost | Tokens locked trong BM không dùng được |

**Kết quả thực tế:** $20 vốn → lỗ $10 sau vài giờ do recycle swap fees tích lũy.

### Khi nào Maker có lợi

- Spread rộng (>0.5%) VÀ volume cao
- Vốn lớn (>$500) để amortize fixed costs
- Orders thực sự filled (không chỉ place rồi cancel)
- Không cần recycle thường xuyên

---

## DeepBook Fee Structure (Thực tế)

| Type | Fee | Ghi chú |
|------|-----|---------|
| Maker (POST_ONLY) | **0** | Miễn phí |
| Taker | ~0.025% | Trả bằng DEEP hoặc quote token |
| Swap (swapExact*) | **0 fee** nhưng mất spread | Spread = ask - bid |
| Gas | ~0.003 SUI/tx | Cố định |

**Quan trọng:** "Fee = 0" cho maker KHÔNG có nghĩa là miễn phí. Chi phí thực = spread + gas + recycle costs.

---

## Spread Analysis (Live Data)

```
Pool            Spread%   $/cycle($10)  $/day(2000cy)  Volume/day
USDT_USDC       0.001%    $0.0001       $0.20          $40K
SUI_USDC        0.042%    $0.0042       $8.40          $40K
WAL_USDC        0.051%    $0.0051       $10.20         $40K
DEEP_SUI        0.231%    $0.0231       $46.20         $40K
DEEP_USDC       1.490%    $0.1490       $298.00        $40K
```

**USDT_USDC** có spread thấp nhất → chi phí thấp nhất cho volume farming.
**DEEP_SUI** spread 0.23% → mất ~$46/ngày trên $10 notional (quá đắt).

### Pool tối ưu cho Volume Farm

1. **USDT_USDC** — spread 0.001%, chi phí gần 0. Nhưng cần USDT+USDC.
2. **SUI_USDC** — spread 0.04%, chi phí thấp. Cần SUI+USDC.
3. **WAL_USDC** — spread 0.05%. Cần WAL+USDC.

Nếu chỉ có SUI: dùng **SUI_USDC** (cần swap 1 phần sang USDC trước).

---

## Gas Optimization

| Approach | Gas/cycle | Ghi chú |
|----------|-----------|---------|
| 2 separate tx (buy+sell) | ~0.006 SUI | Hiện tại |
| 1 PTB (buy+hold+sell) | ~0.003 SUI | Cần refactor |
| Batch multiple cycles | ~0.002 SUI/cycle | Advanced |

**PTB (Programmable Transaction Block):** Gộp nhiều operations vào 1 tx. Tiết kiệm gas + tránh version conflict. Planned cho version tiếp theo.

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Private key exposure | Keys in memory only, encrypted vault for storage |
| Balance Manager lock | Withdraw All button in Accounts tab |
| Bot crash | Keys + BM IDs in localStorage, resume anytime |
| Slippage | Use 50% of available balance, not 100% |
| Version conflict | 1.5s delay between tx, plain client for swaps |
| Insufficient funds | Check balance before every order |
