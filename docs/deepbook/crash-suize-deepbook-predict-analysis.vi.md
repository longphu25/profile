# Crash.Suize.io — Phân Tích DeepBook Predict & Cơ Hội Cho Predict Club

**Ngày:** 2026-06-10
**Trạng thái:** Nghiên cứu / Phân tích đối thủ
**Nguồn:** https://crash.suize.io/

---

## 1. Crash.suize.io là gì

Crash.suize.io là một **frontend dạng "Crash Game"** xây trên DeepBook Predict
(Sui Testnet). Nó hiện thực hoá use case "tap to bet UP / DOWN" được mô tả
trong blog chính thức của DeepBook Predict.

Website là JavaScript SPA (không có server-rendered content), cho thấy client
React/Vue/vanilla kết nối tới:

- Sui wallet để ký giao dịch
- DeepBook Predict protocol để mint binary position
- Predict Server API cho dữ liệu oracle & market

### Cơ chế Crash Game (suy luận từ DeepBook Predict primitives)

| Khái niệm Crash Game | Mapping sang DeepBook Predict |
|-----------------------|-------------------------------|
| Multiplier tăng dần | Oracle price movement (spot đi lên) |
| Điểm crash | Expiry settlement / oracle settle tại giá cụ thể |
| Đặt UP / Cash out | Mint binary position `is_up = true`, redeem trước expiry |
| Đặt DOWN | Mint binary position `is_up = false` |
| Payout | Position trả khi settlement trên (UP) hoặc dưới (DOWN) strike |
| Settlement tức thì | Sui < 400ms finality |

Insight chính: **Suize biến binary options primitive thành UX game hoá** với
time-to-expiry ngắn (phút hoặc giây), tạo cảm giác "crash game":

- Oracle expiry ngắn → round nhanh
- Binary UP/DOWN positions → cơ chế cược đơn giản
- Oracle-driven settlement → provably fair on-chain
- Vault là counterparty → thanh khoản đảm bảo từ PLP providers

---

## 2. Kiến Trúc (Tái Dựng)

```
┌────────────────────────────────────────┐
│         crash.suize.io (SPA)           │
├────────────────────────────────────────┤
│  Wallet Connect (Sui dApp Kit)         │
│  Game UI (multiplier animation)        │
│  Position Manager (mint/redeem)        │
└────────┬──────────────┬────────────────┘
         │              │
         ▼              ▼
┌─────────────┐  ┌──────────────────────────────┐
│ Sui Testnet │  │ Predict Server (indexed API)  │
│ - Predict   │  │ - /oracles/:id/state          │
│ - Manager   │  │ - /oracles/:id/prices/latest  │
│ - OracleSVI │  │ - /managers/:id/positions     │
└─────────────┘  └──────────────────────────────┘
```

### Tương tác contract có thể:

1. **Create PredictManager** — setup 1 lần mỗi user
2. **Deposit DUSDC** — nạp tiền vào manager
3. **Mint binary position** — `predict::mint_position(predict, manager, oracle, expiry, strike, is_up, quantity)`
4. **Redeem position** — sau settlement, nhận payout
5. **Live price streaming** — WebSocket hoặc polling từ Predict Server

---

## 3. DeepBook Predict Hỗ Trợ Gì (Full Feature Set)

Từ docs chính thức (predict-testnet-4-16 branch):

### Core Objects

| Object | Mục đích |
|--------|----------|
| `Predict` | Shared object chính, vault + pricing + risk config |
| `PredictManager` | Account mỗi user, lưu balance + positions |
| `OracleSVI` | Market state mỗi asset/expiry (spot, forward, SVI params) |
| `Vault` | Thanh khoản chung, PLP shares, exposure tracking |

### Oracle Lifecycle

```
Inactive → Active → Pending Settlement → Settled
```

- Active: nhận live price + SVI updates, cho phép mint
- Settled: giá post-expiry đầu tiên đóng băng settlement, chỉ redeem

### Loại Position

1. **Binary positions** — `MarketKey(oracle_id, expiry, strike, is_up)`
   - Trả khi settlement trên (UP) hoặc dưới (DOWN) strike
2. **Vertical ranges** — `RangeKey(oracle_id, expiry, lower_strike, higher_strike)`
   - Trả khi settlement nằm trong `(lower, higher]`

### Pricing

- SVI volatility surface → fair value
- Protocol spread + utilization adjustments
- Global và per-oracle ask bounds
- Vault exposure check đảm bảo risk limits

### Public Server API

Base: `https://predict-server.testnet.mystenlabs.com`

Endpoints chính:
- `GET /predicts/:id/state` — protocol state
- `GET /predicts/:id/oracles` — danh sách oracle
- `GET /oracles/:id/state` — oracle state hiện tại
- `GET /oracles/:id/prices/latest` — giá mới nhất
- `GET /managers/:id/positions/summary` — positions của user
- `GET /managers/:id/pnl?range=ALL` — lịch sử PnL
- `GET /predicts/:id/vault/summary` — sức khoẻ vault

### Contract IDs (Testnet, tạm thời)

| Item | Value |
|------|-------|
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| DUSDC type | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| PLP type | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Source branch | `predict-testnet-4-16` |

### Live Events (cho UI low-latency)

Filter theo package ID:
- `oracle::OraclePricesUpdated`
- `oracle::OracleSVIUpdated`
- `oracle::OracleSettled`
- `oracle::OracleActivated`

---

## 4. Cơ Hội Cho Predict Club

### 4a. Quick-Round Mode Game Hoá (lấy cảm hứng từ Suize Crash)

Predict Club hiện tập trung vào community-driven trading rounds với
leader khởi tạo proposal. Suize cho thấy **binary positions expiry ngắn
có thể trình bày dạng game nhanh**.

**Ý tưởng tích hợp: chế độ "Quick Predict"**

| Tính năng | Cách làm |
|-----------|----------|
| Round nhanh (1-5 phút expiry) | Lọc oracle có expiry ngắn nhất đang active |
| Tap UP / DOWN | UX đơn giản hoá mint_position, không chọn strike (dùng ATM) |
| Hiển thị multiplier live | Stream oracle price, show fair value hiện tại dạng "multiplier" |
| Auto-redeem khi settle | Keeper auto-claim khi oracle settled |
| Cược nhóm | Leader chọn oracle + expiry, members tap vào |

Tạo ra **social crash game**:
- Leader thông báo "BTC 5 phút, strike 95000"
- Members tap UP hoặc DOWN trong 30 giây
- Oracle settle → payout tự phân phối
- Leaderboard club theo dõi win rate

### 4b. Kết Hợp Với Predict Club Escrow

Escrow contract hiện có hỗ trợ DUSDC lending cho crash rounds:
- Member có SUI nhưng không có DUSDC → escrow swap → chơi
- Lock period ngắn phù hợp với quick escrow release

### 4c. PLP Vault Làm Club Treasury

Club có thể supply DUSDC vào Predict vault dạng PLP:
- Members cùng đóng vai liquidity provider
- Lợi nhuận PLP chia tỉ lệ
- Rủi ro: vault đối ứng mọi trade, PLP club chịu directional risk

### 4d. Vertical Range Như "Cược Có Giới Hạn"

Ngoài crash-style binary, Predict Club có thể offer:
- "Giá nằm giữa X và Y" → vertical range position
- Payout cao hơn cho range hẹp hơn (dự đoán chính xác hơn)
- Strategy rounds nơi leader chỉ định range corridor

### 4e. Kết Hợp Với Margin

Blog DeepBook ghi rõ `Predict + Margin` = "Tap to bet UP/DOWN apps
với đòn bẩy". Predict Club có thể:
- Offer binary positions có đòn bẩy
- Borrow DUSDC qua margin để tăng size
- Risk controls qua club policy (max leverage mỗi member)

---

## 5. Khác Biệt Chính: Suize Crash vs Predict Club

| Khía cạnh | Suize Crash | Predict Club |
|-----------|-------------|--------------|
| UX metaphor | Casino crash game | Trading community |
| Người quyết định | Cá nhân | Leader dẫn dắt |
| Thời gian round | Rất ngắn (giây-phút) | Linh hoạt (phút-giờ) |
| Độ sâu phân tích | Không (game hoá) | Indicators, SVI, thesis |
| Giáo dục rủi ro | Tối thiểu | Bắt buộc (oracle health, max loss) |
| Funding | DUSDC trực tiếp | Funding router (swap, borrow, escrow) |
| User mục tiêu | Retail gambler | Trader/community có hiểu biết |
| Composability | Single position | Có thể layer Margin, Spot, PLP |

---

## 6. Takeaways Kỹ Thuật Cho Implementation

### Suize làm tốt:
1. **Onboarding đơn giản** — create PredictManager + deposit trong 1 PTB
2. **Real-time price feed** — WebSocket/polling oracle prices
3. **UX nhanh** — Sui finality < 400ms làm crash animation responsive
4. **Chọn oracle tự động** — pre-pick expiry ngắn nhất, ATM strike

### Predict Club nên áp dụng:
1. **Streaming oracle price** — hiện tại dùng polling; nên dùng event subscription cho live rounds
2. **One-click binary mint** — đơn giản hoá execution path cho "quick mode"
3. **Auto-redeem khi settlement** — keeper scan + batch redeem cho settled positions
4. **Tái sử dụng PredictManager** — không tạo manager mới mỗi round

### Predict Club KHÔNG nên áp dụng:
1. Bỏ risk disclosure (crash games che giấu rủi ro thật)
2. Ẩn bản chất options-pricing (members nên thấy SVI fair value)
3. Trading tự động không cần user signature (quy tắc V1)

---

## 7. Bước Tiếp Theo Đề Xuất

1. **Prototype tab "Quick Predict"** trong Predict Club plugin dùng
   short-expiry oracles với UX UP/DOWN đơn giản
2. **Tích hợp oracle event streaming** cho price animation live
3. **Thêm auto-redeem keeper** vào club round settlement flow
4. **Nghiên cứu PLP strategy** cho club treasury yield
5. **Theo dõi source Suize Crash** (có thể open-source tại hackathon) để học
   SDK patterns và PTB construction

---

## Tham Khảo

- [DeepBook Predict Overview](https://docs.sui.io/onchain-finance/deepbook-predict/)
- [DeepBook Predict Design](https://docs.sui.io/onchain-finance/deepbook-predict/design)
- [DeepBook Predict Contract Info](https://docs.sui.io/onchain-finance/deepbook-predict/contract-information)
- [Introducing DeepBook Predict (Blog)](https://blog.sui.io/introducing-deepbook-predict/)
- [DeepBook Waitlist Announcement](https://blog.sui.io/the-waitlist-is-open/)
- [DeepBookV3 Source (predict-testnet-4-16)](https://github.com/MystenLabs/deepbookv3/tree/predict-testnet-4-16/packages/predict)
- [Predict Club Product Contract](../product/predict-club.md)
- [Predict Club Funding Router](../product/predict-club-funding.md)
