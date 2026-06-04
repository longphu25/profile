# Kế Hoạch Hackathon DeepBook Predict Command Center

## Định Vị Dự Án

DeepBook Predict Command Center là terminal live cho analytics, strategy và
execution của DeepBook Predict.

- Track chính: DeepBook
- Nhóm chính: Analytics & Developer Tooling
- Entry chính: `sui-deepbook-predict.html`
- Plugin: `plugins/sui-deepbook-predict`

## Bề Mặt Sản Phẩm Hiện Tại

- Market
- Surface
- Risk
- Strategy
- PLP+Hedge
- Loop
- Arb
- Trade
- Vault
- Portfolio
- Lending
- Spot
- Keeper

## Luồng Demo

1. Mở `sui-deepbook-predict.html`
2. Chọn active BTC oracle trong tab Market
3. Giải thích SVI smile và fair value trong tab Surface
4. Xem PLP utilization và stress scenario trong tab Risk
5. Kết nối ví và mint position bằng DUSDC testnet trong tab Trade
6. Xem vị thế vừa tạo trong tab Portfolio
7. Quét settled positions trong tab Keeper
8. Dùng Spot/Lending/Loop để kể câu chuyện composability

## Kế Hoạch Trước Khi Nộp

### P0

- Thêm Demo Mode hoặc Hackathon Tour
- Gắn nhãn `Live on Testnet`, `Simulated`, `Requires DUSDC`, `Experimental`
- Viết README cấp plugin
- Ghi video demo 2-3 phút
- Xác nhận đường demo Market → Trade → Portfolio → Keeper chạy ổn

### P1

- So sánh oracle Predict với Pyth trong tab Arb
- Thêm Oracle Health Score
- Thêm PnL Attribution
- Cải thiện freshness indicator

### P2

- Strategy Composer
- Action checklist
- Batch intent preview
- Export/share strategy summary

### P3

- Giữ DeepBook margin thật và iron_bank atomic PTB ở mức roadmap
- Không mở rộng sang social/mobile app trong bản hackathon
- Tránh rewrite lớn plugin system trước khi nộp

## Nguồn

- DeepBook Predict docs
- DeepBook Predict design
- DeepBook builder hub
- Sui Overflow handbook
