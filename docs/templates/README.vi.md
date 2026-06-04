# Mẫu Tài Liệu

Dùng các template này để giữ artifact harness nhất quán.

| Template | Dùng khi |
| --- | --- |
| `feature-intake.md` | Phân loại yêu cầu trước khi quyết định patch trực tiếp hay tạo story |
| `spec.md` | Biến một vùng sản phẩm mới hoặc yêu cầu lớn thành tri thức trong repo |
| `story.md` | Lập kế hoạch một gói công việc có phạm vi rõ, acceptance criteria và validation |
| `decision.md` | Ghi lại tradeoff bền vững mà agent sau cần kế thừa |
| `validation.md` | Ghi proof, rủi ro còn lại và follow-up sau triển khai |

## Luồng

```text
yêu cầu của người dùng
  -> feature intake
  -> product/spec docs khi product truth đổi
  -> story packet cho phần triển khai có giới hạn
  -> decision record khi tradeoff cần được lưu lại
  -> validation note khi proof quan trọng
```

Các sửa typo nhỏ và chỉnh docs hẹp có thể không cần artifact mới, nhưng nên cập
nhật harness khi thiếu ngữ cảnh làm công việc bị mơ hồ.
