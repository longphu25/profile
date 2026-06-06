# predict-club-probe.mjs — Tài liệu kỹ thuật

## Mục đích

Script probe đọc toàn bộ trạng thái on-chain liên quan đến DeepBook Predict
và wallet của user, phục vụ debug, monitoring, và ra quyết định trước khi
member tham gia round.

## Chạy

```bash
node scripts/predict-club-probe.mjs [options]
```

## Options

| Flag | Default | Mô tả |
|------|---------|-------|
| `--wallet` | `0x70b5...2f70` | Sui address cần probe |
| `--oracle` | `0x80a2...d951` | Oracle ID (BTC expiry) |
| `--side` | `above` | `above`, `below`, hoặc `range` |
| `--strike` | `59000` | Strike USD cho binary (above/below) |
| `--low` | `58000` | Low strike USD cho range |
| `--high` | `62000` | High strike USD cho range |
| `--contracts` | `100` | Số lượng contracts muốn quote |
| `--network` | `testnet` | `testnet` hoặc `mainnet` |

## Các việc script thực hiện

### 1. Wallet Balances
- Query SUI, DUSDC, PLP balances của wallet
- Dùng `client.getBalance()` cho từng coin type
- **Output:** SUI (gas), DUSDC (trading asset), PLP (LP shares)

### 2. PredictManager Lookup
- Gọi Predict Server API `/managers?owner=<wallet>`
- Tìm tất cả PredictManager objects thuộc wallet
- Sắp xếp theo checkpoint (mới nhất trước)
- **Output:** manager_id, owner, checkpoint, tx_index

### 3. Manager Object Detail
- `client.getObject()` trên manager_id với `showContent: true`
- Đọc balanceManager dynamic fields để tìm DUSDC balance bên trong
- **Output:** positions count, range_positions count, DUSDC balance in manager

### 4. Oracle State
- Gọi Predict Server `/oracles/<id>/state`
- Trả về: status, expiry, min_strike, tick_size, settlement_price
- Spot price, forward price, latest SVI parameters
- **Output:** Toàn bộ oracle state cho pricing

### 5. Vault State
- `client.getObject()` trên PREDICT_ID (shared Predict object)
- Đọc vault fields: balance, total_mtm, total_max_payout
- `devInspectTransactionBlock` gọi `available_withdrawal` để biết LP rút được bao nhiêu
- Tính: available_liquidity = balance - max_payout
- **Output:** vault value, LP supply, withdrawal limiter, LP activity

### 6. LP Activity
- Gọi `/lp/supplies` và `/lp/withdrawals` từ Predict Server
- Hiển thị latest supply/withdrawal event
- **Output:** ai vừa cung cấp/rút liquidity, bao nhiêu, khi nào

### 7. Quote Input Construction
- Từ oracle state (tick_size, min_strike) + user params (side, strike, contracts)
- Snap strike về đúng tick grid: `min_strike + round((raw - min) / tick) * tick`
- Build MarketKey (binary) hoặc RangeKey (range)
- **Output:** formatted quote input với raw values và USD values

### 8. SVI Fair-Value Preview (off-chain)
- Tính xác suất từ SVI parameters (Black-Scholes style)
- `log(strike/forward)` → implied vol → d2 → normalCDF
- Binary: P(above) hoặc 1 - P(above)
- Range: P(above_low) - P(above_high)
- **Output:** probability, fair contract price, expected cost, risk/reward

### 9. Contract devInspect Quote (on-chain)
- Build PTB gọi `get_trade_amounts` hoặc `get_range_trade_amounts`
- `devInspectTransactionBlock` — read-only, không cần gas/signature
- Parse return values (u64): mintCost, redeemPayout
- Tính: potential profit = quantity - mintCost, risk/reward ratio
- **Output:** chính xác giá on-chain cho position size đó

## Data Flow

```
┌────────────┐     ┌──────────────────┐     ┌───────────────┐
│  CLI args  │────►│  predict-club-   │────►│  Console      │
│            │     │  probe.mjs       │     │  Output       │
└────────────┘     └────────┬─────────┘     └───────────────┘
                            │
              ┌─────────────┼──────────────────┐
              │             │                  │
              ▼             ▼                  ▼
     ┌────────────┐  ┌───────────┐    ┌──────────────┐
     │ Sui JSON   │  │ Predict   │    │ devInspect   │
     │ RPC        │  │ Server    │    │ (read-only)  │
     │            │  │ REST API  │    │              │
     │ • balance  │  │ • /managers│   │ • available_ │
     │ • getObject│  │ • /oracles│   │   withdrawal │
     │ • dynamic  │  │ • /lp/*   │    │ • get_trade_ │
     │   fields   │  │           │    │   amounts   │
     └────────────┘  └───────────┘    └──────────────┘
```

## Dùng trong Predict Club

| Use case | Section probe | Ý nghĩa |
|----------|--------------|---------|
| Member có đủ DUSDC? | Wallet Balances | Check funding readiness |
| Member đã có Manager? | Manager Lookup | Skip create nếu đã có |
| DUSDC đã deposit vào Manager? | Manager Object | Biết balance sẵn sàng trade |
| Oracle còn active? | Oracle State | Block trade nếu expired |
| Vault còn liquidity? | Vault State | Warn nếu pool cạn |
| Giá trade bao nhiêu? | devInspect Quote | Hiển thị cost trước khi sign |
| Xác suất win? | SVI Preview | Risk context cho member |
| LP nên rút không? | Vault + LP Activity | Monitor vault health |

## Lưu ý

- Script **read-only** — không ký transaction, không dùng private key
- `devInspect` có thể fail nếu oracle expired hoặc strike ngoài range
- SVI preview là approximation — giá on-chain (devInspect) là source of truth
- PLP = Predict Liquidity Provider token (vault shares)
