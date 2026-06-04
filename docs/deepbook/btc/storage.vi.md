# Storage

Nguồn: `plugins/btc-chart/storage.ts`

## Key & Schema

`localStorage` key: **`btc-chart:config:v1`**.

`version` tồn tại để hỗ trợ migration trong tương lai. Nếu schema thay đổi, tăng
lên `v2` và trả về default config cho các file `v1` cũ.

## API

- `loadConfig()`: luôn trả về một config hợp lệ sau khi merge defaults.
- `saveConfig(cfg)`: ghi config với throttle 250ms để pan/zoom mượt.
- `flushConfig()`: flush write đang chờ ngay lập tức, thường dùng trong `beforeunload`.
- `exportConfig(cfg)`: tải config xuống dưới dạng JSON.
- `importConfigFromFile(file)`: đọc file JSON do người dùng tải lên, validate rồi merge defaults.
- `mergeConfig(p)`: helper để merge partial config vào defaults.

## Throttle Implementation

Throttle cần thiết vì `subscribeVisibleLogicalRangeChange` có thể bắn callback
mỗi frame khi người dùng pan/zoom. Không throttle sẽ dẫn tới quá nhiều lần
`JSON.stringify + setItem`, gây jank.

## Persist Ở Phía Plugin

Trong `BtcChartView`, một effect gom toàn bộ state liên quan rồi gọi
`saveConfig()`. Zoom được persist riêng từ
`subscribeVisibleLogicalRangeChange` để không mất dải nhìn thấy hiện tại.

Dùng `loadConfig()` trong bước lưu zoom giúp giữ nguyên các trường khác đã được
persist, tránh race với callback persist chính.

## Khôi Phục Khi Mount

Khi component mount:
- `loadConfig()` cung cấp interval, visibility flags, alerts, sound và notification state ban đầu.
- Zoom được khôi phục sau khi klines tải xong trong `useEffect` theo interval.

## JSON Import / Export

**Export**:
- stringify config
- tạo `Blob`
- tạo URL tạm
- click `<a download>`

**Import**:
- dùng `<label>` bọc input file ẩn
- parse file JSON
- merge defaults
- apply vào state
- restore zoom nếu có
- gọi `saveConfig(cfg)` ngay

Nếu parse lỗi, UI hiển thị toast đỏ qua `setImportErr`.

## Migration

Chiến lược hiện tại khá đơn giản: nếu gặp schema cũ hoặc version không khớp thì
reset về defaults. Nếu sau này cần giữ dữ liệu cũ qua migration, nên thay bằng
logic `case 1: …` để map field một cách tường minh.
