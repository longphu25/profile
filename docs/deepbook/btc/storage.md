# Storage

Source: `plugins/btc-chart/storage.ts`

## Key & Schema

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

`version` exists to support future migration. If the schema changes, bump to
`v2`, and return the default config for old `v1` files.

## API

```ts
// Read config — always returns a valid config (merged with defaults).
loadConfig(): ChartConfig

// Write config — throttled to 250ms for smooth pan/zoom.
saveConfig(cfg: ChartConfig): void

// Flush pending writes immediately (called in beforeunload).
flushConfig(): void

// Download config as a JSON file.
exportConfig(cfg: ChartConfig, filename?: string): void

// Read a user-uploaded JSON file, validate it, merge defaults.
importConfigFromFile(file: File): Promise<ChartConfig>

// Helper that merges a partial config into defaults — used by load and import.
mergeConfig(p: Partial<ChartConfig>): ChartConfig
```

## Throttle Implementation

```ts
let writeTimer: ReturnType<typeof setTimeout> | null = null
let pending: ChartConfig | null = null

export function saveConfig(cfg: ChartConfig): void {
  pending = cfg
  if (writeTimer) return            // timer already scheduled
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (!pending) return
    try {
      localStorage.setItem(KEY, JSON.stringify(pending))
    } catch {
      // quota exceeded / private mode → fail silently
    }
    pending = null
  }, 250)
}
```

Why throttle:
- `subscribeVisibleLogicalRangeChange` fires every frame while the user pans or zooms (60fps).
- Without throttling, that becomes 60 `JSON.stringify + setItem` calls per
  second, which causes jank.

`flushConfig()` gọi trong `beforeunload`:
```ts
useEffect(() => {
  const onBeforeUnload = () => flushConfig()
  window.addEventListener('beforeunload', onBeforeUnload)
  return () => window.removeEventListener('beforeunload', onBeforeUnload)
}, [])
```

## Plugin-side Persistence

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

When `interval/vis/alerts/sound/notifAllowed` changes, persistence fires
automatically. Zoom is persisted separately from
`subscribeVisibleLogicalRangeChange`:

```ts
mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
  if (!r) return
  saveConfig({ ...loadConfig(), zoom: { from: r.from, to: r.to } })
})
```

Using `loadConfig()` here preserves the other already-persisted fields and
avoids racing with the `persist` callback.

## Restore on Mount

```ts
const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

const visRef = useRef<VisFlags>({ ...cfgInit.vis })
const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
const [vis, setVis] = useState<VisFlags>(visRef.current)
const [alerts, setAlerts] = useState<AlertRule[]>([...cfgInit.alerts])
const [sound, setSound] = useState(cfgInit.sound)
const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
```

Zoom is restored after klines finish loading (inside the interval-based
`useEffect`):

```ts
candlesRef.current = cands
renderData(cands)
const savedZoom = loadConfig().zoom
if (savedZoom && chartRefs.current?.mainChart) {
  chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(savedZoom)
}
connectWs()
```

## JSON Import / Export

**Export** = stringify config + Blob + `<a download>` click:

```ts
const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url; a.download = filename; a.click()
URL.revokeObjectURL(url)
```

**Import** uses a `<label>` wrapping a hidden file input (avoids a programmatic
dialog):

```tsx
<label className="btc-chart__ind-btn btc-chart__file">
  Import
  <input type="file" accept="application/json,.json"
    onChange={(e) => {
      const f = e.target.files?.[0]
      if (f) importNow(f)
      e.target.value = ''           // reset so the same file can be chosen again
    }}
  />
</label>
```

Inside `importNow(file)`:
1. `importConfigFromFile(file)` → parse + merge defaults.
2. Apply to all relevant state: `setVis`, `setAlerts`, `setSound`,
   `setNotifAllowed`, `setInterval_`.
3. Restore zoom nếu có (gọi `setVisibleLogicalRange`).
4. Call `saveConfig(cfg)` immediately (no need to wait for the throttled effect).
5. Parse errors go through `setImportErr` and show a red toast.

## Migration

Khi đổi schema:

```ts
export function loadConfig(): ChartConfig {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { ...DEFAULT_CONFIG }
  try {
    const parsed = JSON.parse(raw) as Partial<ChartConfig>
    // Future: switch on parsed.version and migrate older schemas
    if (parsed.version !== 1) return { ...DEFAULT_CONFIG }
    return mergeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}
```

The current strategy is simple: old schema → reset to defaults. If preserving
old data across migrations matters, replace that with explicit `case 1: …`
mapping logic.
