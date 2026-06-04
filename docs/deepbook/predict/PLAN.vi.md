# DeepBook Predict Command Center - Kế Hoạch Hackathon

## Định Vị Dự Án

DeepBook Predict Command Center là một terminal trực tiếp cho phân tích, chiến
lược và thực thi của DeepBook Predict. Nó giúp trader, LP, quant và developer
hiểu được định giá SVI, rủi ro vault, PnL danh mục, luồng quyết toán và cách
các chiến lược Spot/Margin/Predict có thể kết hợp với nhau.

- Track chính: DeepBook
- Nhóm chính trong Idea Bank: Analytics & Developer Tooling
- Nhóm phụ: chiến lược vault, dịch vụ keeper, chênh lệch giá liên venue, sản phẩm cấu trúc có thể kết hợp
- Entry chính của app: `sui-deepbook-predict.html`
- Plugin: `plugins/sui-deepbook-predict`

## Bề Mặt Sản Phẩm Hiện Tại

Trang tĩnh nạp plugin `sui-deepbook-predict` và đã có các khả năng chính sau:

- Tab Market: tình trạng máy chủ, danh sách oracle, chi tiết oracle, biểu đồ giá, trạng thái trực tiếp
- Tab Surface: volatility smile SVI, time-travel, butterfly checker, tính toán fair value
- Tab Risk: PLP utilization, chỉ số vault, stress testing, kịch bản what-if
- Tab Strategy: mô phỏng range-ladder vault
- Tab PLP+Hedge: mô phỏng cấp thanh khoản PLP cộng hedge DOWN ngoài tiền
- Tab Loop: mô phỏng margin-loop ba protocol
- Tab Arb: tín hiệu vol-arb, Kelly sizing, tình trạng oracle, kill switch
- Tab Trade: kết nối ví, mint và redeem vị thế binary/range
- Tab Vault: nạp DUSDC và rút PLP
- Tab Portfolio: vị thế manager, PnL, xem trước fair value, các khoản quyết toán có thể nhận
- Tab Lending: supply/withdraw tại margin pool
- Tab Spot: giao dịch spot và order book của DeepBook
- Tab Keeper: quét các vị thế đã settled và xem trước batch redeem permissionless

## Luồng Demo

Dùng chuỗi sau cho video hackathon và phần walkthrough trực tiếp với ban giám khảo:

1. Mở `sui-deepbook-predict.html`.
2. Tab Market: chọn một BTC oracle đang hoạt động và hiển thị trạng thái server/oracle.
3. Tab Surface: giải thích SVI smile, fair value và butterfly-arbitrage checker.
4. Tab Risk: hiển thị PLP utilization, max payout và các kịch bản stress.
5. Tab Trade: kết nối ví và mint một vị thế binary hoặc range bằng DUSDC testnet.
6. Tab Portfolio: hiển thị vị thế vừa tạo, unrealized PnL và fair value estimate.
7. Tab Keeper: quét các vị thế đã settled và xem trước batch redeem.
8. Tab Spot/Lending/Loop: trình bày câu chuyện composability rộng hơn của Spot + Margin + Predict.

## Kế Hoạch Công Việc Trước Khi Nộp

### P0 - Sẵn Sàng Để Nộp

- Thêm Demo Mode hoặc Hackathon Tour để dẫn giám khảo qua luồng chính.
- Gắn nhãn mọi tính năng rõ ràng là `Live on Testnet`, `Simulated`, `Requires DUSDC` hoặc `Experimental`.
- Viết README ở cấp plugin với setup, demo script, kiến trúc, contract ID và giới hạn hiện tại.
- Ghi một video demo dài 2-3 phút.
- Xác nhận toàn bộ đường demo chạy ổn: Market -> Trade -> Portfolio -> Keeper.

### P1 - Chiều Sâu Kỹ Thuật

- Thêm so sánh Pyth trong tab Arb: oracle Predict so với độ lệch Pyth.
- Thêm Oracle Health Score dùng lag, tuổi SVI, độ hợp lý của spread và mức sẵn sàng quyết toán.
- Thêm PnL Attribution: tách riêng PnL do biến động giá, biến động fair-value/SVI và redeem đã chốt.
- Cải thiện chỉ báo độ mới của event và khả năng quan sát fallback polling.

### P2 - Độ Hoàn Thiện Sản Phẩm

- Thêm Strategy Composer cho PLP+Hedge, Range Ladder và Vol-Arb.
- Sinh action checklist từ từng cấu hình chiến lược.
- Thêm xem trước batch intent bằng một cú nhấp để hiển thị kế hoạch PTB trước khi thực thi.
- Thêm export/share cho phần tóm tắt chiến lược để hỗ trợ tài liệu nộp bài và chia sẻ.

### P3 - Chỉ Để Trong Roadmap

- Giữ DeepBook margin thật và iron_bank atomic PTB ở mức roadmap trừ khi mục tiêu tích hợp đã ổn định.
- Giữ các ý tưởng social/mobile app cho prediction ngoài phạm vi của bản build hackathon.
- Tránh các đợt rewrite lớn của plugin system trước khi nộp.

## Vận Hành Repo

Chạy các kiểm tra sau khi chuẩn bị bản nộp:

```bash
rtk bun run build
rtk bun run dev
```

Mở cục bộ:

```text
http://localhost:5173/sui-deepbook-predict.html
```

Trước khi commit hoặc push, theo quy tắc của repo:

- Tăng `patch` cho các sửa đổi nhỏ hướng người dùng hoặc bảo trì thường kỳ.
- Tăng `minor` cho công việc tính năng rộng hơn hoặc mở rộng hành vi đáng kể.
- Chỉ bỏ qua việc tăng version cho các thay đổi thật sự rất nhỏ như sửa typo hoặc comment.

## Câu Chuyện Hackathon

DeepBook Predict là protocol prediction market theo expiry trên Sui. Nó hỗ trợ
vị thế nhị phân, vertical range, định giá SVI theo oracle, tài khoản
PredictManager và thanh khoản vault PLP.

Dự án này đi theo mô hình tích hợp DeepBook Predict được khuyến nghị:

- Dùng public Predict server cho dữ liệu market, vault, portfolio và lịch sử đã sẵn sàng để render.
- Dùng streaming event/checkpoint của Sui cho cập nhật oracle có độ trễ thấp hơn.
- Dùng đọc on-chain trực tiếp và giao dịch ví ở các luồng cần xác nhận nghiêm ngặt.

Sản phẩm cho thấy vì sao DeepBook quan trọng như một primitive tài chính có thể
kết hợp:

- Analytics và công cụ cho developer giúp thị trường Predict dễ hiểu hơn.
- Công cụ PLP và hedge cho thấy tiềm năng chiến lược của vault.
- Công cụ keeper cho thấy khả năng tự động hóa vận hành.
- Các tab Spot, Lending và Loop cho thấy con đường tới các sản phẩm cấu trúc Spot + Margin + Predict.

## Nguồn

- Tài liệu DeepBook Predict: https://docs.sui.io/onchain-finance/deepbook-predict/
- Thiết kế DeepBook Predict: https://docs.sui.io/onchain-finance/deepbook-predict/design
- Thông tin contract DeepBook Predict: https://docs.sui.io/onchain-finance/deepbook-predict/contract-information
- DeepBook builder hub: https://www.deepbook.tech/builder-hub
- Sui Overflow handbook: https://mystenlabs.notion.site/overflow-2026-handbook
