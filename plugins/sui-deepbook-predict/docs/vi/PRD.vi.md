# DeepBook Predict — Tài liệu Yêu cầu Sản phẩm

## Tóm tắt

Dashboard thị trường dự đoán DeepBook Predict trên Sui Testnet. Analytics, mô phỏng chiến lược vault (range-ladder, PLP+hedge, three-protocol loop), vol-arb xuyên sàn, giám sát rủi ro, giao dịch on-chain.

**Người dùng**: Trader, LP, quant, vault strategist, developer  
**Mạng**: Sui Testnet | **Quote**: DUSDC

---

## Tính năng (9 Tabs)

### F1: Tổng quan Thị trường ✅
Server health, oracle list, oracle detail, price chart, auto-refresh 20s.

### F2: Surface Studio ✅
IV smile từ SVI, time-travel, butterfly checker, công thức, ATM/violation highlighting.

### F3: PLP Risk Dashboard ✅
Vault metrics, utilization gauge, what-if (±50%), PLP history, per-oracle exposure.

### F4: Range-Ladder Vault ✅
Config (capital, rungs, width%), PnL scenarios (±30%), formulas.

### F5: PLP + Hedge Vault ✅

| Yêu cầu | ✅ |
|----------|---|
| PLP supply allocation (cấu hình %) | ✅ |
| OTM DOWN binary hedges (cấu hình OTM distance) | ✅ |
| Dynamic hedge ratio theo vault utilization | ✅ |
| Tính Net APY (gross − insurance cost) | ✅ |
| So sánh max drawdown (hedged vs unhedged) | ✅ |
| Bảng hedge positions (strike, cost, payout, ITM prob) | ✅ |
| Biểu đồ PnL (−50% đến +20% BTC) | ✅ |
| Giải thích chiến lược + công thức | ✅ |
| Tài liệu user flow | ✅ |

**Công thức**: `Net APY = PLP_APY − (hedge_cost / capital) × (365 / expiry_days)`

### F6: Three-Protocol Margin Loop ✅

| Yêu cầu | ✅ |
|----------|---|
| Mô phỏng iron_bank deposit (USDC → USDsui) | ✅ |
| Mô phỏng deepbook_margin borrow (USDsui → dUSDC) | ✅ |
| Mô phỏng predict range deployment | ✅ |
| Tính leverage | ✅ |
| Best-case / worst-case APY | ✅ |
| Tính liquidation price | ✅ |
| Phân tích worst-case LTV | ✅ |
| Trực quan protocol flow (3 bước) | ✅ |
| Bảng kịch bản PnL + LTV | ✅ |
| Trạng thái liquidation mỗi kịch bản | ✅ |
| Mô tả atomic PTB | ✅ |
| Giải thích + công thức | ✅ |
| Tài liệu user flow | ✅ |

**Công thức**: `Net PnL = predict_payout + iron_bank_yield − margin_interest − predict_cost`

### F7: Vol-Arb Xuyên sàn ✅
Giá ngoài, ATM IV, realized vol, spread, signal, Kelly, oracle health, kill switch.

### F8: Giao dịch ✅
Wallet connect, binary + range, mint/redeem, TX submission.

### F9: Vault Supply/Withdraw ✅
Supply DUSDC → PLP, withdraw PLP → DUSDC.

---

## Luồng Sử dụng

### PLP + Hedge Vault

```
┌─────────────────────────────────────────────────────────┐
│ 1. Tab Risk: Kiểm tra vault utilization                  │
│ 2. Tab PLP+Hedge: Cấu hình chiến lược                   │
│    ├── Capital: $5,000                                   │
│    ├── PLP: 80% ($4,000)                                 │
│    ├── Hedges: 20% ($1,000) → 3 DOWN binaries           │
│    └── OTM: 10% dưới spot                               │
│ 3. Xem: Net APY, max drawdown, hedge positions           │
│ 4. Tab Vault: Supply $4,000 DUSDC → PLP                 │
│ 5. Tab Trade: Mint 3× DOWN binary tại OTM strikes       │
│ 6. Giám sát: Tab Risk cho thay đổi utilization           │
│ 7. Gần hết hạn: Redeem hedges nếu không cần             │
│ 8. Settlement: Hedge trả nếu crash, PLP earn nếu ổn     │
└─────────────────────────────────────────────────────────┘
```

**Giải thích từng bước:**

1. **Đánh giá rủi ro**: Utilization cao = vault đang chịu nhiều exposure → cần hedge nhiều hơn
2. **Cấu hình**: Simulator tự tính dynamic hedge ratio dựa trên utilization
3. **Review**: So sánh "có hedge" vs "không hedge" — max drawdown giảm đáng kể
4. **Supply PLP**: Gửi phần lớn vốn vào vault để earn yield (giống gửi tiết kiệm)
5. **Mua bảo hiểm**: Mint DOWN binary = "nếu BTC crash dưới strike, tôi được trả tiền"
6. **Giám sát**: Nếu utilization tăng đột biến → cân nhắc tăng hedge
7. **Gần hết hạn**: Nếu BTC ổn định → hedge sắp hết giá trị → redeem sớm thu hồi phần nào
8. **Kết quả**: Crash → hedge bù lỗ PLP. Ổn định → PLP yield − hedge cost = net profit

### Three-Protocol Margin Loop

```
┌─────────────────────────────────────────────────────────┐
│ 1. Tab Loop: Cấu hình tham số                           │
│    ├── Collateral: $10,000                               │
│    ├── LTV: 70% → Vay $7,000                            │
│    ├── Ranges: 5 × $1,400                                │
│    └── Width: 8% quanh spot                              │
│ 2. Xem: Leverage, APY range, liquidation price           │
│ 3. Bước 1: iron_bank deposit (USDC → USDsui)            │
│ 4. Bước 2: deepbook_margin borrow (→ dUSDC)             │
│ 5. Bước 3: Tab Trade → Mint 5 range positions           │
│ 6. Giám sát LTV:                                        │
│    ├── LTV < 70%: AN TOÀN                                │
│    ├── LTV 70-85%: CẢNH BÁO (cân nhắc đóng)            │
│    └── LTV > 85%: RỦI RO THANH LÝ                       │
│ 7. Settlement: Thu payout từ ranges ITM                  │
│ 8. Tháo gỡ: Trả margin → Rút iron_bank → Lợi nhuận    │
└─────────────────────────────────────────────────────────┘
```

**Giải thích từng bước:**

1. **Cấu hình**: Chọn mức leverage (LTV) và số ranges. LTV cao = lợi nhuận cao nhưng rủi ro thanh lý cao
2. **Review**: Simulator cho thấy tại giá nào bị thanh lý, APY tốt nhất/xấu nhất
3. **iron_bank**: Gửi USDC → nhận USDsui (token sinh lời, dùng làm collateral)
4. **deepbook_margin**: Thế chấp USDsui → vay dUSDC (đây là leverage)
5. **predict**: Dùng dUSDC đã vay để mở range positions (đặt cược BTC ở trong khoảng)
6. **Giám sát**: Nếu BTC giảm → collateral mất giá → LTV tăng → nguy cơ thanh lý
7. **Settlement**: Ranges ITM trả tiền → dùng trả nợ margin
8. **Tháo gỡ**: Trả hết nợ → lấy lại USDsui → rút từ iron_bank → USDC + lợi nhuận

**Đường thanh lý (nếu LTV > 85%):**
```
predict::redeem_range → deepbook_margin::repay → withdraw_collateral → iron_bank::withdraw
```

---

## Ràng buộc

1. Testnet only (ID thay đổi khi mainnet)
2. Cần DUSDC (yêu cầu qua form)
3. Oracle ~1s updates
4. Vault chịu rủi ro hướng
5. SVI integer encoding
6. External API rate limits
7. Realized vol là xấp xỉ
8. iron_bank + deepbook_margin là mô phỏng (chưa live trên testnet predict)
