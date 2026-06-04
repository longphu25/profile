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
  repeat: boolean      // false = fire once, true = re-arm after 60s
  triggeredAt: number  // 0 = has not fired yet
}
```

## Evaluation

`evaluateAlerts(rules, ctx)` runs on every tick from the WS handler:

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

When a rule hits:
1. Set `triggeredAt = Date.now()`.
2. Push vào `FiredAlert[]` trả về.
3. The caller (`plugin.tsx`) handles:
   - Play sound (if enabled).
   - Browser notification.
   - 5s in-app toast.
   - `setAlerts([...])` to persist trigger state.

The 60s cooldown applies when `repeat: true`. By default, `repeat: false`, so
a rule fires only once until the user resets it (the "reset" button in the
list).

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

Two oscillators are layered:
- A5 (880Hz) tại t+0, duration 120ms.
- E6 (1318.5Hz) tại t+130ms, duration 180ms.

Browser autoplay policy matters here: `AudioContext` starts in the `suspended`
state. The first time the user clicks "Sound on", the plugin calls
`ctx.resume()` and plays a confirmation beep immediately.

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

`tag: 'btc-chart-alert'` ensures the newest notification replaces the previous
one instead of stacking. `silent: true` disables the OS default sound so it
does not overlap with Web Audio.

## UI

Add-rule form (inside the Alerts sidebar panel):

```tsx
<select value={kind} onChange={...}>
  <option value="price-cross-up">Price ↑ crosses</option>
  ...
</select>
<input type="number" value={val} ... />  // ẩn khi kind là nwe-upper/nwe-lower
<button type="submit">Add</button>
```

Auto-suggested values when the user changes `kind`:
- RSI overbought → `70`
- RSI oversold → `30`
- NWE upper/lower → ignore (the alert does not need a value)
- Price cross → `Math.round(currentPrice)`

List behavior:
- ● = enabled, ○ = disabled (click to toggle).
- "reset" link appears after the rule fires (sets `triggeredAt` back to 0).
- × deletes the rule.
- `is-fired` background (mint highlight) while in triggered state.

## Limitations

- Trigger evaluation runs on each WS tick (~100-500ms depending on interval). It
  cannot be faster than the feed.
- The 60s cooldown is hard-coded and not yet exposed in the UI.
- If the network drops, alerts stop with it. Mock fallback data does not
  trigger alerts (this could be extended for testing if needed).
- iOS Safari < 16.4 does not expose Notification API on the web, so the plugin
  degrades gracefully to sound + toast only.
