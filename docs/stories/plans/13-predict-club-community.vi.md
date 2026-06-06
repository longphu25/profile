# Kế Hoạch Cộng Đồng Predict Club

## Mục Tiêu

Tạo `predict-club.html` và plugin `predict-club` để giúp một cộng đồng điều
phối các round DeepBook Predict bằng chỉ báo, leader confirmation, cam kết của
thành viên, tự ký giao dịch và theo dõi quyết toán.

## Phạm Vi

Trong phạm vi:
- harness docs và story contract cho Predict Club
- kế hoạch trang `predict-club.html`
- kế hoạch plugin `plugins/predict-club` theo clean architecture
- local club state ở V1 và quy trình tự ký
- đồng thuận chỉ báo và checklist rủi ro
- simulation-only loan/liquidity planner
- Funding Router cho SUI, USDC, bridge handoff, Scallop borrow planning và DUSDC escrow exchange

Ngoài phạm vi:
- Move group vault contract
- automated custody cho tiền của thành viên
- real DeepBook Margin borrowing
- mainnet package ID hoặc custody production cho bước nhận kết quả

## Tài Liệu Liên Quan

- product docs cho Predict Club
- architecture docs
- quyết định về hybrid custody và escrow funding

## Phân Loại Rủi Ro

High-risk, vì chạm tới:
- wallet/signing
- authorization
- data model
- external systems
- public contract
- hành vi Predict hiện có
- quy trình tài chính đa domain

## Clean Architecture

UI → Application → Domain → Ports, với Infrastructure và Data bắc vào Ports.

## Cấu Trúc File Dự Kiến

Bao gồm:
- `predict-club.html`
- `src/predict-club/*`
- `plugins/predict-club/*`
- domain/application/data/infrastructure/presentation layers

## Plugin Runtime

Trang host nạp plugin, plugin đăng ký component, Host tạo shadow root và render
React portal.

## V1 Member Self-Sign Flow

Leader tạo proposal → thành viên pledge/accept → leader confirm → thành viên rà
soát và ký PTB → hệ thống theo dõi position cho tới quyết toán/nhận kết quả.

## Funding Router Flow

SUI → swap sang USDC hoặc vay Scallop → USDC → escrow sang DUSDC → deposit vào
PredictManager → mint.

## Escrow Exchange Flow

Maker tạo offer, filler điền payment coin, coin và payment được trao đổi nguyên
tử.

## Design Patterns

- Repository
- Adapter
- Strategy
- State Machine
- Command
- Policy Object
- Escrow

## Các Bước Triển Khai

1. ✅ thêm product/story/decision docs
2. ✅ thêm page shell (`predict-club.html`, `src/predict-club/`)
3. ✅ thêm plugin entry (`plugins/predict-club/plugin.tsx` v2.0 multi-slot)
4. ✅ implement pure domain + policy (`domain/types.ts`, `domain/policies.ts`, `domain/riskGate.ts`, `domain/indicatorConsensus.ts`, `domain/roundLifecycle.ts`, `domain/fixtures.ts`)
5. ✅ implement localStorage repo (`data/localClubStore.ts`, `data/clubStore.ts`)
6. ✅ implement read adapters và indicator gateway (`infrastructure/deepbookOracleService.ts`, `infrastructure/indicatorSignalGateway.ts`, `infrastructure/suiPredictGateway.ts`, `infrastructure/walletBalanceService.ts`)
7. ✅ implement use cases (`application/createRound.ts`, `application/confirmRound.ts`, `application/pledgeToRound.ts`, `application/settleRound.ts`, `application/claimSettlement.ts`, `application/manageEscrow.ts`, `application/executeTradeplan.ts`, `application/recommendFundingRoute.ts`)
8. ✅ build UI — multi-slot panel architecture (`PredictClubRoot`, `ClubPanel`, `PredictionRoomPanel`, `RiskPanel`, `DecisionStripPanel`, `FundingRouterPanel`, `EscrowOffersPanel`, `RoundHistoryPanel`, `ModalLayer`)
9. ✅ loan planner simulation-only với nhãn `Simulated`
10. ✅ Funding Router (SUI → USDC → Scallop → DUSDC → PredictManager)
11. ✅ update Vite inputs
12. ✅ xác minh build, plugin load, layout, tuyến nạp vốn và luồng ví

## Các Tính Năng Đã Thêm Ngoài Plan Gốc

- **OrderFlowChart** — biểu đồ candlestick TradingView lightweight-charts live với order flow overlay
- **Live wallet balances** — cân bằng ví thực thời gian thực qua `walletBalanceService`
- **Real PTB execution** — wire testnet DeepBook Predict PTB thật (`suiPredictGateway`)
- **Oracle status** — hiển thị trạng thái oracle trong RiskPanel và DecisionStrip
- **GSAP animations** — motion effects với `prefers-reduced-motion` support
- **MEXC proxy worker** — `workers/mexc-proxy/worker.js` cho price data
- **Stitch modal designs** — tất cả modals redesign theo Stitch mockups
- **Move contract scaffold** — `contracts/seal-policy` (scaffold)

## Validation

- ✅ build (Vite)
- ✅ Playwright E2E smoke (`bun run test:e2e`)
- ✅ browser smoke (predict-club.html)
- ✅ plugin load trong Shadow DOM (multi-slot v2)
- ✅ desktop/mobile layout
- ✅ rà soát thủ công luồng ví
- ✅ oracle status hiển thị, cũ/expiry chặn execution
- ✅ loan planner mang nhãn `Simulated`
- ✅ tuyến nạp vốn đúng cho SUI-only và USDC holder

## Trạng Thái

- **State: implemented V1, đang harden luồng wallet/member**
- Evidence: 37 commits Jun 3–5, tất cả các bước triển khai đã xong
- Next: V2 sẽ thêm Move group vault contract và real custody khi mainnet sẵn sàng

## Log Triển Khai - 2026-06-06

Đã triển khai trong session hiện tại:

- Thêm connect/disconnect ví từ header Predict Club và primary CTA.
- Xác định current member từ ví đang kết nối. Nếu ví chưa có trong demo club,
  app thêm một dòng local `You`.
- Thêm lookup PredictManager cho ví đang kết nối và action `Create Manager` khi
  chưa có manager.
- Sửa Decision Strip để `Connect Wallet` không bị risk gate chặn sai.
- Cập nhật `Fund to Join` để hiển thị wallet, club member, PredictManager, số dư
  DUSDC và các route funding preview-only.
- Cập nhật modal `Execute My Trade` để hiển thị stake của member, trạng thái
  manager/oracle, nhãn capped payout và checklist theo điều kiện thực.
- Sửa pledge accounting để pledge lặp lại cập nhật theo delta thay vì cộng lại
  toàn bộ số pledge.
- Thêm hạ tầng Playwright E2E:
  - `playwright.config.ts`
  - `tests/e2e/predict-club.spec.ts`
  - script `test:e2e` và `test:e2e:report` trong `package.json`
  - ignore `test-results/` và `playwright-report/`
- Cài Chromium browser binary cho Playwright để E2E chạy được.

Bằng chứng đã chạy:

- `rtk bun run build` pass.
- `rtk bun run test:e2e` pass với Chromium.
- Targeted ESLint pass cho các file Predict Club, Playwright config và E2E test mới.

Ranh giới hiện tại:

- Các funding route ngoài Direct DUSDC vẫn là preview-only trong UI hiện tại.
- Ví thật vẫn phải ký khi tạo PredictManager và khi execute Predict.
- Không được tuyên bố transaction Predict thành công trên network nếu chưa chạy
  giao dịch thật bằng ví trên Sui network mục tiêu.
- `bun run lint` toàn repo vẫn fail vì các lỗi lint tồn tại sẵn ngoài phạm vi story này.

Kế hoạch tiếp theo:

1. Thêm `deepbookPredictPricingService` để load oracle state, SVI latest/history,
   manager state và trả về quote model đã normalize cho round đang hoạt động.
2. Thêm pricing Predict qua `devInspect`: ABOVE/BELOW dùng
   `predict::get_trade_amounts`, RANGE dùng
   `predict::get_range_trade_amounts`.
3. Giữ fair-value SVI local làm fallback suy giảm cho `Win Probability` và UI
   giải thích, kèm lý do `Preview unavailable` rõ ràng khi thiếu forward, SVI,
   strike, quantity, wallet hoặc manager.
4. Cập nhật nhãn kết quả từ payout-only sang `Estimated cost`, `Gross if win`,
   `Potential profit` và `Risk/Reward`.
5. Thêm unit test cho scale SVI và fair-value math, cộng với test mock
   `devInspectTransactionBlock` cho ABOVE, BELOW, RANGE, stale SVI và quote
   unavailable.
6. Thêm wallet-mocked Playwright route hoặc fixture để test nhánh connected
   wallet mà không phụ thuộc browser extension.
7. Thêm fixture API/contract cho PredictManager để test trạng thái `Create
   Manager` và manager-ready một cách deterministic.
8. Thêm fixture số dư DUSDC và test luồng `Pledge DUSDC` trong funding modal.
9. Thêm execution-preview test cho `Execute My Trade` khi có thể đặt round vào
   trạng thái executable ổn định.
10. Thêm support portfolio cho manager-owned positions:
   - bảng binary `positions`
   - bảng RANGE `range_positions`
   - live close preview qua `devInspect`
   - hiển thị settled payout
   - chart và table cho trạng thái mixed binary/range
11. Thêm vault context vào execution UX:
   - vault balance
   - estimated open position payout / MTM
   - max payout coverage
   - available liquidity
   - PLP wallet/share display tùy chọn cho club LP flow sau này
12. Viết manual wallet runbook cho giao dịch testnet khi có test wallet đã được nạp tiền.
