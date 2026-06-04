# Ma Trận Kiểm Thử

Hãy dùng ma trận này để chọn bước xác minh cho một thay đổi. Cập nhật nó khi
repo có thêm các kiểm tra đáng tin cậy mới.

| Loại công việc | Bằng chứng tối thiểu |
| --- | --- |
| Chỉ tài liệu | Kiểm tra các liên kết đã đổi và chạy kiểm tra đường dẫn docs nếu có di chuyển đường dẫn. |
| Package/config | `bun run build` khi dependency sẵn có. |
| React UI | `bun run build`; thêm browser smoke check cho các trang nhìn thấy bởi người dùng. |
| Plugin runtime | `bun run build`; smoke load entry dashboard bị ảnh hưởng. |
| Sui wallet/signing | Build cộng với rà soát luồng ví thủ công hoặc bằng script; không tuyên bố thành công trên network nếu chưa chạy thật. |
| Predict Club | `bun run build`; smoke load `predict-club.html`; xác minh nạp plugin trong Shadow DOM, layout responsive, chặn oracle cũ và rà soát luồng ví khi member tự ký. |
| WASM | Build cộng với xác minh `.wasm` được sinh/sao chép và các đường dẫn loader. |
| Move contracts | `sui move build` trong package bị ảnh hưởng. |

## Các Lệnh Đã Biết

```bash
bun run build
bun run lint
bun run format:check
```

Mặc định dùng Bun vì repo có `bun.lock`.

## Các Khoảng Trống Hiện Tại

- Chưa có docs link checker chuyên dụng.
- Chưa có bộ E2E smoke suite ổn định được ghi lại.
- Các luồng wallet và provider vẫn cần bằng chứng thủ công trừ khi một tác vụ
  bổ sung scripted coverage.
