# Bản Đồ Tài Liệu

Thư mục này được tổ chức như một harness dự án sẵn sàng cho agent, được điều
chỉnh từ cấu trúc `harness-experimental`, đồng thời vẫn giữ lại vault Obsidian
hiện có và các phần đào sâu theo domain.

## Bắt Đầu Từ Đây

- `INDEX.md`: chỉ mục knowledge base theo kiểu vault.
- `REFERENCE.md`: tài liệu tham chiếu bên ngoài và tài liệu tham chiếu cấp repo.
- `ORGANIZATION.md`: vai trò thư mục, chính sách ngôn ngữ và chính sách index
  QMD.
- `ROOT_DOC_AUDIT.md`: phân loại tài liệu root-level và các ứng viên di chuyển.
- `TERMINOLOGY.vi.md`: quy ước thuật ngữ tiếng Việt dùng cho các bản dịch
  `*.vi.md`.
- `SETUP.md`: thiết lập harness, RTK, QMD và MCP.
- `HARNESS.md`: cách con người và agent nên dùng bộ tài liệu này khi làm việc.
- `HARNESS_FACTORY.md`: bản port repo-native của logic skill `revfactory/harness`.
- `FEATURE_INTAKE.md`: cách phân loại yêu cầu trước khi triển khai.
- `ARCHITECTURE.md`: nguồn sự thật kiến trúc và các quy tắc boundary.
- `TEST_MATRIX.md`: kỳ vọng xác minh theo từng loại công việc.

## Các Thư Mục Harness

- `product/`: product contract hiện tại và các bản đồ hướng sản phẩm.
- `stories/`: story packet, roadmap slice và các kế hoạch lịch sử.
- `decisions/`: các quyết định bền vững và tradeoff.
- `demo/`: ví dụ nhỏ minh họa flow harness từ request tới validation.
- `templates/`: mẫu dùng lại cho story, decision và validation.

## Tài Liệu Root Cấp Dự Án

Giữ các bản đồ repo xuyên suốt và kiến trúc plugin/runtime dùng chung ở root
của `docs/` để dễ tìm từ chỉ mục Obsidian:

- `project-overview.md`, `repo-map.md`, `runtime-entry-points.md`
- `development-workflow.md`
- `plugin-architecture.md`, `plugin-architecture-wasm.md`, `plugin-wasm.md`
- `plugin-sui-wallet.md`, `plugin-catalog.md`, `plugin-ideas.md`
- `wasm-native.md`

Quy tắc đặt tài liệu chi tiết nằm trong `ORGANIZATION.md`.
Quyết định dọn root-level docs nằm trong `ROOT_DOC_AUDIT.md`.

## Các Thư Mục Domain

- `deepbook/`: tài liệu về giao dịch DeepBook, Predict, biểu đồ BTC và tài chính on-chain.
- `defi/navi/`: tài liệu về dashboard NAVI, advisor, chatbot, MCP và mở rộng.
- `seal/`: tài liệu plugin mã hóa Seal và policy.
- `walrus/`: tài liệu tích hợp Walrus storage.
- `zklogin/`: tài liệu zkLogin và ZK Merkle identity.
- `contracts/`: ghi chú về Move contract.

## Chính Sách Hiện Tại

Không thay thế các tài liệu domain bằng một bản đặc tả nguyên khối. Dùng
`product/` cho product truth ổn định, `stories/` cho công việc theo phạm vi,
`decisions/` để ghi lại lý do chọn hướng đi, và giữ các thư mục domain hiện có
cho chiều sâu kỹ thuật.

## Các Product Contract Đang Hoạt Động

- `product/predict-club.md`: điều phối cộng đồng DeepBook Predict với các round
  do leader xác nhận, thành viên tự ký thực thi, đồng thuận chỉ báo và ranh
  giới group vault trong tương lai.
- `product/predict-club-architecture.md`: sơ đồ kiến trúc, runtime boundary,
  cấu trúc file dự kiến và cấu trúc Move package tương lai.
- `product/predict-club-escrow-contract.md`: kế hoạch Move package cho escrow
  SUI khóa thời gian và escrow trao đổi USDC/DUSDC tổng quát.
- `product/predict-club-funding.md`: các tuyến nạp vốn cho thành viên chưa có
  DUSDC, gồm DeepBook đổi SUI sang USDC, vay Scallop, bridge handoff và club
  escrow exchange.

## Cập Nhật Thiết Lập Gần Đây

- Tài liệu harness được thêm vào với `harness-experimental` làm khung tổ chức.
- `docs/plans/` đã được chuyển vào `docs/stories/plans/`.
- QMD được cấu hình cho tìm kiếm tài liệu BM25 đơn giản qua collection
  `profile-docs`.
- QMD MCP đã được thêm vào cấu hình Codex global dưới dạng `qmd mcp`.
- QMD MCP đã được thêm vào cấu hình workspace của Kiro tại
  `.kiro/settings/mcp.json`.
- Các file model GGUF cục bộ của QMD đã bị xóa; dùng `qmd search` và `qmd get`
  cho nhu cầu tra cứu thông thường.
- RTK đã được cấu hình cho Codex bằng `rtk init -g --codex`.
- Kiro steering hiện có policy cho RTK và QMD.
