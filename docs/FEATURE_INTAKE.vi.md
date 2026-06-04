# Tiếp Nhận Tính Năng

Mọi yêu cầu triển khai đều đi qua cổng này trước khi thay đổi code.

## Loại Đầu Vào

| Loại | Dùng khi | Artifact điển hình |
| --- | --- | --- |
| New spec | Một vùng sản phẩm mới cần trở thành tri thức của repo | `product/`, `stories/`, `decisions/` |
| Spec slice | Một hành vi đã chọn từ plan được chấp nhận đang được xây dựng | Story packet |
| Change request | Hành vi hiện có đang được sửa hoặc tinh chỉnh | Story packet hoặc patch trực tiếp |
| Maintenance | Dependency, docs, build, lint hoặc vệ sinh runtime | Ghi chú validation hoặc patch trực tiếp |
| Harness improvement | Tài liệu/quy trình cho agent cần được cải thiện | Cập nhật harness docs |

## Các Làn

### Tiny

Dùng cho sửa typo, cập nhật docs hẹp, thay đổi copy nhỏ và maintenance cục bộ.
Patch trực tiếp, chạy các kiểm tra nhanh nếu có, và cập nhật index nếu đường
dẫn thay đổi.

### Normal

Dùng cho hành vi cỡ story với blast radius có giới hạn. Tạo hoặc cập nhật một
file trong `stories/`, liên kết tài liệu product và architecture liên quan, rồi
cập nhật kỳ vọng validation.

### High-Risk

Dùng khi công việc chạm tới security, wallet signing, authorization, ownership
dữ liệu, external provider, public contract hoặc nhiều domain cùng lúc. Tạo
story folder, ghi lại các quyết định còn mở và yêu cầu validation mạnh hơn
trước khi tuyên bố hoàn tất.

## Checklist Rủi Ro

| Cờ rủi ro | Áp dụng khi công việc chạm tới |
| --- | --- |
| Wallet/signing | connect, disconnect, signing, transaction execution |
| Authorization | permissions, policy contracts, gated decryption |
| Data model | persisted objects, schema, object ownership, migration |
| External systems | Sui, DeepBook, NAVI, Walrus, Seal, Polymarket |
| Public contract | API shape, plugin contract, host API, visible workflow |
| Existing behavior | user flow đã được triển khai |
| Weak proof | test không rõ ràng hoặc không có validation chạy được |
| Multi-domain | thay đổi chạm tới hơn một domain sản phẩm |

0-1 cờ thường là tiny hoặc normal. 2-3 cờ là normal nhưng cần bằng chứng mạnh
hơn. 4+ cờ, hoặc các trường hợp wallet/signing, authorization, mất dữ liệu, hay
nhạy cảm về bảo mật thì là high-risk trừ khi con người đã thu hẹp phạm vi một
cách rõ ràng.
