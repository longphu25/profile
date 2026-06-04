# Quy Ước Thuật Ngữ Tiếng Việt

Tài liệu này chốt các cách gọi nên ưu tiên trong các file `*.vi.md` để giữ văn
phong nhất quán trên toàn repo.

## Nguyên Tắc

- Dịch sang tiếng Việt với các khái niệm sản phẩm và thao tác phổ biến.
- Giữ nguyên tiếng Anh cho tên sản phẩm, tên protocol, tên type, tên hàm, tên
  file, component và thuật ngữ quá gắn với API.
- Với thuật ngữ có sắc thái vận hành đặc thù, ưu tiên dạng `Việt hóa + thuật
  ngữ gốc` ở lần nhắc đầu nếu cần làm rõ.

## Thuật Ngữ Ưu Tiên

| Nên dùng | Tránh dùng rải rác |
| --- | --- |
| `ví` | wallet |
| `giao dịch` | trade |
| `luận điểm giao dịch` | trade thesis |
| `kế hoạch giao dịch` | trade plan |
| `quy trình` | workflow |
| `quyết toán` | settlement |
| `nhận vị thế` hoặc `nhận tiền` theo ngữ cảnh | claim |
| `tình trạng oracle` | oracle health |
| `oracle cũ` | stale oracle / oracle stale |
| `bảng điều khiển` | dashboard |
| `trực tiếp` | live |
| `tuyến nạp vốn` | funding route |
| `bộ định tuyến nạp vốn` | funding router |
| `tài sản thế chấp` | collateral |
| `thanh lý` | liquidation |
| `cảnh báo cần ký ví` | wallet-required warning |
| `thành viên` | member khi dùng như danh từ chung |
| `người quan sát` | observer khi dùng như danh từ chung |

## Thuật Ngữ Giữ Nguyên

Các thuật ngữ sau được giữ nguyên tiếng Anh trong tài liệu tiếng Việt, trừ khi
ngữ cảnh yêu cầu giải thích thêm:

- `Predict Club`
- `DeepBook Predict`
- `PredictManager`
- `plugin`
- `keeper`
- `leader` khi dùng như tên vai trò sản phẩm
- `PTB`
- `Shadow DOM`
- `vault`
- `oracle`

## Ghi Chú Về Vai Trò

- Trong bảng vai trò hoặc nơi nói về actor của sản phẩm, có thể giữ `leader`,
  `member`, `keeper`, `observer` để khớp với tên vai trò trong UI hoặc logic.
- Trong câu văn thông thường, ưu tiên `thành viên`, `người dùng`, `người quan
  sát` thay cho việc lặp `member` hoặc `observer`.
