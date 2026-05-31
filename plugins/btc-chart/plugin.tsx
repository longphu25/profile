// BTC Chart Plugin — Pro view: NWE + Volume Profile + Order Flow + ML Signal
// Adapted from btc-chart-pro-v3.html for the profile plugin host (Shadow DOM scoped)
//
// External dependency: `lightweight-charts` global, loaded via CDN <script> tag
// in the host HTML page. The plugin reads window.LightweightCharts at mount time.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import './style.css'
import {
  loadConfig,
  saveConfig,
  flushConfig,
  exportConfig,
  importConfigFromFile,
  type ChartConfig,
} from './storage'
import {
  AlertSound,
  ensureNotificationPermission,
  pushNotification,
  evaluateAlerts,
  resetTriggers,
  describeRule,
  makeRule,
  type AlertRule,
  type AlertKind,
} from './alerts'
import { drawVolumeProfile as drawVP } from './volume-profile'
import { drawOrderFlow, type OFOverlaySignal } from './order-flow-overlay'
import { downloadChartSnapshot } from './snapshot'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ─────────────────────────────────────────────────────────────────

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface NWE {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
}

interface OrderFlowSignal {
  type: 'buy' | 'sell'
  price: string
  ratio: string
  time: string
}

interface MLResult {
  score: number
  label: string
  color: string
  features: Record<string, number>
}

declare global {
  interface Window {
    LightweightCharts?: any
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const SYMBOL = 'BTCUSDT'
const LIMIT = 300
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

// Locked chart palette — aligned with TaskForm tokens. Change here to retune.
const CHART = {
  bg: '#071011',
  grid: 'rgba(190,255,234,0.05)',
  border: 'rgba(190,255,234,0.16)',
  axis: '#6f8a83',
  up: '#34d8a4',
  dn: '#ff7a85',
  neu: '#6fbcf0', // NWE mid + RSI
  hi: '#ffc46b', // POC + MA200
  ma50: '#80ffd5', // mint
  vol: 'rgba(159,185,177,0.5)',
  upSoft: 'rgba(52,216,164,0.55)',
  dnSoft: 'rgba(255,122,133,0.55)',
} as const

// ── Formatters ─────────────────────────────────────────────────────────────

const fmtP = (n: number): string =>
  n >= 10000 ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2)
const fmtV = (n: number): string =>
  n >= 1e9
    ? (n / 1e9).toFixed(2) + 'B'
    : n >= 1e6
      ? (n / 1e6).toFixed(2) + 'M'
      : n >= 1e3
        ? (n / 1e3).toFixed(1) + 'K'
        : n.toFixed(0)
const tsNow = (): string => new Date().toLocaleTimeString('vi-VN')

// ── Indicators ─────────────────────────────────────────────────────────────

function calcATR(data: Candle[], period = 14): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  let trSum = 0
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
    trSum += tr
    if (i > period) {
      const prev = data[i - period + 1],
        pp = data[i - period]
      trSum -= Math.max(
        prev.high - prev.low,
        Math.abs(prev.high - pp.close),
        Math.abs(prev.low - pp.close),
      )
    }
    if (i >= period) out[i] = trSum / period
  }
  return out
}

function rqKernel(dist: number, h = 8, alpha = 8): number {
  return Math.pow(1 + (dist * dist) / (2 * alpha * h * h), -alpha)
}

function calcNWE(data: Candle[], lookback = 100, h = 8, alpha = 8, mult = 2.5): NWE {
  const mid = new Array<number | null>(data.length).fill(null)
  const upper = new Array<number | null>(data.length).fill(null)
  const lower = new Array<number | null>(data.length).fill(null)
  const atr = calcATR(data, 14)

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - lookback + 1)
    let num = 0,
      den = 0
    for (let j = start; j <= i; j++) {
      const w = rqKernel(i - j, h, alpha)
      num += data[j].close * w
      den += w
    }
    if (!den) continue
    const m = num / den
    mid[i] = m
    const dev = atr[i] != null ? (atr[i] as number) * mult : null
    if (dev != null) {
      upper[i] = m + dev
      lower[i] = m - dev
    }
  }
  return { mid, upper, lower }
}

function smaNum(arr: number[], period: number): (number | null)[] {
  const out = new Array<number | null>(arr.length).fill(null)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= period) sum -= arr[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function calcSMA(data: Candle[], period: number): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function calcEMA(data: Candle[], period: number): number[] {
  const k = 2 / (period + 1)
  let ema = data[0].close
  return data.map((d) => {
    ema = d.close * k + ema * (1 - k)
    return ema
  })
}

function calcRSI(data: Candle[], period = 14): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  if (data.length < period + 1) return out
  let g = 0,
    l = 0
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close
    if (d > 0) g += d
    else l -= d
  }
  let ag = g / period,
    al = l / period
  out[period] = 100 - 100 / (1 + ag / (al || 0.0001))
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period
    out[i] = 100 - 100 / (1 + ag / (al || 0.0001))
  }
  return out
}

function calcMACD(
  data: Candle[],
  fast = 12,
  slow = 26,
  sig = 9,
): { macd: number[]; signal: number[]; hist: number[] } {
  const ef = calcEMA(data, fast),
    es = calcEMA(data, slow)
  const macd = data.map((_, i) => ef[i] - es[i])
  const k = 2 / (sig + 1)
  let se = macd[0]
  const sl = macd.map((v) => {
    se = v * k + se * (1 - k)
    return se
  })
  const hist = macd.map((v, i) => v - sl[i])
  return { macd, signal: sl, hist }
}

function buildOrderFlow(
  data: Candle[],
  nwe: NWE,
): { overlay: OFOverlaySignal[]; log: OrderFlowSignal[] } {
  const volArr = data.map((x) => x.volume)
  const volSma = smaNum(volArr, 20)
  const overlay: OFOverlaySignal[] = []
  const log: OrderFlowSignal[] = []
  for (let i = 1; i < data.length; i++) {
    const upI = nwe.upper[i],
      loI = nwe.lower[i],
      vs = volSma[i]
    if (upI == null || loI == null || vs == null) continue
    const c = data[i]
    const bullBreak = c.close > upI && c.close > c.open
    const bearBreak = c.close < loI && c.close < c.open
    const volSpike = c.volume > vs * 1.5
    const volRatio = (c.volume / vs).toFixed(1)
    const timeStr = new Date(c.time * 1000).toLocaleDateString('vi-VN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    if (bullBreak && volSpike) {
      overlay.push({
        time: c.time,
        type: 'buy',
        ratio: volRatio,
        high: c.high,
        low: c.low,
      })
      log.unshift({ type: 'buy', price: fmtP(c.close), ratio: volRatio, time: timeStr })
    }
    if (bearBreak && volSpike) {
      overlay.push({
        time: c.time,
        type: 'sell',
        ratio: volRatio,
        high: c.high,
        low: c.low,
      })
      log.unshift({ type: 'sell', price: fmtP(c.close), ratio: volRatio, time: timeStr })
    }
  }
  return { overlay, log: log.slice(0, 6) }
}

function mlSignal(
  data: Candle[],
  nwe: NWE,
  sma50: (number | null)[],
  sma200: (number | null)[],
  rsi: (number | null)[],
  macd: { hist: number[] },
): MLResult {
  const i = data.length - 1
  const c = data[i]
  if (!c || nwe.mid[i] == null) return { score: 0.5, label: '—', color: '#9fb9b1', features: {} }
  const f: Record<string, number> = {}

  const upI = nwe.upper[i],
    loI = nwe.lower[i],
    midI = nwe.mid[i]!
  if (upI != null && loI != null) {
    const range = upI - loI
    const pos = range > 0 ? (c.close - loI) / range : 0.5
    f['NWE_pos'] = pos < 0.2 ? 1 : pos > 0.8 ? -1 : (0.5 - pos) * 2
    f['Price>NWE_mid'] = c.close > midI ? 1 : -1
  }

  if (sma50[i] != null) f['Price>MA50'] = c.close > (sma50[i] as number) ? 1.5 : -1.5
  if (sma200[i] != null) f['Price>MA200'] = c.close > (sma200[i] as number) ? 1 : -1
  if (sma50[i] != null && sma200[i] != null)
    f['MA50>MA200'] = (sma50[i] as number) > (sma200[i] as number) ? 2 : -2

  const rv = rsi[i]
  if (rv != null) f['RSI'] = rv < 30 ? 1.5 : rv > 70 ? -1.5 : ((50 - rv) / 25) * -1

  if (macd.hist[i] != null) {
    f['MACD_hist'] = macd.hist[i] > 0 ? 1 : -1
    if (i > 0 && macd.hist[i - 1] != null)
      f['MACD_acc'] = macd.hist[i] > macd.hist[i - 1] ? 0.5 : -0.5
  }

  if (i >= 5)
    f['Mom5'] = Math.max(
      -1,
      Math.min(1, (((c.close - data[i - 5].close) / data[i - 5].close) * 100) / 3),
    )

  const volArr = data.map((x) => x.volume)
  const vsma = smaNum(volArr, 20)
  if (vsma[i] != null)
    f['VolSpike'] = c.volume > (vsma[i] as number) * 1.3 ? (c.close > c.open ? 0.6 : -0.6) : 0

  const W: Record<string, number> = {
    NWE_pos: 1.5,
    'Price>NWE_mid': 2,
    'Price>MA50': 1.5,
    'Price>MA200': 1,
    'MA50>MA200': 2,
    RSI: 2,
    MACD_hist: 1.5,
    MACD_acc: 1,
    Mom5: 1,
    VolSpike: 0.8,
  }
  let ws = 0,
    wt = 0
  for (const [k, v] of Object.entries(f)) {
    const w = W[k] || 1
    ws += v * w
    wt += w
  }
  const raw = wt ? ws / wt : 0
  const score = (raw + 2) / 4

  let label: string, color: string
  if (score > 0.75) {
    label = 'STRONG BUY'
    color = CHART.up
  } else if (score > 0.58) {
    label = 'BUY'
    color = CHART.up
  } else if (score > 0.42) {
    label = 'NEUTRAL'
    color = '#9fb9b1'
  } else if (score > 0.25) {
    label = 'SELL'
    color = CHART.dn
  } else {
    label = 'STRONG SELL'
    color = CHART.dn
  }
  return { score: Math.max(0, Math.min(1, score)), label, color, features: f }
}

// ── Main React component ───────────────────────────────────────────────────

interface ChartRefs {
  mainChart: any
  rsiChart: any
  volChart: any
  candleSeries: any
  nweMidS: any
  nweUpS: any
  nweLowS: any
  ma50S: any
  ma200S: any
  rsiSeries: any
  rsiOB: any
  rsiOS: any
  volSeries: any
  cleanup: () => void
}

interface VisFlags {
  nwe: boolean
  ma50: boolean
  ma200: boolean
  of: boolean
  vp: boolean
  rsi: boolean
  vol: boolean
}

interface SidebarState {
  nweUpper: string
  nweMid: string
  nweLower: string
  nweZone: { text: string; cls: string }
  sigNwe: { text: string; cls: string }
  sigRsi: { text: string; cls: string }
  sigMa: { text: string; cls: string }
  sigMacd: { text: string; cls: string }
  sigTrend: { text: string; cls: string }
  ml: MLResult
  ofLog: OrderFlowSignal[]
  vp: { poc: string; vah: string; val: string; pos: string }
  vpHvn: number
  /** Latest indicator snapshot for alert evaluation. */
  rsiNow: number | null
  nweUp: number | null
  nweLo: number | null
}

const INITIAL_SIDEBAR: SidebarState = {
  nweUpper: '—',
  nweMid: '—',
  nweLower: '—',
  nweZone: { text: '—', cls: '' },
  sigNwe: { text: '—', cls: '' },
  sigRsi: { text: '—', cls: '' },
  sigMa: { text: '—', cls: '' },
  sigMacd: { text: '—', cls: '' },
  sigTrend: { text: '—', cls: '' },
  ml: { score: 0.5, label: '—', color: '#9fb9b1', features: {} },
  ofLog: [],
  vp: { poc: '—', vah: '—', val: '—', pos: '—' },
  vpHvn: 0,
  rsiNow: null,
  nweUp: null,
  nweLo: null,
}

// ── Alerts panel sub-component ────────────────────────────────────────────

interface AlertsPanelProps {
  alerts: AlertRule[]
  onAdd: (kind: AlertKind, value: number, label?: string) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onReset: (id: string) => void
  currentPrice: number | null
  currentRsi: number | null
}

function AlertsPanel({
  alerts,
  onAdd,
  onRemove,
  onToggle,
  onReset,
  currentPrice,
  currentRsi,
}: AlertsPanelProps) {
  const [kind, setKind] = useState<AlertKind>('price-cross-up')
  const [val, setVal] = useState('')

  // Suggested default value when switching kind.
  useEffect(() => {
    if (kind === 'rsi-overbought') setVal('70')
    else if (kind === 'rsi-oversold') setVal('30')
    else if (kind === 'nwe-upper' || kind === 'nwe-lower') setVal('0')
    else if (currentPrice != null) setVal(String(Math.round(currentPrice)))
  }, [kind, currentPrice])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = Number(val)
    if (kind !== 'nwe-upper' && kind !== 'nwe-lower' && (!Number.isFinite(numeric) || numeric <= 0))
      return
    onAdd(kind, numeric || 0)
  }

  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Alerts</div>
      <form className="btc-chart__alert-form" onSubmit={submit}>
        <select
          className="btc-chart__alert-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
        >
          <option value="price-cross-up">Price ↑ crosses</option>
          <option value="price-cross-down">Price ↓ crosses</option>
          <option value="nwe-upper">Touch NWE Upper</option>
          <option value="nwe-lower">Touch NWE Lower</option>
          <option value="rsi-overbought">RSI overbought</option>
          <option value="rsi-oversold">RSI oversold</option>
        </select>
        {kind !== 'nwe-upper' && kind !== 'nwe-lower' && (
          <input
            className="btc-chart__alert-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={kind.startsWith('rsi') ? '70' : 'price'}
            aria-label="Threshold value"
          />
        )}
        <button type="submit" className="btc-chart__alert-add">
          Add
        </button>
      </form>

      {currentRsi != null && (
        <div className="btc-chart__alert-hint">
          RSI now <span>{currentRsi.toFixed(1)}</span>
          {currentPrice != null && (
            <>
              {' · '}
              <span>${formatPriceShort(currentPrice)}</span>
            </>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="btc-chart__of-empty">Chưa có alert nào</div>
      ) : (
        <div className="btc-chart__alerts-list">
          {alerts.map((r) => (
            <div
              key={r.id}
              className={`btc-chart__alert${
                !r.enabled ? ' is-off' : r.triggeredAt ? ' is-fired' : ''
              }`}
            >
              <button
                type="button"
                className="btc-chart__alert-toggle"
                onClick={() => onToggle(r.id)}
                aria-label={r.enabled ? 'Disable' : 'Enable'}
                title={r.enabled ? 'Disable' : 'Enable'}
              >
                {r.enabled ? '●' : '○'}
              </button>
              <span className="btc-chart__alert-text">{describeRule(r)}</span>
              {r.triggeredAt > 0 ? (
                <button
                  type="button"
                  className="btc-chart__alert-mini"
                  onClick={() => onReset(r.id)}
                  title="Reset trigger"
                >
                  reset
                </button>
              ) : null}
              <button
                type="button"
                className="btc-chart__alert-del"
                onClick={() => onRemove(r.id)}
                aria-label="Delete alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPriceShort(n: number) {
  return n >= 10000 ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2)
}

function BtcChartView() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mainElRef = useRef<HTMLDivElement>(null)
  const rsiElRef = useRef<HTMLDivElement>(null)
  const volElRef = useRef<HTMLDivElement>(null)
  const vpCanvasRef = useRef<HTMLCanvasElement>(null)
  const ofCanvasRef = useRef<HTMLCanvasElement>(null)
  const ofOverlayRef = useRef<OFOverlaySignal[]>([])
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRefs = useRef<ChartRefs | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])

  // Boot configuration (vis flags + interval + alerts + sound + zoom).
  const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

  const visRef = useRef<VisFlags>({ ...cfgInit.vis })
  const vpOptsRef = useRef({ heatmap: true, hvnRatio: 0.8 })
  const alertsRef = useRef<AlertRule[]>([...cfgInit.alerts])
  const soundRef = useRef<AlertSound>(new AlertSound())
  const lastPriceRef = useRef<number | null>(null)
  // Latest computed indicator snapshot — read from inside the WS handler.
  const sidebarRef = useRef<SidebarState>(INITIAL_SIDEBAR)
  // Minimal-mode flag — kept as a ref so render callbacks pick it up
  // without going through the closure capture of `minimal`.
  const minimalRef = useRef<boolean>(cfgInit.minimal)

  const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
  const [vis, setVis] = useState<VisFlags>(visRef.current)
  const [vpOpts, setVpOpts] = useState(vpOptsRef.current)
  const [alerts, setAlerts] = useState<AlertRule[]>(alertsRef.current)
  const [sound, setSound] = useState(cfgInit.sound)
  const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
  const [minimal, setMinimal] = useState<boolean>(cfgInit.minimal)
  const [firedToast, setFiredToast] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('Đang tải BTC/USDT…')
  const [wsStatus, setWsStatus] = useState({
    text: 'Idle',
    tone: 'muted' as 'muted' | 'live' | 'err',
  })
  const [lastUpdate, setLastUpdate] = useState('—')
  const [price, setPrice] = useState({ cur: '—', chg: '+0.00%', up: true })
  const [ohlcv, setOhlcv] = useState({ o: '—', h: '—', l: '—', c: '—', v: '—' })
  const [stats, setStats] = useState({ high: '—', low: '—', vol: '—', chg: '—', up: true })
  const [funding, setFunding] = useState({ val: '—', sub: 'Binance Futures Perp', cls: '' })
  const [fng, setFng] = useState({ val: '—', label: 'Loading…', color: '#9fb9b1', pct: 50 })
  const [sidebar, setSidebar] = useState<SidebarState>(INITIAL_SIDEBAR)

  // Keep refs in sync with state for use inside imperative callbacks.
  useEffect(() => {
    visRef.current = vis
  }, [vis])
  useEffect(() => {
    vpOptsRef.current = vpOpts
  }, [vpOpts])
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    soundRef.current.setVolume(sound.volume)
  }, [sound.volume])
  useEffect(() => {
    sidebarRef.current = sidebar
  }, [sidebar])
  useEffect(() => {
    minimalRef.current = minimal
    // Redraw chart + overlays after CSS reflow finishes.
    requestAnimationFrame(() => {
      if (candlesRef.current.length) renderData(candlesRef.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimal])

  // Persist on any config-affecting change.
  const persist = useCallback(
    (zoom: ChartConfig['zoom'] | undefined) => {
      saveConfig({
        version: 1,
        interval,
        vis,
        zoom: zoom === undefined ? loadConfig().zoom : zoom,
        alerts,
        sound,
        notifications: notifAllowed,
        minimal,
      })
    },
    [interval, vis, alerts, sound, notifAllowed, minimal],
  )
  useEffect(() => {
    persist(undefined)
  }, [persist])
  // Flush pending writes on unload
  useEffect(() => {
    const onBeforeUnload = () => flushConfig()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const fitNextRef = useRef(true)

  const renderData = useCallback((data: Candle[]) => {
    const refs = chartRefs.current
    if (!data.length || !refs) return

    const v = visRef.current
    const nwe = calcNWE(data, 100, 8, 8, 2.5)
    const sma50 = calcSMA(data, 50)
    const sma200 = calcSMA(data, 200)
    const rsi = calcRSI(data, 14)
    const macd = calcMACD(data)
    const of_ = buildOrderFlow(data, nwe)
    const ml = mlSignal(data, nwe, sma50, sma200, rsi, macd)

    const toLine = (arr: (number | null)[]) =>
      data
        .map((c, i) => (arr[i] != null ? { time: c.time, value: arr[i] as number } : null))
        .filter(Boolean) as { time: number; value: number }[]

    refs.candleSeries.setData(
      data.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    // Order flow markers are drawn on our own overlay canvas in the
    // top/bottom gutter bands instead of the built-in setMarkers (which
    // hugs wicks and quickly becomes unreadable).
    ofOverlayRef.current = of_.overlay
    if (ofCanvasRef.current && mainElRef.current && refs.candleSeries) {
      drawOrderFlow(
        ofCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        v.of ? of_.overlay : [],
        true,
        minimalRef.current ? 0 : 64,
        minimalRef.current,
      )
    }

    refs.nweMidS.setData(v.nwe ? toLine(nwe.mid) : [])
    refs.nweUpS.setData(v.nwe ? toLine(nwe.upper) : [])
    refs.nweLowS.setData(v.nwe ? toLine(nwe.lower) : [])
    refs.ma50S.setData(v.ma50 ? toLine(sma50) : [])
    refs.ma200S.setData(v.ma200 ? toLine(sma200) : [])

    const rsiData = data
      .map((c, i) => (rsi[i] != null ? { time: c.time, value: rsi[i] as number } : null))
      .filter(Boolean) as { time: number; value: number }[]
    refs.rsiSeries.setData(v.rsi ? rsiData : [])
    refs.rsiOB.setData(v.rsi ? data.map((c) => ({ time: c.time, value: 70 })) : [])
    refs.rsiOS.setData(v.rsi ? data.map((c) => ({ time: c.time, value: 30 })) : [])

    refs.volSeries.setData(
      v.vol
        ? data.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? CHART.upSoft : CHART.dnSoft,
          }))
        : [],
    )

    if (fitNextRef.current) {
      refs.mainChart.timeScale().fitContent()
      fitNextRef.current = false
    }

    if (vpCanvasRef.current && mainElRef.current) {
      const info = drawVP(vpCanvasRef.current, mainElRef.current, data.slice(-LIMIT), v.vp, {
        ...vpOptsRef.current,
        width: minimalRef.current ? 140 : 220,
      })
      setSidebar((s) => ({
        ...s,
        vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
        vpHvn: info.hvnCount,
      }))
    }

    // Legend
    const i = data.length - 1
    if (legendRef.current) {
      legendRef.current.innerHTML = [
        nwe.mid[i] != null
          ? `<span style="color:${CHART.neu}">NWE ${fmtP(nwe.mid[i] as number)}</span>`
          : null,
        nwe.upper[i] != null
          ? `<span style="color:${CHART.dn}">↑ ${fmtP(nwe.upper[i] as number)}</span>`
          : null,
        nwe.lower[i] != null
          ? `<span style="color:${CHART.up}">↓ ${fmtP(nwe.lower[i] as number)}</span>`
          : null,
        sma50[i] != null
          ? `<span style="color:${CHART.ma50}">MA50 ${fmtP(sma50[i] as number)}</span>`
          : null,
        sma200[i] != null
          ? `<span style="color:${CHART.hi}">MA200 ${fmtP(sma200[i] as number)}</span>`
          : null,
        rsi[i] != null
          ? `<span style="color:${CHART.neu}">RSI ${(rsi[i] as number).toFixed(1)}</span>`
          : null,
      ]
        .filter(Boolean)
        .join('')
    }

    // Sidebar update
    const c = data[i]
    let zoneText = '—',
      zoneCls = ''
    if (nwe.upper[i] != null && nwe.lower[i] != null) {
      if (c.close > (nwe.upper[i] as number)) {
        zoneText = 'Above Upper'
        zoneCls = 'dn'
      } else if (c.close < (nwe.lower[i] as number)) {
        zoneText = 'Below Lower'
        zoneCls = 'up'
      } else {
        zoneText = 'Inside Band'
      }
    }

    const rv = rsi[i]
    const sigRsi =
      rv != null
        ? {
            text: `${rv.toFixed(1)}${rv < 30 ? ' (OS)' : rv > 70 ? ' (OB)' : ''}`,
            cls: rv < 30 ? 'up' : rv > 70 ? 'dn' : '',
          }
        : { text: '—', cls: '' }

    const sigMa =
      sma50[i] != null && sma200[i] != null
        ? (sma50[i] as number) > (sma200[i] as number)
          ? { text: '▲ Golden Cross', cls: 'up' }
          : { text: '▼ Death Cross', cls: 'dn' }
        : { text: '—', cls: '' }

    const mh = macd.hist[i]
    const sigMacd =
      mh != null
        ? mh > 0
          ? { text: '▲ Bull', cls: 'up' }
          : { text: '▼ Bear', cls: 'dn' }
        : { text: '—', cls: '' }

    const sigTrend =
      sma50[i] != null
        ? c.close > (sma50[i] as number)
          ? { text: '▲ Uptrend', cls: 'up' }
          : { text: '▼ Downtrend', cls: 'dn' }
        : { text: '—', cls: '' }

    let sigNwe = { text: '—', cls: '' }
    if (i > 0 && nwe.upper[i - 1] != null && nwe.lower[i - 1] != null) {
      const prev = data[i - 1]
      if (prev.close <= (nwe.lower[i - 1] as number) && c.close > (nwe.lower[i] as number))
        sigNwe = { text: '▲ Cross Up', cls: 'up' }
      else if (prev.close >= (nwe.upper[i - 1] as number) && c.close < (nwe.upper[i] as number))
        sigNwe = { text: '▼ Cross Down', cls: 'dn' }
      else sigNwe = { text: '—', cls: '' }
    }

    setSidebar((s) => ({
      ...s,
      nweUpper: nwe.upper[i] != null ? fmtP(nwe.upper[i] as number) : '—',
      nweMid: nwe.mid[i] != null ? fmtP(nwe.mid[i] as number) : '—',
      nweLower: nwe.lower[i] != null ? fmtP(nwe.lower[i] as number) : '—',
      nweZone: { text: zoneText, cls: zoneCls },
      sigRsi,
      sigMa,
      sigMacd,
      sigTrend,
      sigNwe,
      ml,
      ofLog: of_.log,
      rsiNow: rsi[i] ?? null,
      nweUp: nwe.upper[i] ?? null,
      nweLo: nwe.lower[i] ?? null,
    }))
  }, [])

  // ── Setup charts (once) ───────────────────────────────────────────
  useEffect(() => {
    const LWC = window.LightweightCharts
    if (!LWC) {
      setLoadingText('Lỗi: lightweight-charts chưa được tải.')
      return
    }
    if (
      !mainElRef.current ||
      !rsiElRef.current ||
      !volElRef.current ||
      !mainElRef.current.parentElement
    )
      return

    const col = mainElRef.current.parentElement

    // Use measured pane heights from the CSS flex layout. ResizeObserver below
    // keeps them in sync after first paint, so the initial values can come
    // straight from clientHeight (or a safe fallback if layout is not ready).
    const initMain = mainElRef.current.clientHeight || 360
    const initRsi = rsiElRef.current.clientHeight || 80
    const initVol = volElRef.current.clientHeight || 80

    const base = {
      layout: {
        background: { type: 'solid', color: CHART.bg },
        textColor: CHART.axis,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART.grid },
        horzLines: { color: CHART.grid },
      },
      crosshair: {
        mode: LWC.CrosshairMode.Normal,
        vertLine: { color: 'rgba(190,255,234,0.25)', width: 1, style: 3 },
        horzLine: { color: 'rgba(190,255,234,0.25)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: CHART.border,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: CHART.border,
        timeVisible: true,
        secondsVisible: false,
      },
    }

    const mainChart = LWC.createChart(mainElRef.current, {
      ...base,
      width: mainElRef.current.clientWidth,
      height: initMain,
      timeScale: { ...base.timeScale, visible: false },
    })
    const rsiChart = LWC.createChart(rsiElRef.current, {
      ...base,
      width: rsiElRef.current.clientWidth,
      height: initRsi,
      timeScale: { ...base.timeScale, visible: false },
    })
    const volChart = LWC.createChart(volElRef.current, {
      ...base,
      width: volElRef.current.clientWidth,
      height: initVol,
    })

    const candleSeries = mainChart.addCandlestickSeries({
      upColor: CHART.up,
      downColor: CHART.dn,
      borderUpColor: CHART.up,
      borderDownColor: CHART.dn,
      wickUpColor: CHART.up,
      wickDownColor: CHART.dn,
    })

    const nweUpS = mainChart.addLineSeries({
      color: 'rgba(255,122,133,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'NWE+',
    })
    const nweMidS = mainChart.addLineSeries({
      color: 'rgba(111,188,240,0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'NWE',
    })
    const nweLowS = mainChart.addLineSeries({
      color: 'rgba(52,216,164,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'NWE-',
    })
    const ma50S = mainChart.addLineSeries({
      color: CHART.ma50,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA50',
    })
    const ma200S = mainChart.addLineSeries({
      color: CHART.hi,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA200',
    })

    const rsiSeries = rsiChart.addLineSeries({
      color: CHART.neu,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    const rsiOB = rsiChart.addLineSeries({
      color: 'rgba(255,122,133,0.35)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const rsiOS = rsiChart.addLineSeries({
      color: 'rgba(52,216,164,0.35)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const volSeries = volChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      scaleMargins: { top: 0.1, bottom: 0 },
    })

    const sync = (src: any, ...tgts: any[]) =>
      src.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
        if (r) tgts.forEach((t) => t.timeScale().setVisibleLogicalRange(r))
      })
    sync(mainChart, rsiChart, volChart)
    sync(rsiChart, mainChart, volChart)
    sync(volChart, mainChart, rsiChart)

    // Persist zoom whenever the user pans/zooms the main chart.
    // Also redraw the order-flow overlay so pills follow the candles.
    mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (!r) return
      saveConfig({
        ...loadConfig(),
        zoom: { from: r.from, to: r.to },
      })
      if (ofCanvasRef.current && mainElRef.current) {
        drawOrderFlow(
          ofCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          visRef.current.of ? ofOverlayRef.current : [],
          true,
          minimalRef.current ? 0 : 64,
          minimalRef.current,
        )
      }
    })

    mainChart.subscribeCrosshairMove((param: any) => {
      if (!param?.time) return
      rsiChart.setCrosshairPosition(0, param.time, rsiSeries)
      volChart.setCrosshairPosition(0, param.time, volSeries)
      const d = param.seriesData?.get(candleSeries)
      if (d) {
        setOhlcv({
          o: fmtP(d.open),
          h: fmtP(d.high),
          l: fmtP(d.low),
          c: fmtP(d.close),
          v: ohlcv.v,
        })
      }
    })

    // Observe each pane element so chart libs see real measured heights,
    // and CSS flex (7 / 1.5 / 1.5) keeps them in correct ratios.
    const syncSize = () => {
      if (!mainElRef.current || !rsiElRef.current || !volElRef.current) return
      const mw = mainElRef.current.clientWidth
      const mh2 = mainElRef.current.clientHeight
      const rh2 = rsiElRef.current.clientHeight
      const vh2 = volElRef.current.clientHeight
      if (mh2 <= 0 || rh2 <= 0 || vh2 <= 0) return
      mainChart.applyOptions({ width: mw, height: mh2 })
      rsiChart.applyOptions({ width: rsiElRef.current.clientWidth, height: rh2 })
      volChart.applyOptions({ width: volElRef.current.clientWidth, height: vh2 })
      if (candlesRef.current.length && vpCanvasRef.current) {
        const info = drawVP(
          vpCanvasRef.current,
          mainElRef.current,
          candlesRef.current.slice(-LIMIT),
          visRef.current.vp,
          vpOptsRef.current,
        )
        setSidebar((s) => ({
          ...s,
          vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
          vpHvn: info.hvnCount,
        }))
      }
      if (ofCanvasRef.current) {
        drawOrderFlow(
          ofCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          visRef.current.of ? ofOverlayRef.current : [],
          true,
          minimalRef.current ? 0 : 64,
          minimalRef.current,
        )
      }
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(col)
    ro.observe(mainElRef.current)
    ro.observe(rsiElRef.current)
    ro.observe(volElRef.current)
    // First sync after layout settles
    requestAnimationFrame(syncSize)

    chartRefs.current = {
      mainChart,
      rsiChart,
      volChart,
      candleSeries,
      nweMidS,
      nweUpS,
      nweLowS,
      ma50S,
      ma200S,
      rsiSeries,
      rsiOB,
      rsiOS,
      volSeries,
      cleanup: () => {
        ro.disconnect()
        try {
          mainChart.remove()
        } catch {
          /* noop */
        }
        try {
          rsiChart.remove()
        } catch {
          /* noop */
        }
        try {
          volChart.remove()
        } catch {
          /* noop */
        }
      },
    }

    return () => {
      chartRefs.current?.cleanup()
      chartRefs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch klines + open WS for the selected interval ───────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadingText(`Tải dữ liệu ${interval}…`)
    fitNextRef.current = true

    const closeWs = () => {
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* noop */
        }
        wsRef.current = null
      }
    }

    const connectWs = () => {
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@kline_${interval}`,
      )
      wsRef.current = ws
      ws.onopen = () => {
        if (cancelled) return
        setWsStatus({ text: 'Live', tone: 'live' })
        setLastUpdate(tsNow())
      }
      ws.onmessage = (ev) => {
        if (cancelled) return
        const k = JSON.parse(ev.data).k
        const candle: Candle = {
          time: Math.floor(k.t / 1000),
          open: +k.o,
          high: +k.h,
          low: +k.l,
          close: +k.c,
          volume: +k.v,
        }
        const arr = candlesRef.current
        const last = arr[arr.length - 1]
        if (last && last.time === candle.time) arr[arr.length - 1] = candle
        else if (!last || candle.time > last.time) {
          arr.push(candle)
          if (arr.length > LIMIT + 50) arr.shift()
        }
        chartRefs.current?.candleSeries.update({
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })
        chartRefs.current?.volSeries.update({
          time: candle.time,
          value: candle.volume,
          color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
        })
        setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
        setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
        setLastUpdate(tsNow())

        // ── Alerts: evaluate against latest indicators ─────────────
        const ctx = {
          price: candle.close,
          prevPrice: lastPriceRef.current,
          nweUpper: sidebarRef.current.nweUp,
          nweLower: sidebarRef.current.nweLo,
          rsi: sidebarRef.current.rsiNow,
        }
        lastPriceRef.current = candle.close
        const fired = evaluateAlerts(alertsRef.current, ctx)
        if (fired.length) {
          // sound + browser notif + in-app toast
          if (sound.enabled) soundRef.current.play()
          for (const f of fired) {
            pushNotification('BTC Chart Alert', `${describeRule(f.rule)} — ${f.message}`)
          }
          setFiredToast(fired.map((f) => describeRule(f.rule)).join(' · '))
          // persist trigger state + force re-render of alerts list
          setAlerts([...alertsRef.current])
        }

        if (k.x) renderData(arr)
      }
      ws.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
      ws.onclose = () => setWsStatus({ text: 'Closed', tone: 'muted' })
    }

    ;(async () => {
      try {
        const r = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&limit=${LIMIT}`,
        )
        if (!r.ok) throw new Error('HTTP ' + r.status)
        const raw = (await r.json()) as any[][]
        if (cancelled) return
        const cands: Candle[] = raw.map((d) => ({
          time: Math.floor(d[0] / 1000),
          open: +d[1],
          high: +d[2],
          low: +d[3],
          close: +d[4],
          volume: +d[5],
        }))
        candlesRef.current = cands
        renderData(cands)
        // Restore saved zoom (if any) — applied after fitContent in renderData.
        const savedZoom = loadConfig().zoom
        if (savedZoom && chartRefs.current?.mainChart) {
          chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(savedZoom)
        }
        connectWs()
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setWsStatus({
          text: e instanceof Error ? e.message : 'fetch error',
          tone: 'err',
        })
        // Mock fallback
        const step =
          { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[interval] ||
          3600
        const t0 = Math.floor(Date.now() / 1000) - LIMIT * step
        let p = 65000
        const cands: Candle[] = []
        for (let i = 0; i <= LIMIT; i++) {
          const ch = (Math.random() - 0.48) * 900
          const o = p
          p = Math.max(55000, Math.min(75000, p + ch))
          const c = p
          cands.push({
            time: t0 + i * step,
            open: o,
            high: Math.max(o, c) + Math.random() * 400,
            low: Math.min(o, c) - Math.random() * 400,
            close: c,
            volume: 200 + Math.random() * 1800,
          })
        }
        candlesRef.current = cands
        renderData(cands)
        setWsStatus({ text: 'Demo data (offline)', tone: 'err' })
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
      closeWs()
    }
  }, [interval, renderData])

  // ── Background polls: ticker / funding / fng ───────────────────────
  useEffect(() => {
    let stopped = false

    const fetchTicker = async () => {
      try {
        const t = await (
          await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${SYMBOL}`)
        ).json()
        if (stopped) return
        const p = +t.lastPrice,
          ch = +t.priceChangePercent
        setPrice({
          cur: fmtP(p),
          chg: (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%',
          up: ch >= 0,
        })
        setOhlcv({
          o: fmtP(+t.openPrice),
          h: fmtP(+t.highPrice),
          l: fmtP(+t.lowPrice),
          c: fmtP(p),
          v: fmtV(+t.volume),
        })
        setStats({
          high: fmtP(+t.highPrice),
          low: fmtP(+t.lowPrice),
          vol: fmtV(+t.quoteVolume),
          chg: (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%',
          up: ch >= 0,
        })
      } catch {
        /* noop */
      }
    }
    const fetchFunding = async () => {
      try {
        const d = await (
          await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${SYMBOL}`)
        ).json()
        if (stopped) return
        const rate = +d.lastFundingRate * 100
        setFunding({
          val: (rate >= 0 ? '+' : '') + rate.toFixed(4) + '%',
          sub: rate > 0.1 ? 'Long heavy' : rate < 0 ? 'Short heavy' : 'Balanced',
          cls: rate > 0.05 ? 'dn' : rate < 0 ? 'up' : '',
        })
      } catch {
        setFunding((f) => ({ ...f, val: 'N/A' }))
      }
    }
    const fetchFng = async () => {
      try {
        const d = await (await fetch('https://api.alternative.me/fng/?limit=1')).json()
        if (stopped) return
        const v = +d.data[0].value,
          cls = d.data[0].value_classification
        const col =
          v < 25
            ? CHART.dn
            : v < 45
              ? '#ffaf6b'
              : v < 55
                ? CHART.hi
                : v < 75
                  ? CHART.up
                  : CHART.ma50
        setFng({ val: String(v), label: cls, color: col, pct: v })
      } catch {
        /* noop */
      }
    }

    fetchTicker()
    fetchFunding()
    fetchFng()
    const id1 = window.setInterval(fetchTicker, 5000)
    const id2 = window.setInterval(fetchFunding, 30000)
    const id3 = window.setInterval(fetchFng, 60000)
    return () => {
      stopped = true
      clearInterval(id1)
      clearInterval(id2)
      clearInterval(id3)
    }
  }, [])

  // ── Toggles ─────────────────────────────────────────────────────────
  const toggle = useCallback(
    (key: keyof VisFlags) => {
      setVis((v) => {
        const next = { ...v, [key]: !v[key] }
        visRef.current = next
        if (candlesRef.current.length) {
          // Defer to next tick so visRef is read inside renderData
          queueMicrotask(() => renderData(candlesRef.current))
        }
        return next
      })
    },
    [renderData],
  )

  // ── VP options ──────────────────────────────────────────────────────
  const toggleHeatmap = useCallback(() => {
    setVpOpts((o) => {
      const next = { ...o, heatmap: !o.heatmap }
      vpOptsRef.current = next
      queueMicrotask(() => renderData(candlesRef.current))
      return next
    })
  }, [renderData])

  // ── Alert handlers ──────────────────────────────────────────────────
  const addAlert = useCallback((kind: AlertKind, value: number, label?: string) => {
    setAlerts((rs) => [...rs, makeRule(kind, value, label)])
  }, [])
  const removeAlert = useCallback((id: string) => {
    setAlerts((rs) => rs.filter((r) => r.id !== id))
  }, [])
  const toggleAlert = useCallback((id: string) => {
    setAlerts((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled, triggeredAt: 0 } : r)),
    )
  }, [])
  const resetAlert = useCallback((id: string) => {
    setAlerts((rs) => {
      const next = [...rs]
      resetTriggers(next, id)
      return next
    })
  }, [])

  // ── Sound + notifications ───────────────────────────────────────────
  const toggleSound = useCallback(() => {
    setSound((s) => {
      const next = { ...s, enabled: !s.enabled }
      // First toggle on requires a user gesture to unlock AudioContext.
      if (next.enabled) soundRef.current.play()
      return next
    })
  }, [])
  const setVolume = useCallback((vol: number) => {
    setSound((s) => ({ ...s, volume: vol }))
  }, [])
  const requestNotif = useCallback(async () => {
    const result = await ensureNotificationPermission()
    setNotifAllowed(result === 'granted')
  }, [])

  // ── Snapshot ────────────────────────────────────────────────────────
  const snapshot = useCallback(() => {
    const refs = chartRefs.current
    if (!refs || !mainElRef.current || !rsiElRef.current || !volElRef.current) return
    downloadChartSnapshot({
      main: { chart: refs.mainChart, height: mainElRef.current.clientHeight },
      rsi: visRef.current.rsi
        ? { chart: refs.rsiChart, height: rsiElRef.current.clientHeight }
        : null,
      vol: visRef.current.vol
        ? { chart: refs.volChart, height: volElRef.current.clientHeight }
        : null,
      vpOverlay: visRef.current.vp ? vpCanvasRef.current : null,
      ofOverlay: visRef.current.of ? ofCanvasRef.current : null,
    })
  }, [])

  // ── Import / Export config ──────────────────────────────────────────
  const exportNow = useCallback(() => {
    exportConfig({
      version: 1,
      interval,
      vis,
      zoom: loadConfig().zoom,
      alerts,
      sound,
      notifications: notifAllowed,
      minimal,
    })
  }, [interval, vis, alerts, sound, notifAllowed, minimal])

  const importNow = useCallback(
    async (file: File) => {
      try {
        const cfg = await importConfigFromFile(file)
        setVis(cfg.vis)
        visRef.current = cfg.vis
        setAlerts(cfg.alerts)
        alertsRef.current = cfg.alerts
        setSound(cfg.sound)
        setNotifAllowed(cfg.notifications)
        setMinimal(cfg.minimal)
        if (cfg.interval !== interval) setInterval_(cfg.interval as Interval)
        // restore zoom if present
        if (cfg.zoom && chartRefs.current?.mainChart) {
          chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(cfg.zoom)
        }
        saveConfig(cfg)
        setImportErr(null)
      } catch (e) {
        setImportErr(e instanceof Error ? e.message : 'invalid file')
      }
    },
    [interval],
  )

  // ── Toast auto-dismiss ──────────────────────────────────────────────
  useEffect(() => {
    if (!firedToast) return
    const t = setTimeout(() => setFiredToast(null), 5000)
    return () => clearTimeout(t)
  }, [firedToast])

  const indButtons: { key: keyof VisFlags; label: string; sep?: boolean }[] = [
    { key: 'nwe', label: 'NWE' },
    { key: 'ma50', label: 'MA50' },
    { key: 'ma200', label: 'MA200' },
    { key: 'of', label: 'Order Flow' },
    { key: 'vp', label: 'Vol Profile', sep: true },
    { key: 'rsi', label: 'RSI' },
    { key: 'vol', label: 'Volume' },
  ]

  return (
    <div className={`btc-chart${minimal ? ' is-minimal' : ''}`} ref={rootRef}>
      {minimal && (
        <>
          <div className="btc-chart__minimal-title">
            <span className="btc-chart__minimal-pair">BTC/USDT</span>
            <span className="btc-chart__minimal-iv">— {interval}</span>
          </div>
          <button
            type="button"
            className="btc-chart__minimal-exit"
            onClick={() => setMinimal(false)}
            title="Exit minimal mode"
            aria-label="Exit minimal mode"
          >
            Pro
          </button>
        </>
      )}{' '}
      {loading && (
        <div className="btc-chart__loading">
          <div className="btc-chart__spinner" />
          <span className="btc-chart__loading-text">{loadingText}</span>
        </div>
      )}
      {firedToast && (
        <div className="btc-chart__toast" role="status">
          <span className="btc-chart__toast-tag">ALERT</span>
          <span>{firedToast}</span>
          <button
            type="button"
            className="btc-chart__toast-x"
            onClick={() => setFiredToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {importErr && (
        <div className="btc-chart__toast btc-chart__toast--err" role="alert">
          <span className="btc-chart__toast-tag">IMPORT</span>
          <span>{importErr}</span>
          <button type="button" className="btc-chart__toast-x" onClick={() => setImportErr(null)}>
            ×
          </button>
        </div>
      )}
      {/* Header */}
      <div className="btc-chart__header">
        <span className="btc-chart__pair">
          BTC<small>/ USDT</small>
        </span>
        <div className="btc-chart__intervals">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              className={`btc-chart__iv-btn${interval === iv ? ' is-active' : ''}`}
              onClick={() => setInterval_(iv)}
            >
              {iv.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="btc-chart__price">
          <span className={`btc-chart__price-cur ${price.up ? 'up' : 'dn'}`}>{price.cur}</span>
          <span className={`btc-chart__price-chg ${price.up ? 'up' : 'dn'}`}>{price.chg}</span>
        </div>
        <div className="btc-chart__ohlcv">
          <span>
            O <span>{ohlcv.o}</span>
          </span>
          <span>
            H <span>{ohlcv.h}</span>
          </span>
          <span>
            L <span>{ohlcv.l}</span>
          </span>
          <span>
            C <span>{ohlcv.c}</span>
          </span>
          <span>
            V <span>{ohlcv.v}</span>
          </span>
        </div>
        <div className="btc-chart__live">
          <span className="btc-chart__live-dot" />
          Live
        </div>
      </div>
      {/* Toolbar */}
      <div className="btc-chart__toolbar">
        <span className="btc-chart__tb-label">Indicators</span>
        {indButtons.map((b, idx) => (
          <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {b.sep && idx > 0 && <span className="btc-chart__sep">·</span>}
            <button
              type="button"
              className={`btc-chart__ind-btn${vis[b.key] ? ' is-on' : ''}`}
              onClick={() => toggle(b.key)}
            >
              {b.label}
            </button>
          </span>
        ))}

        <span className="btc-chart__sep">·</span>
        <button
          type="button"
          className={`btc-chart__ind-btn${vpOpts.heatmap ? ' is-on' : ''}`}
          onClick={toggleHeatmap}
          title="Toggle heatmap behind volume profile"
        >
          Heatmap
        </button>

        <div className="btc-chart__tb-spacer" />

        <button
          type="button"
          className={`btc-chart__ind-btn${sound.enabled ? ' is-on' : ''}`}
          onClick={toggleSound}
          title="Sound on alert"
          aria-label="Toggle alert sound"
        >
          {sound.enabled ? 'Sound on' : 'Sound off'}
        </button>
        <button
          type="button"
          className={`btc-chart__ind-btn${notifAllowed ? ' is-on' : ''}`}
          onClick={requestNotif}
          title="Browser notifications"
        >
          {notifAllowed ? 'Notif on' : 'Notif…'}
        </button>
        <button type="button" className="btc-chart__ind-btn" onClick={snapshot}>
          PNG
        </button>
        <button type="button" className="btc-chart__ind-btn" onClick={exportNow}>
          Export
        </button>
        <label className="btc-chart__ind-btn btc-chart__file" title="Import config JSON">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importNow(f)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className={`btc-chart__ind-btn${minimal ? ' is-on' : ''}`}
          onClick={() => setMinimal((m) => !m)}
          title="Minimal mode — chart only, hide chrome"
        >
          {minimal ? 'Pro' : 'Min'}
        </button>
      </div>
      {/* Body */}
      <div className="btc-chart__body">
        <div className="btc-chart__col">
          <div className="btc-chart__legend" ref={legendRef} />
          <canvas className="btc-chart__vp-canvas" ref={vpCanvasRef} />
          <canvas className="btc-chart__of-canvas" ref={ofCanvasRef} />
          <div className="btc-chart__main" ref={mainElRef} />
          <div className="btc-chart__rsi" ref={rsiElRef} />
          <div className="btc-chart__vol" ref={volElRef} />
        </div>

        {/* Sidebar */}
        <div className="btc-chart__sidebar">
          {/* ML signal — single block, colored by stance */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Signal</div>
            <div
              className={`btc-chart__ml ${
                sidebar.ml.score > 0.55 ? 'is-buy' : sidebar.ml.score < 0.45 ? 'is-sell' : ''
              }`}
            >
              <div className="btc-chart__ml-head">
                <span className="btc-chart__ml-label" style={{ color: sidebar.ml.color }}>
                  {sidebar.ml.label}
                </span>
                <span className="btc-chart__ml-pct">{Math.round(sidebar.ml.score * 100)}%</span>
              </div>
              <div className="btc-chart__ml-bar-wrap">
                <div
                  className="btc-chart__ml-bar"
                  style={{
                    width: Math.round(sidebar.ml.score * 100) + '%',
                    background: sidebar.ml.color,
                  }}
                />
              </div>
              <div className="btc-chart__ml-foot">Confidence · NWE + MA + RSI + MACD</div>
            </div>
          </div>

          {/* Alerts */}
          <AlertsPanel
            alerts={alerts}
            onAdd={addAlert}
            onRemove={removeAlert}
            onToggle={toggleAlert}
            onReset={resetAlert}
            currentPrice={candlesRef.current[candlesRef.current.length - 1]?.close ?? null}
            currentRsi={sidebar.rsiNow}
          />

          {/* NWE */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Nadaraya-Watson</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Upper</span>
              <span className="btc-chart__row-val dn">{sidebar.nweUpper}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Mid</span>
              <span className="btc-chart__row-val neu">{sidebar.nweMid}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Lower</span>
              <span className="btc-chart__row-val up">{sidebar.nweLower}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Zone</span>
              <span className={`btc-chart__row-val ${sidebar.nweZone.cls}`}>
                {sidebar.nweZone.text}
              </span>
            </div>
          </div>

          {/* TA Signals */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Technicals</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">NWE Cross</span>
              <span className={`btc-chart__row-val ${sidebar.sigNwe.cls}`}>
                {sidebar.sigNwe.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">RSI · 14</span>
              <span className={`btc-chart__row-val ${sidebar.sigRsi.cls}`}>
                {sidebar.sigRsi.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">MA 50 / 200</span>
              <span className={`btc-chart__row-val ${sidebar.sigMa.cls}`}>
                {sidebar.sigMa.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">MACD</span>
              <span className={`btc-chart__row-val ${sidebar.sigMacd.cls}`}>
                {sidebar.sigMacd.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Trend</span>
              <span className={`btc-chart__row-val ${sidebar.sigTrend.cls}`}>
                {sidebar.sigTrend.text}
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Feature weights</div>
            <div className="btc-chart__features">
              {Object.entries(sidebar.ml.features).map(([k, v]) => (
                <div key={k} className="btc-chart__feat">
                  <div className="btc-chart__feat-name">{FEATURE_LABEL[k] ?? k}</div>
                  <div className={`btc-chart__feat-val ${v >= 0 ? 'up' : 'dn'}`}>
                    {v >= 0 ? '+' : ''}
                    {v.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Flow */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Order flow</div>
            {sidebar.ofLog.length === 0 ? (
              <span className="btc-chart__of-empty">Chưa có tín hiệu spike</span>
            ) : (
              sidebar.ofLog.map((s, idx) => (
                <div key={idx} className="btc-chart__of-item">
                  <span className={`btc-chart__of-tag ${s.type === 'buy' ? 'is-buy' : 'is-sell'}`}>
                    {s.type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="btc-chart__of-text">
                    ${s.price} · ×{s.ratio}
                  </span>
                  <span className="btc-chart__of-time">{s.time}</span>
                </div>
              ))
            )}
          </div>

          {/* Volume Profile */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Volume profile</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">POC</span>
              <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
                {sidebar.vp.poc}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">VAH · 70%</span>
              <span className="btc-chart__row-val dn">{sidebar.vp.vah}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">VAL · 70%</span>
              <span className="btc-chart__row-val up">{sidebar.vp.val}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">vs POC</span>
              <span className="btc-chart__row-val">{sidebar.vp.pos}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">HVN nodes</span>
              <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
                {sidebar.vpHvn}
              </span>
            </div>
          </div>

          {/* Fear & Greed */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Fear &amp; Greed</div>
            <div className="btc-chart__fng">
              <div className="btc-chart__fng-val" style={{ color: fng.color }}>
                {fng.val}
              </div>
              <div className="btc-chart__fng-label" style={{ color: fng.color }}>
                {fng.label}
              </div>
              <div className="btc-chart__fng-bar">
                <div className="btc-chart__fng-ptr" style={{ left: fng.pct + '%' }} />
              </div>
            </div>
          </div>

          {/* Funding */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Funding rate</div>
            <div className={`btc-chart__fund-val ${funding.cls}`}>{funding.val}</div>
            <div className="btc-chart__fund-sub">{funding.sub}</div>
            <div className="btc-chart__fund-rules">
              <div>
                <span>&gt; 0.10%</span>
                <span className="dn">Long heavy</span>
              </div>
              <div>
                <span>0 – 0.05%</span>
                <span className="up">Balanced</span>
              </div>
              <div>
                <span>&lt; 0%</span>
                <span className="neu">Short heavy</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">24h stats</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">High</span>
              <span className="btc-chart__row-val">{stats.high}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Low</span>
              <span className="btc-chart__row-val">{stats.low}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Volume</span>
              <span className="btc-chart__row-val">{stats.vol}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Change</span>
              <span className={`btc-chart__row-val ${stats.up ? 'up' : 'dn'}`}>{stats.chg}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Status */}
      <div className="btc-chart__status">
        <span
          className={
            wsStatus.tone === 'live'
              ? 'btc-chart__status-live'
              : wsStatus.tone === 'err'
                ? 'dn'
                : ''
          }
        >
          {wsStatus.text}
        </span>
        <span>{lastUpdate}</span>
        <span>OF · {sidebar.ofLog.length}</span>
        <span className="btc-chart__status-tag">NWE · VP · Order Flow</span>
      </div>
    </div>
  )
}

const FEATURE_LABEL: Record<string, string> = {
  NWE_pos: 'NWE Pos',
  'Price>NWE_mid': 'P>NWE',
  'Price>MA50': 'P>MA50',
  'Price>MA200': 'P>MA200',
  'MA50>MA200': 'MA50/200',
  RSI: 'RSI',
  MACD_hist: 'MACD',
  MACD_acc: 'MACD Acc',
  Mom5: 'Mom5',
  VolSpike: 'VolSpike',
}

// ── Plugin export ──────────────────────────────────────────────────────────

const BtcChartPlugin: Plugin = {
  name: 'BtcChart',
  version: '1.0.0',
  styleUrls: ['/plugins/btc-chart/style.css'],

  init(host: HostAPI) {
    host.registerComponent('BtcChart', BtcChartView)
    host.log('BtcChart plugin initialized')
  },

  mount() {
    console.log('[BtcChart] mounted')
  },

  unmount() {
    console.log('[BtcChart] unmounted')
  },
}

export default BtcChartPlugin
