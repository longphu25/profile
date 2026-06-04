# Project Harness

Ứng dụng là phần người dùng chạm vào. Harness là phần agent chạm vào trước khi
thay đổi ứng dụng.

Repo này đã có nhiều ghi chú kỹ thuật. Lớp harness giúp chúng dễ dùng hơn bằng
cách trả lời bốn câu hỏi trước khi bắt đầu công việc:

1. Product contract nào bị tác động?
2. Thay đổi này thuộc story hoặc plan nào?
3. Boundary kiến trúc nào có thể bị chạm tới?
4. Cần bằng chứng gì để xem công việc đã hoàn tất?

## Thứ Bậc Nguồn

```text
Yêu cầu người dùng hoặc đặc tả được cung cấp
  -> docs/FEATURE_INTAKE.md
  -> docs/product/*
  -> docs/stories/*
  -> docs/ARCHITECTURE.md và tài liệu domain
  -> docs/TEST_MATRIX.md
  -> docs/decisions/*
```

Trước khi triển khai, tài liệu sản phẩm mô tả ý định. Sau khi triển khai, tài
liệu sản phẩm cùng với test và các bước kiểm tra có thể chạy được sẽ trở thành
living contract.

## Vòng Lặp Công Việc

1. Phân loại yêu cầu bằng `FEATURE_INTAKE.md`.
2. Xác định tài liệu sản phẩm và file story bị ảnh hưởng.
3. Đọc tài liệu kiến trúc/domain liên quan.
4. Triển khai thay đổi nhỏ nhất nhưng có boundary rõ ràng.
5. Chạy bằng chứng được liệt kê trong `TEST_MATRIX.md`.
6. Cập nhật tài liệu, trạng thái story hoặc decision nếu contract thay đổi.

## Quy Tắc Mở Rộng

Khi agent bị mắc kẹt vì thiếu ngữ cảnh dự án, hãy cải thiện harness trực tiếp
hoặc ghi lại phần ngữ cảnh còn thiếu vào `HARNESS_BACKLOG.md`.

Một thay đổi harness tốt là thay đổi nhỏ, bền vững và hữu ích cho agent tiếp
theo.
