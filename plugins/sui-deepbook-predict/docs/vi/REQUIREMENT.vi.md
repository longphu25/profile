# DeepBook Predict — Yêu cầu Hackathon

**Đề bài**: [DeepBook Predict — Notion](https://mystenlabs.notion.site/deepbook-predict-problem-statement)

---

## Tổng quan Track

DeepBook Predict là giao thức prediction market dựa trên vol-surface, có expiry, trên Sui. Track hackathon này thách thức builder xây dựng sản phẩm và công cụ sáng tạo xung quanh nó.

---

## DeepBook Predict cung cấp gì

- Live trên Sui Testnet với BTC oracle rolling sub-hour
- API/Indexer công khai tại `predict-server.testnet.mystenlabs.com`
- Tài sản báo giá: dUSDC
- Mainnet launch đã lên kế hoạch — project hackathon sẽ redeploy ngày đầu tiên
- Composable với DeepBook spot, `deepbook_margin`, và `iron_bank` (đã live trên mainnet)

---

## Các hạng mục quan tâm

### 1. Chiến lược Vault
Vốn được phân bổ tự động qua các vị thế Predict, ranges, và PLP supply.
- Range-ladder vaults
- PLP+hedge vaults
- BTC-collateralized premia harvesters
- Vòng lặp margin ba giao thức

### 2. Arbitrage Xuyên sàn
Bot theo dõi vol surface của Predict so với thị trường bên ngoài.
- Predict vs Polymarket / Hyperliquid event markets
- Predict vs Hyperliquid perps spread trading

### 3. Frontend Phong cách khác
UI phi truyền thống với hành vi độc đáo.
- App prediction gamified
- PWA mobile-first
- Telegram bot
- Social feeds, giao dịch qua chat, streaks

### 4. Analytics & Developer Tooling ← **Hạng mục của chúng tôi**
Làm cho Predict dễ đọc và kiểm tra.
- **Live SVI surface viewers** ✅
- **PLP risk dashboards** ✅
- Manager PnL attribution
- Settlement leaderboards
- Oracle-feed health monitors

### 5. Tích hợp & Tooling
- Token hóa share trên PredictManager
- Compose với `deepbook_margin` + `iron_bank`
- Keeper services (settled-redeem, oracle monitors, withdrawal-limiter watchers)
- Developer tools để inspect/debug Predict markets

---

## Yêu cầu tối thiểu

| Yêu cầu | Trạng thái |
|----------|------------|
| Tích hợp DeepBook Predict contract trên testnet | ✅ Server API + on-chain mint/redeem/supply/withdraw |
| Hoạt động end to end (toàn bộ flow test được) | ✅ Wallet connect → chọn oracle → trade → TX digest |
| Kết quả mô phỏng hợp lệ (nếu vault strategy) | ✅ What-if scenario simulator với PnL output |

---

## Mapping Project của chúng tôi

| Hackathon yêu cầu | Chúng tôi đã xây |
|--------------------|-------------------|
| Live SVI surface viewers | **Surface Studio** — IV smile từ SVI params on-chain, slider time-travel, kiểm tra arbitrage |
| PLP risk dashboards | **PLP Risk Dashboard** — Sức khỏe vault, gauge utilization, mô phỏng what-if, lịch sử PLP |
| Developer tools | **Tab Market** — Trạng thái protocol, danh sách oracle, lịch sử giá, tất cả contract IDs |
| End-to-end product | **Tab Trade** — Wallet connect, mint/redeem binary + range positions |
| LP flow | **Tab Vault** — Supply DUSDC → PLP, Withdraw PLP → DUSDC |

---

## Điểm khác biệt chính

1. **Triển khai công thức SVI** — Tính toán client-side toàn bộ volatility smile từ tham số on-chain thô, không chỉ hiển thị số
2. **Kiểm tra Butterfly Arbitrage** — Phát hiện tự động vi phạm no-arbitrage trong smile
3. **Time-Travel** — Phát lại SVI updates để quan sát bề mặt tiến hóa theo thời gian
4. **Stress Testing What-If** — Mô phỏng PLP PnL dưới biến động BTC cực đoan (±50%)
5. **Full Trading Flow** — Không chỉ analytics — người dùng thực sự có thể mint/redeem positions
6. **Kiến trúc Plugin** — Portable, nhúng được vào bất kỳ Sui frontend nào qua Shadow DOM

---

## Điểm tích hợp kỹ thuật

| Thành phần Protocol | Cách tích hợp |
|--------------------|---------------|
| `predict-server` API | Tất cả market data, oracle state, vault summary, lịch sử price/SVI |
| `predict::mint_position` | Mint vị thế nhị phân qua ví |
| `predict::redeem_position` | Redeem vị thế nhị phân |
| `predict::mint_range` | Mint dải dọc |
| `predict::redeem_range` | Redeem dải dọc |
| `predict::supply` | Cung cấp thanh khoản vault (DUSDC → PLP) |
| `predict::withdraw` | Rút thanh khoản vault (PLP → DUSDC) |
| `OracleSVI` events | Lịch sử tham số SVI cho trực quan hóa bề mặt |
| `OraclePricesUpdated` events | Lịch sử giá cho biểu đồ |

---

## Yêu cầu Token Testnet

Yêu cầu DUSDC qua: https://tally.so/r/Xx102L

---

## Tham khảo

- [DeepBook Predict Docs](https://docs.sui.io/onchain-finance/deepbook-predict/)
- [Design](https://docs.sui.io/onchain-finance/deepbook-predict/design)
- [Contract Information](https://docs.sui.io/onchain-finance/deepbook-predict/contract-information)
- [DeepBookV3 Repository (predict branch)](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)
