# PNG Snapshot

Nguồn: `plugins/btc-chart/snapshot.ts`

## API

Hàm `downloadChartSnapshot(...)` nhận:
- main pane
- RSI pane nếu đang bật
- Volume pane nếu đang bật
- VP overlay canvas
- OF overlay canvas
- tên file đầu ra
- màu nền

## Cách Hoạt Động

`lightweight-charts` cung cấp `chart.takeScreenshot()` để lấy ra một
`HTMLCanvasElement` cho từng pane. Plugin ghép ba pane này vào một canvas chung:

1. Vẽ nền.
2. Vẽ main pane.
3. Vẽ OF overlay nếu có.
4. Vẽ VP overlay vào đúng vị trí trên main pane.
5. Vẽ RSI pane nếu bật.
6. Vẽ Volume pane nếu bật.
7. Chuyển thành PNG rồi tải xuống.

## Nối Vào Plugin

Toolbar button "PNG" gọi callback tạo snapshot. Callback lấy `chartRefs`,
`mainElRef`, `rsiElRef`, `volElRef`, cùng `vpCanvasRef` và `ofCanvasRef`, rồi
chuyển chúng vào `downloadChartSnapshot(...)`.

## Đầu Ra

- Định dạng: PNG
- Nền luôn được fill
- Tên file mặc định: `btc-chart-{timestamp}.png`

## Giới Hạn

- Legend HTML overlay không có trong screenshot.
- Sidebar không có trong screenshot.
- Crosshair không bị capture.
- Các overlay là HTML riêng phải tự vẽ thêm nếu muốn xuất hiện.

## Mở Rộng Đề Xuất

- watermark
- legend text vẽ trực tiếp vào ảnh
- export JPEG/WebP
- downscale về kích thước chuẩn cho social

## Ghi Chú Về DPR

Nếu màn hình là retina, `chart.takeScreenshot()` đã trả về canvas theo DPR phù hợp.
Không cần tự nhân DPR bằng tay. Nếu cần file 1920×1080 cố định, có thể downscale
sau bằng `ctx.drawImage(...)`.
