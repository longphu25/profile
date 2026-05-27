# sui-deepbook-predict — Kiến trúc Plugin

## Tổng quan

Dashboard thị trường dự đoán DeepBook Predict trên Sui Testnet. Cung cấp analytics, mô phỏng chiến lược vault, vol-arb xuyên sàn, và giao dịch on-chain.

**Entry**: `sui-deepbook-predict.html` → `plugin.tsx`  
**Stack**: React + @mysten/sui v2 + Vite  
**Mạng**: Testnet  
**Build**: `bun run build`

---

## Cấu trúc File

```
plugins/sui-deepbook-predict/
├── plugin.tsx              — Entry + orchestrator (9 tabs)
├── types.ts                — Hằng số, interfaces
├── utils.ts                — Hàm format
├── sdk.ts                  — API fetch
├── strategies/
│   ├── svi.ts              — Tính bề mặt SVI + butterfly
│   ├── rangeLadder.ts      — Mô phỏng range-ladder vault
│   ├── plpHedge.ts         — PLP + Hedge vault
│   ├── marginLoop.ts       — Three-protocol margin loop
│   └── volArb.ts           — Vol-arb spread
├── hooks/
│   ├── usePredictData.ts   — Polling data
│   └── useWallet.ts        — Wallet sync
├── components/
│   ├── StrategyTab.tsx     — Range-ladder UI
│   ├── PLPHedgeTab.tsx     — PLP + Hedge UI
│   ├── MarginLoopTab.tsx   — Margin loop UI
│   └── ArbTab.tsx          — Vol-arb UI
├── services/
├── style.css
└── docs/
```

---

## Tabs (9)

| Tab | Mục đích |
|-----|----------|
| **Market** | Trạng thái protocol, oracle, biểu đồ giá |
| **Surface** | IV smile, time-travel, arbitrage checker |
| **Risk** | Sức khỏe vault, utilization, what-if |
| **Strategy** | Mô phỏng range-ladder vault |
| **PLP+Hedge** | PLP yield + bảo hiểm crash |
| **Loop** | Three-protocol margin loop |
| **Arb** | Vol-arb, Kelly sizing, oracle health |
| **Trade** | Mint/redeem binary + range |
| **Vault** | Supply/withdraw DUSDC ↔ PLP |

---

## Kỹ thuật: PLP + Hedge Vault

### Khái niệm

Cung cấp DUSDC vào `predict::supply` → kiếm PLP yield. Đồng thời mua DOWN binary OTM qua `predict::mint` → giới hạn drawdown khi crash.

**Sản phẩm**: "PLP yield trừ chi phí bảo hiểm crash"

### Công thức

```
Net APY = PLP_APY − (hedge_cost / capital) × (365 / expiry_days)
Dynamic hedge_ratio = base × (1 + utilization_adjustment)
  nếu util > 75%: ×1.4
  nếu util > 50%: ×1.2
Max drawdown (hedged) = (spot − lowest_strike) / spot × PLP_portion + insurance_cost
```

### Luồng sử dụng

1. **Đánh giá vault** → Tab Risk: xem utilization hiện tại
2. **Cấu hình chiến lược** → Tab PLP+Hedge: đặt capital, PLP %, OTM distance, số hedges
3. **Xem mô phỏng** → Kiểm tra net APY, max drawdown (hedged vs unhedged), vị thế hedge
4. **Thực thi PLP supply** → Tab Vault → Supply DUSDC → nhận PLP
5. **Thực thi hedges** → Tab Trade → Binary → DOWN → Strike tại mức OTM → Mint cho mỗi hedge
6. **Giám sát** → Tab Risk: nếu utilization tăng → tăng hedge ratio
7. **Gần hết hạn** → Nếu hedge không cần (BTC ổn định) → Redeem để thu hồi premium
8. **Settlement**:
   - BTC crash → hedges trả tiền, bù đắp PLP loss
   - BTC ổn định → PLP yield kiếm được, hedge cost là phí bảo hiểm đã trả

### Ví dụ cụ thể

```
Capital: $5,000
PLP allocation: 80% = $4,000 (earning ~12% APY)
Hedge allocation: 20% = $1,000 (3 DOWN binaries)

Hedge 1: Strike $68,000 (−10% OTM), cost $333, payout $3,330 if BTC < $68K
Hedge 2: Strike $64,000 (−15% OTM), cost $333, payout $5,000 if BTC < $64K
Hedge 3: Strike $60,000 (−20% OTM), cost $333, payout $8,330 if BTC < $60K

Kịch bản A (BTC ổn định): PLP earns $4,000 × 12% × (1h/8760h) = $0.05/hour. Hedge expires = −$1,000
Kịch bản B (BTC −15%): PLP loses ~$240. Hedge 1+2 pay $8,330. Net: +$7,090
```

---

## Kỹ thuật: Three-Protocol Margin Loop

### Khái niệm

Xếp chồng 3 protocol Sui DeFi trong một luồng composable:

```
iron_bank (gửi USDC → USDsui)
  → deepbook_margin (thế chấp USDsui → vay dUSDC)
    → predict (triển khai dUSDC vào range positions)
      → payout settlement trả nợ margin
```

**Sản phẩm**: "Đây là composability DeFi trên Sui thực sự trông như thế nào"

### Công thức

```
Leverage = LTV (ví dụ 0.7 = 1.7× exposure hiệu quả)
Net PnL = predict_payout + iron_bank_yield − margin_interest − predict_cost
LTV_hiện_tại = debt / collateral_value
Thanh lý: nếu LTV > 85% → đóng predict → trả nợ
```

### PTB Nguyên tử

```
PTB = [
  iron_bank::deposit(USDC, amount),              // → USDsui shares
  deepbook_margin::borrow(USDsui, amount×LTV),   // → dUSDC
  predict::mint_range(dUSDC, oracle, lower, upper) × N,
]
```

### Luồng sử dụng

1. **Hiểu stack** → Đọc mô tả tab Loop (3 protocols, 1 PTB)
2. **Cấu hình tham số**:
   - Collateral (USDC ban đầu)
   - LTV ratio (bao nhiêu % vay, ví dụ 70%)
   - Số range positions
   - Độ rộng range (% quanh spot)
   - iron_bank APY (yield trên deposit)
   - Margin borrow rate (chi phí leverage)
   - Expected predict return (nếu ranges ITM)
3. **Xem mô phỏng**:
   - Kiểm tra leverage multiplier
   - So sánh best-case APY (tất cả ITM) vs worst-case (tất cả OTM)
   - Kiểm tra liquidation price (LTV vượt 85%)
   - Xem bảng kịch bản (PnL + LTV tại mỗi mức giá)
4. **Thực thi bước 1: iron_bank deposit**
   - Gửi USDC vào iron_bank
   - Nhận USDsui share token (đang earn yield)
5. **Thực thi bước 2: deepbook_margin borrow**
   - Dùng USDsui làm collateral
   - Vay dUSDC theo LTV đã cấu hình
6. **Thực thi bước 3: predict range positions**
   - Tab Trade → Range mode → Mint
   - Mở N range positions với dUSDC đã vay
7. **Giám sát LTV**:
   - Nếu BTC giảm mạnh → LTV tăng
   - Nếu LTV gần 85% → đóng predict positions sớm
   - Dùng Redeem để thu hồi vốn trước thanh lý
8. **Settlement**:
   - Ranges ITM → nhận payout
   - Dùng payout trả nợ margin
   - Rút USDsui còn lại từ iron_bank
   - Lợi nhuận ròng = payouts + iron_bank_yield − borrow_interest − range_costs

### Đường thanh lý

```
LTV > 85% kích hoạt:
  1. predict::redeem_range (đóng tất cả positions)
  2. deepbook_margin::repay (trả dUSDC đã vay)
  3. deepbook_margin::withdraw_collateral (lấy lại USDsui)
  4. iron_bank::withdraw (chuyển USDsui → USDC)
```

### Ví dụ cụ thể

```
Collateral: $10,000 USDC
LTV: 70% → Vay $7,000 dUSDC
iron_bank APY: 5% → Yield: $10,000 × 5% × (1h/8760h) = $0.57/hour
Margin rate: 8% → Interest: $7,000 × 8% × (1h/8760h) = $0.64/hour
Predict: 5 ranges × $1,400 each

Best case (3/5 ranges ITM, 30% return):
  Payout: 3 × $1,400 × 1.3 = $5,460
  Cost: 5 × $1,400 = $7,000
  Net: $5,460 − $7,000 + $0.57 − $0.64 = −$1,540 + iron_bank yield
  
Worst case (0/5 ITM):
  Net: −$7,000 + $0.57 − $0.64 = −$7,000 (capped by collateral)
  LTV: ($7,000 + interest) / $10,000 = 70.06% → SAFE

BTC drops 20%:
  Collateral value: $10,000 × 0.9 = $9,000 (partial correlation)
  LTV: $7,064 / $9,000 = 78.5% → WARNING but not liquidated
```

---

## Kỹ thuật: Bề mặt SVI

```
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
IV(K) = √(w(k) / T) × 100%
```

Butterfly: `IV(K₂) > interpolated × 1.02` → vi phạm.

---

## Kỹ thuật: Range-Ladder Vault

```
PnL = Σ(payout_i × P(settlement ∈ rung_i)) − capital
```

---

## Kỹ thuật: Vol-Arb

```
spread = Predict_ATM_IV − External_IV
Kelly f* = min(0.25, |spread|/100 / σ_predict)
Kill switch: oracle lag > 30s
```

---

## Kỹ thuật: PLP Risk

```
vault_value = vault_balance − total_MTM
PLP_share_price = vault_value / total_PLP_supply
What-if: PnL = −MTM × |move%|
```

---

## Contract IDs (Testnet)

| Mục | Giá trị |
|-----|---------|
| Package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict Object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| DUSDC | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| Server | `https://predict-server.testnet.mystenlabs.com` |
