# Volume Profile

Nguồn: `plugins/btc-chart/volume-profile.ts`

## Khái Niệm

Volume Profile (TPO) chia khoảng giá `[minLow, maxHigh]` của candles thành N
bins rồi dồn volume vào bin chứa giá đóng cửa.

| Thuật ngữ | Định nghĩa |
|------|-----------|
| **POC** | Point of Control — bin có volume lớn nhất |
| **VAH/VAL** | Value Area High/Low — biên trên và dưới của vùng chứa 70% tổng volume quanh POC |
| **HVN** | High Volume Node — các bin ≥ 80% volume của POC |
| **LVN** | Low Volume Node — các bin có volume thấp |

## API

`drawVolumeProfile(...)` nhận canvas, main pane element, danh sách candles, cờ
`visible`, và bộ tùy chọn gồm số bins, width, heatmap, hvnRatio.

`VPInfo` trả về:
- `poc`
- `vah`
- `val`
- `pos`
- `hvnCount`

## Cách Dựng Profile

- Tìm `minP` và `maxP`
- Chia thành `bins`
- Dồn volume của từng candle vào bin tương ứng với giá đóng cửa
- Chọn POC bằng `argmax(total)`
- Mở rộng Value Area từ POC lên/xuống cho tới khi đạt 70% tổng volume

## Các Lớp Render

Thứ tự render:
1. Heatmap strip
2. Value Area band
3. Buy/Sell bars
4. HVN dots
5. POC dashed line
6. POC label pill
7. VAH / VAL labels

## Tuning Parameters

| Param | Default | Tác động |
|-------|--------|-------|
| `bins` | 64 | Độ phân giải dọc |
| `width` | 220 | Chiều rộng canvas |
| `heatmap` | `true` | Bật/tắt heatmap |
| `hvnRatio` | 0.8 | Mức nhận diện HVN |

## Vị Trí Trên Main Pane

Canvas VP được đặt `position: absolute` tại `top: 0; right: 64px`, rộng 220px
và cao bằng `mainEl.clientHeight`. `pointer-events: none` để không chặn crosshair.

## Edge Cases

- `candles.length < 10` → bỏ qua render
- `visible: false` → clear canvas
- `maxVol === 0` → dùng 1 để tránh chia cho 0
- Lần load đầu có thể có `clientHeight = 0`; `ResizeObserver` sẽ chạy lại

## Mở Rộng Đề Xuất

- LVN markers
- Naked POC
- Composite profile
- VPVR theo visible range thay vì chỉ dùng số candle cuối cùng
