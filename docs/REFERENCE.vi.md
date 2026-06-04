# Tham Chiếu

Trang này tập hợp các tài liệu tham chiếu bên ngoài và tài liệu tham chiếu cấp
repo cần được kiểm tra trước khi thay đổi tài liệu, thiết lập hoặc workflow của
agent.

## Tài Liệu Tham Chiếu Bên Ngoài

| Tham chiếu | Dùng cho |
| --- | --- |
| https://github.com/hoangnb24/harness-experimental | Cấu trúc harness repo sẵn sàng cho agent: `HARNESS.md`, `FEATURE_INTAKE.md`, `ARCHITECTURE.md`, `TEST_MATRIX.md`, `product/`, `stories/`, `decisions/` và `templates/`. |
| https://github.com/rtk-ai/rtk | RTK CLI proxy và thiết lập hook cho Codex. |
| https://github.com/tobi/qmd | Thiết lập QMD local docs search và MCP server. |
| https://docs.sui.io/onchain-finance/deepbook-predict/ | Tổng quan DeepBook Predict, manager flow, vòng đời oracle, vault và ngữ cảnh giao dịch Predict. |
| https://docs.sui.io/develop/publish-upgrade-packages/versioning#example-escrow-swap | Ví dụ escrow swap của Sui cho các mẫu trao đổi P2P nguyên tử. |
| https://docs.scallop.io/scallop-lend/start | Hướng dẫn bridge asset sang Sui và onboarding người dùng của Scallop. |
| https://docs.scallop.io/protocol/oracles | Mô hình oracle của Scallop và các lưu ý về độ mới của oracle. |
| https://docs.scallop.io/integrations/contract-integration/borrowing-function | Luồng vay của Scallop và mô hình tích hợp dựa trên obligation. |
| https://docs.scallop.io/integrations/contract-integration/liquidation-function | Luồng liquidation của Scallop và yêu cầu cập nhật oracle. |

## Tài Liệu Tham Chiếu Trong Repo

| Tài liệu | Mục đích |
| --- | --- |
| `README.md` | Bản đồ tài liệu và vai trò thư mục. |
| `INDEX.md` | Chỉ mục vault theo kiểu Obsidian. |
| `HARNESS.md` | Vòng lặp tác vụ người-agent và thứ bậc nguồn. |
| `FEATURE_INTAKE.md` | Phân loại yêu cầu và các làn rủi ro. |
| `ARCHITECTURE.md` | Boundary kiến trúc và tài liệu nguồn. |
| `TEST_MATRIX.md` | Kỳ vọng validation theo loại công việc. |
| `QMD.md` | Thiết lập tìm kiếm docs cục bộ không dùng model LLM local. |
| `SETUP.md` | Ghi chú thiết lập project harness, RTK và QMD. |
| `product/predict-club.md` | Product contract Predict Club, vai trò, vòng đời, UI contract và mô hình interface. |
| `product/predict-club-architecture.md` | Sơ đồ kiến trúc Predict Club, cấu trúc file dự kiến và bản đồ validation. |
| `product/predict-club-escrow-contract.md` | Kế hoạch Move contract cho escrow SUI khóa thời gian và trao đổi escrow USDC/DUSDC tổng quát. |
| `product/predict-club-funding.md` | Funding Router cho SUI, USDC, vay Scallop, bridge handoff và DUSDC escrow. |
| `stories/plans/13-predict-club-community.md` | Story triển khai Predict Club với clean architecture, SOLID, design pattern, sơ đồ và validation. |
| `decisions/predict-club-architecture.md` | Quyết định custody lai và boundary policy cho group vault V2. |
| `decisions/predict-club-funding-escrow.md` | Quyết định P2P escrow cho nạp vốn club từ USDC sang DUSDC. |

## Cập Nhật Tài Liệu Gần Đây

- Đã thêm lớp tài liệu kiểu Harness được điều chỉnh từ
  `harness-experimental`.
- Đã thêm `docs/product/`, `docs/stories/`, `docs/decisions/` và
  `docs/templates/` làm các thư mục harness ổn định.
- Đã chuyển tài liệu planning của DeepBook Predict từ `docs/plans/` sang
  `docs/stories/plans/`.
- Đã thêm `docs/QMD.md` và cấu hình QMD cho tìm kiếm BM25 đơn giản trên
  `profile-docs`.
- Đã cấu hình MCP server global `qmd` cho Codex bằng `qmd mcp`.
- Đã xóa các file model GGUF cache của QMD để việc tìm kiếm docs thông thường
  không phụ thuộc vào model LLM cục bộ.
- Đã cấu hình RTK cho Codex bằng `rtk init -g --codex`.
- Đã thêm tài liệu sản phẩm, story và quyết định kiến trúc cho Predict Club dựa
  trên vòng lặp tác vụ Harness.
- Đã thêm tài liệu Predict Club Funding Router và escrow exchange bao quát
  DeepBook đổi SUI sang USDC, vay/liquidation/oracle của Scallop, bridge handoff
  và các offer P2P USDC sang DUSDC.
- Đã thêm tài liệu kế hoạch escrow contract của Predict Club, bao quát escrow
  SUI khóa thời gian, epoch release, approval cap và
  `EscrowOffer<OfferT, WantT>` tổng quát.
