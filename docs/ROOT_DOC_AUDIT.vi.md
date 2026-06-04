# Audit Tài Liệu Root

Audit này phân loại các file Markdown đang nằm ở `docs/*.md`. Mục tiêu là tránh
việc dọn cây thư mục bằng cách di chuyển file mù quáng rồi làm hỏng Obsidian
links hoặc đường tra cứu QMD.

## Phân Loại

| File | Vai trò hiện tại | Khuyến nghị | Lý do |
| --- | --- | --- | --- |
| `README.md` | Bản đồ harness | Giữ root | Điểm vào chính của docs. |
| `INDEX.md` | Chỉ mục Obsidian | Giữ root | Bề mặt điều hướng vault. |
| `HARNESS.md` | Mô hình vận hành harness | Giữ root | Artifact lõi của repository-harness. |
| `FEATURE_INTAKE.md` | Phân loại công việc | Giữ root | Artifact lõi của repository-harness. |
| `ARCHITECTURE.md` | Boundary kiến trúc | Giữ root | Artifact lõi của repository-harness. |
| `TEST_MATRIX.md` | Kỳ vọng validation | Giữ root | Artifact lõi của repository-harness. |
| `HARNESS_BACKLOG.md` | Backlog cải thiện harness | Giữ root | Artifact lõi của repository-harness. |
| `SETUP.md` | Thiết lập agent/QMD/RTK | Giữ root | Tham chiếu setup xuyên suốt. |
| `QMD.md` | Thiết lập tìm kiếm local | Giữ root | Tham chiếu tooling agent xuyên suốt. |
| `REFERENCE.md` | Tài liệu tham chiếu ngoài | Giữ root | Bản đồ tham chiếu xuyên suốt. |
| `ORGANIZATION.md` | Quy tắc đặt tài liệu | Giữ root | Điều khiển audit này và các lần move docs sau. |
| `TERMINOLOGY.vi.md` | Thuật ngữ bản dịch tiếng Việt | Giữ root | Policy dịch thuật xuyên suốt. |
| `project-overview.md` | Hướng dẫn dự án | Giữ root | Bản đồ onboarding toàn repo. |
| `repo-map.md` | Hướng dẫn dự án | Giữ root | Bản đồ thư mục toàn repo. |
| `runtime-entry-points.md` | Hướng dẫn dự án | Giữ root | Bản đồ runtime toàn repo. |
| `development-workflow.md` | Hướng dẫn dự án | Giữ root | Bản đồ workflow toàn repo. |
| `plugin-catalog.md` | Hướng dẫn dự án | Giữ root | Inventory plugin toàn repo. |
| `plugin-architecture.md` | Kiến trúc dùng chung | Giữ root | Thiết kế plugin runtime dùng chung. |
| `plugin-architecture-wasm.md` | Kiến trúc dùng chung | Giữ root | Thiết kế WASM dashboard dùng chung. |
| `plugin-wasm.md` | Kiến trúc dùng chung | Giữ root | Lý do thiết kế WASM plugin loader. |
| `plugin-sui-wallet.md` | Kiến trúc dùng chung | Giữ root | Boundary plugin ví Sui dùng chung. |
| `plugin-ideas.md` | Backlog | Giữ root tạm thời | Backlog plugin đa domain; sau này có thể tách thành stories. |
| `wasm-native.md` | Kiến trúc dùng chung | Giữ root tạm thời | Pipeline WASM đa domain; có thể chuyển sang `docs/wasm/` nếu domain này lớn lên. |
| `deepbook-plugins.md` | Roadmap domain | Ứng viên: `docs/deepbook/plugins-roadmap.md` | Riêng DeepBook; tạm giữ root vì `INDEX.md` đang link như danh sách plugin cấp root. |

## Các Nhóm Nên Giữ Root

Các nhóm sau nên ở root:

- control plane của harness,
- bản đồ repo xuyên suốt,
- kiến trúc plugin/runtime dùng chung,
- setup tooling cho agent,
- policy dịch thuật.

## Ứng Viên Di Chuyển

Không di chuyển ngay các file này nếu chưa cập nhật wiki link và QMD:

| Ứng viên | Đích đề xuất | Follow-up bắt buộc |
| --- | --- | --- |
| `deepbook-plugins.md` | `docs/deepbook/plugins-roadmap.md` | Cập nhật `INDEX.md`, `INDEX.vi.md`, `deepbook/README.md`, QMD index. |
| `plugin-ideas.md` | `docs/stories/plugin-ideas.md` hoặc tách thành story packet | Quyết định đây là backlog hay roadmap sản phẩm. |
| `wasm-native.md` | `docs/wasm/native.md` | Tạo `docs/wasm/README.md` trước nếu có thêm tài liệu WASM. |

## Quyết Định

Giữ layout root hiện tại trong lúc này và làm rõ nó qua `ORGANIZATION.md`,
`README.md`, và `INDEX.md`. Chỉ di chuyển file khi một domain folder có thể sở
hữu file đó rõ ràng và việc cập nhật link đi kèm trong cùng thay đổi.
