# Storage

Source: `plugins/btc-chart/storage.ts`

## Key & schema

`localStorage` key: **`btc-chart:config:v1`**.

```ts
interface ChartConfig {
  version: 1
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
  vis: {
    nwe: boolean
    ma50: boolean
    ma200: boolean
    of: boolean
    vp: boolean
    rsi: boolean
    vol: boolean
  }
  zoom: { from: number; to: number } | null   // logical range từ lightweight-charts
  alerts: AlertRule[]
  sound: { enabled: boolean; volume: number /* 0..1 */ }
  notifications: boolean
}
```

`version` để dự phòng migration sau này. Nếu schema thay đổi, đổi thành `v2`, default config sẽ được trả về cho file `v1` cũ.

## API

```ts
// Đọc config — luôn trả về một config hợp lệ (merge defaults).
loadConfig(): ChartConfig

// Ghi config — throttled 250ms để pan/zoom mượt.
saveConfig(cfg: ChartConfig): void

// Flush ghi pending ngay lập tức (gọi trong beforeunload).
flushConfig(): void

// Tải config về dưới dạng JSON file.
exportConfig(cfg: ChartConfig, filename?: string): void

// Đọc file JSON do user upload, validate, merge defaults.
importConfigFromFile(file: File): Promise<ChartConfig>

// Helper merge một partial vào defaults — dùng cả lúc load và import.
mergeConfig(p: Partial<ChartConfig>): ChartConfig
```

## Throttle implementation

```ts
let writeTimer: ReturnType<typeof setTimeout> | null = null
let pending: ChartConfig | null = null

export function saveConfig(cfg: ChartConfig): void {
  pending = cfg
  if (writeTimer) return            // đã có timer chờ
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (!pending) return
    try {
      localStorage.setItem(KEY, JSON.stringify(pending))
    } catch {
      // quota exceeded / private mode → silent
    }
    pending = null
  }, 250)
}
```

Tại sao throttle:
- `subscribeVisibleLogicalRangeChange` fire mỗi frame khi user pan/zoom (60fps).
- Không throttle → 60 lần `JSON.stringify + setItem` mỗi giây, gây jank.

`flushConfig()` gọi trong `beforeunload`:
```ts
useEffect(() => {
  const onBeforeUnload = () => flushConfig()
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => window.removeEventListener('beforeunload', onBeforeUnload)
}, [])
```

## Plugin-side persist

Trong `BtcChartView`, một effect duy nhất gom toàn bộ state liên quan và gọi `saveConfig()`:

```ts
const persist = useCallback((zoom: ChartConfig['zoom'] | undefined) => {
  saveConfig({
    version: 1,
    interval, vis, alerts, sound,
    notifications: notifAllowed,
    zoom: zoom === undefined ? loadConfig().zoom : zoom,
  })
}, [interval, vis, alerts, sound, notifAllowed])

useEffect(() => { persist(undefined) }, [persist])
```

Khi `interval/vis/alerts/sound/notifAllowed` thay đổi, persist auto-fire. Zoom được persist riêng từ `subscribeVisibleLogicalRangeChange`:

```ts
mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
  if (!r) return
  saveConfig({ ...loadConfig(), zoom: { from: r.from, to: r.to } })
})
```

Việc dùng `loadConfig()` ở đây để giữ các trường khác đã persist (tránh race với `persist` callback).

## Restore khi mount

```ts
const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

const visRef = useRef<VisFlags>({ ...cfgInit.vis })
const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
const [vis, setVis] = useState<VisFlags>(visRef.current)
const [alerts, setAlerts] = useState<AlertRule[]>([...cfgInit.alerts])
const [sound, setSound] = useState(cfgInit.sound)
const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
```

Zoom restore sau khi klines đã load (interval-based useEffect):

```ts
candlesRef.current = cands
renderData(cands)
const savedZoom = loadConfig().zoom
if (savedZoom && chartRefs.current?.mainChart) {
  chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(savedZoom)
}
connectWs()
```

## Import / Export JSON

**Export** = stringify config + Blob + `<a download>` click:

```ts
const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url; a.download = filename; a.click()
URL.revokeObjectURL(url)
```

**Import** dùng `<label>` bao input file ẩn (tránh dùng programmatic dialog):

```tsx
<label className="btc-chart__ind-btn btc-chart__file">
  Import
  <input type="file" accept="application/json,.json"
    onChange={(e) => {
      const f = e.target.files?.[0]
      if (f) importNow(f)
      e.target.value = ''           // reset để chọn lại cùng file
    }}
  />
</label>
```

Trên `importNow(file)`:
1. `importConfigFromFile(file)` → parse + merge defaults.
2. Apply vào tất cả state: `setVis`, `setAlerts`, `setSound`, `setNotifAllowed`, `setInterval_`.
3. Restore zoom nếu có (gọi `setVisibleLogicalRange`).
4. `saveConfig(cfg)` để ghi luôn (không cần đợi throttle effect).
5. Lỗi parse → `setImportErr` → toast đỏ.

## Migration

Khi đổi schema:

```ts
export function loadConfig(): ChartConfig {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { ...DEFAULT_CONFIG }
  try {
    const parsed = JSON.parse(raw) as Partial<ChartConfig>
    // Future: switch parsed.version case 'v1' → migrate
    if (parsed.version !== 1) return { ...DEFAULT_CONFIG }
    return mergeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}
```

Strategy đơn giản: schema cũ → reset về defaults. Để giữ data cũ qua migration, đổi thành `case 1: …` rồi map fields.
