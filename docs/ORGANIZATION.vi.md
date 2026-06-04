# Tổ Chức Tài Liệu

Repo này dùng `docs/` vừa như harness dự án, vừa như knowledge vault kiểu
Obsidian. Ưu tiên làm rõ vai trò thư mục thay vì di chuyển tài liệu legacy mà
chưa cập nhật toàn bộ wiki link.

## Vai Trò Thư Mục

| Khu vực | Dùng cho | Ví dụ |
| --- | --- | --- |
| Harness root | Cách làm việc trong repo | `README.md`, `HARNESS.md`, `FEATURE_INTAKE.md`, `ARCHITECTURE.md`, `TEST_MATRIX.md`, `QMD.md` |
| Hướng dẫn dự án root | Bản đồ repo xuyên suốt | `project-overview.md`, `repo-map.md`, `runtime-entry-points.md`, `development-workflow.md` |
| Kiến trúc plugin root | Thiết kế runtime/plugin dùng chung | `plugin-architecture.md`, `plugin-wasm.md`, `plugin-sui-wallet.md`, `wasm-native.md` |
| `product/` | Sự thật sản phẩm ổn định | Product contract, funding, architecture của Predict Club |
| `stories/` | Kế hoạch theo phạm vi và gói công việc | Story plans, roadmap slice, implementation packet |
| `decisions/` | Quyết định và tradeoff bền vững | Quyết định kiến trúc, funding/escrow |
| `demo/` | Ví dụ tối thiểu về flow harness | Request tới intake, product, story, decision, validation |
| `templates/` | Mẫu viết lại được | Story, decision, validation template |
| Thư mục domain | Chiều sâu kỹ thuật theo domain | `deepbook/`, `defi/navi/`, `seal/`, `walrus/`, `zklogin/`, `contracts/` |
| Artifact thiết kế | Tham chiếu UI sinh ra và preview tĩnh | `stitch_predict_club_trading_terminal/` |

## Chính Sách Ngôn Ngữ

- Tài liệu nguồn tiếng Anh dùng `*.md`.
- Bản dịch tiếng Việt dùng `*.vi.md` đặt cạnh tài liệu nguồn.
- Nếu tài liệu nguồn pha tiếng Anh/Việt, chuẩn hóa file `.md` về tiếng Anh
  trước, rồi tạo hoặc cập nhật bản dịch `.vi.md`.
- Khi sửa tài liệu tiếng Việt, dùng `TERMINOLOGY.vi.md` để giữ thuật ngữ thống
  nhất.

## Chính Sách Index

QMD nên index toàn bộ cây `docs/` với:

```text
Collection: profile-docs
Path: docs/
Pattern: **/*.md
```

Index cố ý bao gồm cả Markdown tiếng Anh và tiếng Việt. Nhờ vậy agent có thể
tìm bằng cả hai ngôn ngữ và vẫn thấy được cặp source/translation.

## Khi Thêm Tài Liệu Mới

1. Đưa sự thật sản phẩm ổn định vào `product/`.
2. Đưa kế hoạch triển khai theo phạm vi vào `stories/`.
3. Đưa tradeoff bền vững vào `decisions/`.
4. Đưa ghi chú kỹ thuật sâu vào đúng thư mục domain.
5. Thêm bản dịch `*.vi.md` khi tài liệu hữu ích cho người đọc tiếng Việt.
6. Cập nhật `README.md`, `INDEX.md`, hoặc README của thư mục nếu tài liệu mới
   là điểm điều hướng chính.
7. Chạy `qmd update` sau khi thêm hoặc di chuyển tài liệu.

## Chính Sách Demo

`demo/` không phải product truth. Nó là ví dụ đọc nhỏ cho agent học flow
harness. Công việc triển khai thật vẫn nên dùng `product/`, `stories/`,
`decisions/` và validation records.

## Chính Sách Di Chuyển

Không di chuyển tài liệu legacy ở root chỉ để cây thư mục trông gọn hơn. Chỉ
di chuyển tài liệu khi:

- thư mục đích rõ ràng chính xác hơn,
- toàn bộ wiki link và relative link được cập nhật,
- QMD được refresh sau khi di chuyển,
- và tài liệu không bị mất khỏi điểm điều hướng quan trọng trong `INDEX.md`.

Trước khi di chuyển Markdown root-level, cập nhật `ROOT_DOC_AUDIT.md`.
