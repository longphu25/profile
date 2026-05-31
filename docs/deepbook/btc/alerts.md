# Alerts

Source: `plugins/btc-chart/alerts.ts`

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
  id: string           // crypto.randomUUID
  kind: AlertKind
  value: number        // target price | RSI threshold (NWE alerts ignore)
  label?: string
  enabled: boolean
  repeat: boolean      // false = fire once, true = re-arm sau 60s
  triggeredAt: number  // 0 = chưa fire
}
```

## Evaluation

`evaluateAlerts(rules, ctx)` chạy mỗi tick từ WS handler:

```ts
const ctx = {
  price: candle.close,
  prevPrice: lastPriceRef.current,        // previous tick close
  nweUpper: sidebarRef.current.nweUp,     // latest NWE upper
  nweLower: sidebarRef.current.nweLo,     // latest NWE lower
  rsi: sidebarRef.current.rsiNow,         // latest RSI(14)
}
```

Mỗi rule check:

| Kind | Hit condition |
|------|--------------|
| `price-cross-up` | `prevPrice != null && prevPrice < value && price >= value` |
| `price-cross-down` | `prevPrice != null && prevPrice > value && price <= value` |
| `nwe-upper` | `nweUpper != null && price >= nweUpper` |
| `nwe-lower` | `nweLower != null && price <= nweLower` |
| `rsi-overbought` | `rsi != null && rsi >= value` |
| `rsi-oversold` | `rsi != null && rsi <= value` |

Khi hit:
1. Set `triggeredAt = Date.now()`.
2. Push vào `FiredAlert[]` trả về.
3. Caller (plugin.tsx) xử lý:
   - Phát sound (nếu enabled).
   - Browser notification.
   - In-app toast 5s.
   - `setAlerts([...])` để persist trigger state.

Cooldown 60s áp dụng khi `repeat: true`. Mặc định `repeat: false` → một rule chỉ fire đúng một lần đến khi user reset (nút "reset" trong list).

## Sound

`AlertSound` class — Web Audio API:

```ts
const ctx = new AudioContext()
const osc = ctx.createOscillator()
const gain = ctx.createGain()

osc.type = 'sine'
osc.frequency.value = 880   // A5
gain.gain.linearRampToValueAtTime(0.4, t + 0.01)   // attack
gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)  // decay
osc.connect(gain).connect(ctx.destination)
osc.start(t)
osc.stop(t + 0.14)
```

Hai oscillator chồng lên nhau:
- A5 (880Hz) tại t+0, duration 120ms.
- E6 (1318.5Hz) tại t+130ms, duration 180ms.

Lưu ý browser autoplay policy: AudioContext bắt đầu ở state `suspended`. Lần đầu user click "Sound on", plugin gọi `ctx.resume()` rồi phát beep ngay để xác nhận.

## Browser Notification

```ts
async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'  // iOS Safari < 16.4
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

function pushNotification(title: string, body: string) {
  new Notification(title, {
    body,
    tag: 'btc-chart-alert',  // chồng notif cùng tag, không spam
    silent: true,            // plugin tự phát beep
  })
}
```

`tag: 'btc-chart-alert'` đảm bảo notif mới ghi đè notif cũ thay vì đẩy stack. `silent: true` tắt beep mặc định của OS để không trùng với Web Audio.

## UI

Form thêm rule (trong Alerts panel sidebar):

```tsx
<select value={kind} onChange={...}>
  <option value="price-cross-up">Price ↑ crosses</option>
  ...
</select>
<input type="number" value={val} ... />  // ẩn khi kind là nwe-upper/nwe-lower
<button type="submit">Add</button>
```

Auto-suggest value khi user đổi kind:
- RSI overbought → `70`
- RSI oversold → `30`
- NWE upper/lower → ignore (alert không cần value)
- Price cross → `Math.round(currentPrice)`

List hiển thị:
- ● = enabled, ○ = disabled (click toggle).
- "reset" link xuất hiện sau khi rule fired (đưa `triggeredAt` về 0).
- × xoá rule.
- Background `is-fired` (mint highlight) khi đang trigger state.

## Limitations

- Trigger evaluation chạy mỗi WS tick (~100-500ms tuỳ interval). Không nhanh hơn được.
- Cooldown 60s là cố định trong code — chưa expose UI.
- Nếu network mất, alert dừng theo. Mock data fallback không trigger alert (có thể mở rộng nếu cần testing).
- iOS Safari < 16.4 không có Notification API trên web → graceful degrade (chỉ sound + toast).
