# Kiến Trúc

File này là lớp điều hướng cho công việc kiến trúc. Giữ các ghi chú kỹ thuật
chi tiết trong những file domain hiện có và dùng trang này để chọn tài liệu cần
đọc.

## Các Boundary Cốt Lõi

| Boundary | Tài liệu nguồn | Vùng code |
| --- | --- | --- |
| Portfolio shell | `project-overview.md`, `runtime-entry-points.md` | `src/main.tsx`, `src/Portfolio.tsx` |
| Generic plugin runtime | `plugin-architecture.md` | `src/plugins/`, `src/plugin-demo/` |
| Sui dashboard runtime | `plugin-architecture-wasm.md`, `plugin-sui-wallet.md` | `src/sui-dashboard/`, `src/sui-wasm/` |
| Plugin business logic | `plugin-catalog.md`, tài liệu domain | `plugins/` |
| WASM plugins | `wasm-native.md`, `plugin-wasm.md` | `plugins/*/pkg`, `public/wasm/` |
| Move contracts | `contracts/SEAL-POLICY.md` | `contracts/` |

## Quy Tắc Boundary

- `src/plugins/` là code runtime/kernel, không phải code tính năng nghiệp vụ.
- `plugins/<name>/` sở hữu UI, state và logic tích hợp riêng của plugin đó.
- Các plugin Sui chạy trong dashboard dùng chung nên sử dụng host wallet
  context thay vì tạo wallet provider riêng.
- Việc nạp plugin trong production phụ thuộc vào `vite.config.ts` và CSS plugin
  đã được sao chép.
- Cần kiểm tra đường dẫn WASM package ở cả chế độ dev và production.

## Chính Sách Thay Đổi Kiến Trúc

Ghi lại một decision trong `decisions/` khi thay đổi làm đổi khác:

- quy tắc nạp hoặc đăng ký plugin
- `HostAPI` hoặc contract ví Sui dùng chung
- boundary của signing hoặc transaction execution
- đường dẫn đầu ra của production build
- giả định về quyền sở hữu object Move hoặc authorization
- yêu cầu validation cho một domain
