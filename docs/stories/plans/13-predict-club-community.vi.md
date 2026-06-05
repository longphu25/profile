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
- ✅ browser smoke (predict-club.html)
- ✅ plugin load trong Shadow DOM (multi-slot v2)
- ✅ desktop/mobile layout
- ✅ rà soát thủ công luồng ví
- ✅ oracle status hiển thị, cũ/expiry chặn execution
- ✅ loan planner mang nhãn `Simulated`
- ✅ tuyến nạp vốn đúng cho SUI-only và USDC holder

## Trạng Thái

- **State: completed (V1)**
- Evidence: 37 commits Jun 3–5, tất cả các bước triển khai đã xong
- Next: V2 sẽ thêm Move group vault contract và real custody khi mainnet sẵn sàng
