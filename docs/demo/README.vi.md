# Demo Harness

Demo này minh họa cách một yêu cầu nhỏ trở thành các artifact harness trước khi
đổi code. Nó cố ý nhỏ và không mô tả một commit triển khai thật.

## Yêu Cầu Ví Dụ

> Thêm checklist giao dịch có hướng dẫn cho Predict Club để thành viên hiểu một
> round có an toàn để tham gia hay không.

## Luồng

```text
yêu cầu
  -> feature intake
  -> cập nhật product contract
  -> story packet
  -> decision record khi tradeoff bền vững
  -> validation note sau khi có proof
```

## Artifact Demo

| Artifact | Mục đích |
| --- | --- |
| `feature-intake.md` | Phân loại rủi ro trước khi bắt đầu |
| `product-contract.md` | Ghi hành vi sản phẩm ổn định |
| `story.md` | Định nghĩa gói triển khai có phạm vi |
| `decision.md` | Ghi lại tradeoff bền vững |
| `validation.md` | Ghi proof và rủi ro còn lại |

## Điều Demo Này Minh Họa

- Product truth thuộc `docs/product/` hoặc nguồn tương đương.
- Công việc theo story thuộc `docs/stories/`.
- Tradeoff bền vững thuộc `docs/decisions/`.
- Validation được lên kế hoạch trước khi triển khai và ghi lại sau khi kiểm tra.
- Công việc Sui wallet/signing rủi ro cao cần proof mạnh hơn thay đổi docs-only.
