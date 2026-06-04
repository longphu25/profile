# Order Flow Overlay

Nguồn: `plugins/btc-chart/order-flow-overlay.ts`

## Vì Sao Tự Render

`lightweight-charts` có `series.setMarkers()`, nhưng khi nhiều marker đứng sát
nhau, nhất là lúc zoom out, chúng đè lên wick và khó đọc. Gutter-band overlay
giải quyết việc đó:

- SELL pills nằm ở dải trên cùng của main pane.
- BUY pills nằm ở dải dưới cùng của main pane.
- Mỗi pill có leader line chấm nối ngược về wick.
- Khi pill va chạm theo phương ngang, chúng stack sang hàng kế tiếp.

## API

`drawOrderFlow(...)` nhận canvas, phần tử main pane, chart/series bridge,
danh sách `OFOverlaySignal[]`, cờ `visible`, và `rightOffset` mặc định 64 để chừa
price ladder.

## Các Bước Render

1. **Measure + place**: đổi `time` sang toạ độ x, đổi `high/low` sang toạ độ y.
2. **Anti-collision**: kiểm tra va chạm ngang và stack lên/xuống theo loại tín hiệu.
3. **Leader lines**: vẽ trước bằng nét chấm, alpha thấp.
4. **Pills + arrows**: vẽ sau cùng với ratio text.

## Gutter Positioning

- SELL dùng top band.
- BUY dùng bottom band.
- Tối đa 5 stack rows trước khi chấp nhận overlap.

## Cách Nối Trong Plugin

- `renderData()` chỉ cập nhật `ofOverlayRef.current`, không còn gọi `setMarkers`.
- `drawOrderFlow(...)` được gọi lại khi:
  - dữ liệu đổi
  - `ResizeObserver` sync kích thước
  - người dùng pan/zoom

Canvas OF dùng `pointer-events: none` và nằm trên VP overlay nhưng không chặn crosshair.

## Edge Cases

- `visible: false` → clear canvas và return.
- Không có signal → clear canvas.
- Signal ngoài viewport → bỏ qua.
- Signal quá gần price ladder → bỏ qua.
- Cụm tín hiệu quá dày → sau 5 hàng thì chấp nhận overlap.

## Tuning

Có thể tinh chỉnh:
- kích thước pill
- khoảng cách band khỏi candle
- độ đậm của leader line

## Mở Rộng Đề Xuất

- Hover popup chi tiết
- Gộp cluster theo thời gian
- Slider threshold cho ratio
- Persist OF threshold vào `ChartConfig`
- Tăng/giảm cường độ màu theo ratio

## Trade-off So Với `setMarkers`

Ưu điểm của canvas overlay:
- tách marker khỏi candle
- chống va chạm tốt hơn
- có leader line

Nhược điểm:
- phải tự làm hover state
- không tự có trong screenshot
- code phức tạp hơn rõ rệt

Lưu ý: OF overlay là canvas riêng nên `chart.takeScreenshot()` không capture
nó. Nếu muốn nó xuất hiện trong PNG, phải composite vào snapshot giống cách làm
với VP overlay.
