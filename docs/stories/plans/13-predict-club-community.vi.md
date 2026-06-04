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

1. thêm product/story/decision docs
2. thêm page shell
3. thêm plugin entry
4. implement pure domain + policy
5. implement localStorage repo
6. implement read adapters và indicator gateway
7. implement use cases
8. build UI quanh one active round / one primary action
9. loan planner chỉ là mô phỏng
10. thêm Funding Router
11. update Vite inputs
12. xác minh build, plugin load, layout, tuyến nạp vốn và luồng ví

## Validation

- build
- browser smoke
- plugin load trong Shadow DOM
- desktop/mobile layout
- rà soát thủ công luồng ví
- oracle cũ và expiry không an toàn phải chặn thực thi
- loan planner vẫn phải mang nhãn `Simulated`
- tuyến nạp vốn phải đúng cho ví chỉ có SUI và người giữ USDC

## Trạng Thái

- State: planned
- Evidence: product contract và architecture decision đã chốt boundary V1/V2
