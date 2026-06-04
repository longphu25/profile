# Alerts

Nguồn: `plugins/btc-chart/alerts.ts`

## Schema

```ts
type AlertKind =
  | 'price-cross-up'
  | 'price-cross-down'
  | 'nwe-upper'
  | 'nwe-lower'
  | 'rsi-overbought'
  | 'rsi-oversold'

interface AlertRule {
  id: string
  kind: AlertKind
  value: number
  label?: string
  enabled: boolean
  repeat: boolean
  triggeredAt: number
}
```

## Đánh Giá

`evaluateAlerts(rules, ctx)` chạy trên mọi tick từ WS handler:

```ts
const ctx = {
  price: candle.close,
  prevPrice: lastPriceRef.current,
  nweUpper: sidebarRef.current.nweUp,
  nweLower: sidebarRef.current.nweLo,
  rsi: sidebarRef.current.rsiNow,
}
```

Mỗi rule kiểm tra:

| Kind | Điều kiện |
|------|--------------|
| `price-cross-up` | `prevPrice != null && prevPrice < value && price >= value` |
| `price-cross-down` | `prevPrice != null && prevPrice > value && price <= value` |
| `nwe-upper` | `nweUpper != null && price >= nweUpper` |
| `nwe-lower` | `nweLower != null && price <= nweLower` |
| `rsi-overbought` | `rsi != null && rsi >= value` |
| `rsi-oversold` | `rsi != null && rsi <= value` |

Khi một rule trúng:
1. Set `triggeredAt = Date.now()`.
2. Đẩy vào mảng `FiredAlert[]` trả về.
3. Caller (`plugin.tsx`) xử lý:
   - Phát sound nếu được bật.
   - Tạo browser notification.
   - Hiện in-app toast trong 5 giây.
   - Gọi `setAlerts([...])` để persist trigger state.

Cooldown 60 giây áp dụng khi `repeat: true`. Mặc định `repeat: false`, nên một
rule chỉ fire đúng một lần cho tới khi người dùng reset.

## Âm Thanh

`AlertSound` class dùng Web Audio API.

Hai oscillator được chồng lên nhau:
- A5 (880Hz) ở thời điểm t+0, thời lượng 120ms.
- E6 (1318.5Hz) ở thời điểm t+130ms, thời lượng 180ms.

Do chính sách autoplay của trình duyệt, `AudioContext` khởi đầu ở trạng thái
`suspended`. Khi người dùng bấm "Sound on" lần đầu, plugin gọi `ctx.resume()`
và phát beep xác nhận ngay lập tức.

## Browser Notification

`tag: 'btc-chart-alert'` đảm bảo notification mới ghi đè notification cũ thay vì
xếp chồng. `silent: true` tắt âm báo mặc định của hệ điều hành để tránh trùng
với Web Audio của plugin.

## UI

Form thêm rule nằm trong panel Alerts ở sidebar.

Giá trị tự gợi ý khi người dùng đổi `kind`:
- RSI overbought → `70`
- RSI oversold → `30`
- NWE upper/lower → bỏ qua vì không cần giá trị
- Price cross → `Math.round(currentPrice)`

Hành vi của danh sách:
- ● = enabled, ○ = disabled.
- Link "reset" hiện ra sau khi rule đã fire.
- × xóa rule.
- Background `is-fired` dùng mint highlight khi đang ở trạng thái triggered.

## Giới Hạn

- Trigger evaluation chạy trên từng WS tick (~100-500ms tùy interval).
- Cooldown 60 giây hiện được hard-code, chưa có UI riêng.
- Nếu mất mạng, alert cũng dừng theo. Dữ liệu mock fallback không kích hoạt alert.
- iOS Safari < 16.4 không có Notification API trên web, nên plugin chỉ còn sound + toast.
