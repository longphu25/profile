// BTC Chart Plugin — Pro view: Midnight Hunter band + Volume Profile + signals + ML
// Adapted from btc-chart-pro-v3.html for the profile plugin host (Shadow DOM scoped)
//
// External dependency: `lightweight-charts` global, loaded via CDN <script> tag
// in the host HTML page. The plugin reads window.LightweightCharts at mount time.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Styles injected via Shadow DOM <link> (see BtcChartPage styleUrls), not JS imports.
import {
  loadConfig,
  saveConfig,
  flushConfig,
  exportConfig,
  importConfigFromFile,
  type ChartConfig,
  type VisFlags,
  type OscView,
  type NadarayaConfig,
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
import { computeSMC, initSmcWasm, computeNadarayaWatson, type SMCResult } from './smc-wasm'
import { buildBoxFlipSignals, type BoxFlipResult } from './box-flip'
import { downloadChartSnapshot } from './snapshot'
// Direct imports (avoid barrel for better bundle analyzability per best practices)
import { AlertsPanel } from './components/AlertsPanel'

import { StatsPanel, FearGreedPanel } from './components/MarketPanels'

import { VolumeSpikePanel } from './components/VolumeSpikePanel'
import { ChartHeader } from './components/ChartHeader'
import { ChartToolbarPanel } from './components/ChartToolbarPanel'
import { ChartToasts } from './components/ChartToasts'
import { ChartLoadingOverlay } from './components/ChartLoadingOverlay'
import { ChartStatusBar } from './components/ChartStatusBar'
import { ChartLayerDots } from './components/ChartLayerDots'
import { OscillatorPane } from './components/OscillatorPane'
import { IntelRail, type IntelTab } from './components/IntelRail'
import { ALL_IND_KEYS } from './lib/indicator-groups'
import { applyLayerPreset, type LayerPresetId } from './lib/layer-presets'

import { SidebarAccordion } from './components/SidebarAccordion'
import { RailSection } from './components/sidebar'
// (FundingNwe / Sessions / Liquidity / OI / Technicals are lazy-loaded below)

// Lazy loaded heavier panels (code split + initial perf)

const VolumeProfilePanel = lazy(() =>
  import('./components/IndicatorReadouts').then((m) => ({ default: m.VolumeProfilePanel })),
)
const OrderFlowPanel = lazy(() =>
  import('./components/IndicatorReadouts').then((m) => ({ default: m.OrderFlowPanel })),
)
const BoxFlipPanelLazy = lazy(() =>
  import('./components/IndicatorReadouts').then((m) => ({ default: m.BoxFlipPanel })),
)
const MHBandPanelLazy = lazy(() =>
  import('./components/IndicatorReadouts').then((m) => ({ default: m.MHBandPanel })),
)
const ScalpingPanel = lazy(() =>
  import('./components/ScalpingPanel').then((m) => ({ default: m.ScalpingPanel })),
)
const ReversalPanel = lazy(() =>
  import('./components/ReversalPanel').then((m) => ({ default: m.ReversalPanel })),
)
const WhalePanel = lazy(() =>
  import('./components/WhalePanel').then((m) => ({ default: m.WhalePanel })),
)
const FundingNwePanelLazy = lazy(() =>
  import('./components/FundingNwePanel').then((m) => ({ default: m.FundingNwePanel })),
)
const SessionsPanelLazy = lazy(() =>
  import('./components/SessionsPanel').then((m) => ({ default: m.SessionsPanel })),
)
const LiquidityPanelLazy = lazy(() =>
  import('./components/LiquidityPanel').then((m) => ({ default: m.LiquidityPanel })),
)
const OIPanelLazy = lazy(() => import('./components/OIPanel').then((m) => ({ default: m.OIPanel })))
const TechnicalsPanelLazy = lazy(() =>
  import('./components/TechnicalsPanel').then((m) => ({ default: m.TechnicalsPanel })),
)
const SignalPanelLazy = lazy(() =>
  import('./components/SignalPanel').then((m) => ({ default: m.SignalPanel })),
)
const FeatureWeightsPanelLazy = lazy(() =>
  import('./components/SignalPanel').then((m) => ({ default: m.FeatureWeightsPanel })),
)
const TradeSetupPanelLazy = lazy(() =>
  import('./components/TradeSetupPanel').then((m) => ({ default: m.TradeSetupPanel })),
)
import {
  usePositions,
  useTicker,
  useFunding,
  useFearGreed,
  useKlines,
  useOpenInterest,
  useSupply,
  useWhaleTracker,
} from './hooks'
import {
  CHART,
  LIMIT,
  NWE_DEFAULT_WINDOW,
  type Interval,
  SYMBOLS,
  loadSymbols,
  loadCustomSymbols,
  saveCustomSymbols,
  BYBIT_INTERVAL,
  MEXC_INTERVAL,
  OKX_INTERVAL,
  type Exchange,
  type SymbolId,
  type SymbolEntry,
  fmtP,
  fmtV,
  tsNow,
  calcMHBand,
  calcSMA,
  calcRSI,
  calcMACD,
  calcADX,
  calcStochRSI,
  calcOBV,
  calcVWAP,
  detectRSIDivergence,
  buildOrderFlow,
  smaNum,
  mlSignal,
  drawSMCOverlay,
  drawBoxFlipOverlay,
  drawICTOverlay,
  computeICT,
  type ICTResult,
  drawLiquidityOverlay,
  computeLiquidity,
  HTF_MAP,
  type LiquidityResult,
  calcTradeSetup,
  suggestSlTp,
  INITIAL_SIDEBAR,
  statsFromTicker,
  DEFAULT_STATS,
  DEFAULT_FUNDING,
  DEFAULT_FNG,
  computeBoucherScalping,
  computeLienReversal,
  detectCandlePatterns,
  DEFAULT_SIGNAL_CONFIG,
  type BoucherResult,
  type LienResult,
  type SignalConfig,
  type Candle,
  type ChartRefs,
  type SidebarState,
  type StatsState,
  type FundingState,
  type FngState,
  applyDefaultViewport,
} from './lib'

/* eslint-disable @typescript-eslint/no-explicit-any */

function BtcChartView() {
  // Boot configuration (vis flags + interval + alerts + sound + zoom).
  // Must be declared first — many refs below read initial values from it.
  const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

  const rootRef = useRef<HTMLDivElement>(null)
  const mainElRef = useRef<HTMLDivElement>(null)
  const vpCanvasRef = useRef<HTMLCanvasElement>(null)
  const ofCanvasRef = useRef<HTMLCanvasElement>(null)
  const smcCanvasRef = useRef<HTMLCanvasElement>(null)
  const boxCanvasRef = useRef<HTMLCanvasElement>(null)
  const ictCanvasRef = useRef<HTMLCanvasElement>(null)
  const ictDataRef = useRef<ICTResult>({
    sessions: [],
    judas: [],
    killzones: [],
    activeSession: null,
    adrPct: 0,
  })
  const liqCanvasRef = useRef<HTMLCanvasElement>(null)
  const liqDataRef = useRef<LiquidityResult>({
    range: null,
    levels: [],
    inverseFvgs: [],
    sweeps: [],
    nextTarget: null,
  })
  // Higher-timeframe candles for the liquidity trading range (Hack #1).
  const htfRef = useRef<Candle[] | null>(null)
  const smcDataRef = useRef<SMCResult>({ structures: [], orderBlocks: [], fvgs: [] })
  const boxFlipRef = useRef<BoxFlipResult>({ boxes: [], signals: [] })
  const ofOverlayRef = useRef<OFOverlaySignal[]>([])
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRefs = useRef<ChartRefs | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const hiLoLinesRef = useRef<{ high: any; low: any } | null>(null)
  const dbbSeriesRef = useRef<{
    upper2: any
    lower2: any
    upper1: any
    lower1: any
    sma: any
  } | null>(null)
  const markersRef = useRef<any>(null)
  // Volume-spike alert: only fire on a newly closed candle (not on UI
  // re-renders), and mirror the sound-enabled flag for use inside renderData.
  const lastCandleTimeRef = useRef<number>(0)
  const soundEnabledRef = useRef<boolean>(cfgInit.sound.enabled)
  // Advanced oscillator pane (ADX / StochRSI / OBV) — created on demand.
  const oscElRef = useRef<HTMLDivElement>(null)
  const oscRefs = useRef<{
    chart: any
    rsiS: any
    rsiOB: any
    rsiOS: any
    adxS: any
    plusDIS: any
    minusDIS: any
    adxRef: any
    stochKS: any
    stochDS: any
    stochOB: any
    stochOS: any
    obvS: any
    cleanup: () => void
  } | null>(null)

  const visRef = useRef<VisFlags>({ ...cfgInit.vis })
  // Interval/symbol mirrors so renderData (deps []) can read the active pair.
  const intervalRef = useRef<Interval>(cfgInit.interval as Interval)
  const symbolRef = useRef<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const vpOptsRef = useRef({ hvnRatio: 0.8 })
  const alertsRef = useRef<AlertRule[]>([...cfgInit.alerts])
  const soundRef = useRef<AlertSound>(new AlertSound())
  const lastPriceRef = useRef<number | null>(null)
  // Throttle: skip UI updates if interval not elapsed
  const lastPriceUpdateRef = useRef(0) // 1s throttle for price/PnL
  const lastChartUpdateRef = useRef(0) // 5s throttle for full chart render
  // Latest computed indicator snapshot — read from inside the WS handler.
  const sidebarRef = useRef<SidebarState>(INITIAL_SIDEBAR)

  // Simple memo for expensive WASM/JS computes (keyed by length + last bar time)
  const nweCacheKeyRef = useRef<string>('')
  const nweCacheRef = useRef<any>(null)
  const smcCacheKeyRef = useRef<string>('')
  const smcCacheRef = useRef<SMCResult | null>(null)

  const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
  const [symbol, setSymbol] = useState<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const [customSymbols, setCustomSymbols] = useState<SymbolEntry[]>(loadCustomSymbols)
  const [remoteSymbols, setRemoteSymbols] = useState<readonly SymbolEntry[]>(SYMBOLS)
  const allSymbols = useMemo<SymbolEntry[]>(
    () => [
      ...remoteSymbols,
      ...customSymbols.filter((c) => !remoteSymbols.some((s) => s.symbol === c.symbol)),
    ],
    [remoteSymbols, customSymbols],
  )
  const symbolInfo: SymbolEntry = useMemo(() => {
    return (
      allSymbols.find((s) => s.symbol === symbol) || {
        symbol,
        base: symbol.replace(/USDT$/, ''),
        quote: 'USDT',
        exchange: 'binance' as Exchange,
      }
    )
  }, [allSymbols, symbol])

  const symbolInfoRef = useRef(symbolInfo)
  const [vis, setVis] = useState<VisFlags>(() => ({ ...cfgInit.vis }))
  const [toolsOpen, setToolsOpen] = useState(false)
  const [intelTab, setIntelTab] = useState<IntelTab>('trade')
  const [intelSearch, setIntelSearch] = useState('')
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [oscOpen, setOscOpen] = useState<boolean>(cfgInit.oscOpen)
  const [oscView, setOscView] = useState<OscView>(cfgInit.oscView)
  const [oscHeight, setOscHeight] = useState<number>(cfgInit.oscHeight)
  const [spikeMult, setSpikeMult] = useState<number>(cfgInit.spikeMult)
  const spikeMultRef = useRef<number>(cfgInit.spikeMult)
  const oscViewRef = useRef<OscView>(cfgInit.oscView)
  const oscOpenRef = useRef<boolean>(cfgInit.oscOpen)

  // NWE (LuxAlgo) config - reactive + ref for renderData
  const [nweCfg, setNweCfg] = useState<NadarayaConfig>(
    () =>
      (cfgInit.luxNwe as NadarayaConfig) ?? {
        bandwidth: 8,
        multiplier: 3,
        repaint: false,
        maxBarsBack: NWE_DEFAULT_WINDOW,
      },
  )
  const nweCfgRef = useRef<NadarayaConfig>(nweCfg)

  const [alerts, setAlerts] = useState<AlertRule[]>(() => [...cfgInit.alerts])
  const [sound, setSound] = useState(cfgInit.sound)
  const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
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
  const [markPrice, setMarkPrice] = useState<number | null>(null)
  const [ohlcv, setOhlcv] = useState({ o: '—', h: '—', l: '—', c: '—', v: '—' })
  const [sidebar, setSidebar] = useState<SidebarState>(INITIAL_SIDEBAR)
  const [boucherScalp, setBoucherScalp] = useState<BoucherResult>({
    atr: 0,
    boxSize: 0,
    currentBox: null,
    boxes: [],
    ladder: [],
    threeBar: [],
    entries: [],
    envelope: 0,
    target: 0,
    speed: 'normal',
    stats: { signals: 0, wins: 0, rr: 0 },
  })
  const [lienReversal, setLienReversal] = useState<LienResult>({
    dbb: null,
    zone: 'neutral',
    prevZone: 'neutral',
    regime: 'range',
    squeeze: { active: false, bars: 0, breakout: null },
    reversals: [],
    latestSignal: null,
    exhaustion: false,
    bandTouch: null,
    adrSpent: 0,
  })
  const [signalConfig, setSignalConfig] = useState<SignalConfig>(
    () => (loadConfig().signalConfig as SignalConfig) ?? { ...DEFAULT_SIGNAL_CONFIG },
  )
  const signalConfigRef = useRef<SignalConfig>(signalConfig)
  const [panelCandles, setPanelCandles] = useState<Candle[]>([])
  const [lastCandleClose, setLastCandleClose] = useState<number | null>(null)
  const panelCandleKeyRef = useRef('')
  const [boucherEnabled, setBoucherEnabled] = useState(true)
  const [lienEnabled, setLienEnabled] = useState(true)
  const [luxNweResult, setLuxNweResult] = useState<{
    mid: (number | null)[]
    upper: (number | null)[]
    lower: (number | null)[]
    signals: Array<{ index: number; type: 'buy' | 'sell'; price: number }>
  }>({ mid: [], upper: [], lower: [], signals: [] })

  const [ictResult, setICTResult] = useState<ICTResult>({
    sessions: [],
    judas: [],
    killzones: [],
    activeSession: null,
    adrPct: 0,
  })
  const [liquidityResult, setLiquidityResult] = useState<LiquidityResult>({
    range: null,
    levels: [],
    inverseFvgs: [],
    sweeps: [],
    nextTarget: null,
  })

  // ── Polled market data via React Query (ticker 5s, funding 30s, F&G 60s) ──
  const tickerQuery = useTicker(symbol, symbolInfo)
  const fundingQuery = useFunding(symbol, symbolInfo)
  const fngQuery = useFearGreed()
  // Historical candles (one-shot per symbol/interval); WS handles live ticks.
  const klinesQuery = useKlines(symbol, interval, symbolInfo)
  // Higher-timeframe candles for the liquidity trading range (Hack #1). Keyed
  // separately in React Query, so it caches independently of the main frame.
  const htfInterval = HTF_MAP[interval as Interval]
  const htfQuery = useKlines(symbol, htfInterval ?? (interval as Interval), symbolInfo)
  const stats: StatsState = tickerQuery.data ? statsFromTicker(tickerQuery.data) : DEFAULT_STATS
  const funding: FundingState = fundingQuery.data ?? DEFAULT_FUNDING
  const fng: FngState = fngQuery.data ?? DEFAULT_FNG

  // OI + Market Cap
  const currentPrice = tickerQuery.data?.price ?? 0
  const oiQuery = useOpenInterest(symbol, currentPrice)
  const supplyQuery = useSupply(symbolInfo.geckoId)
  const mcap = supplyQuery.data != null ? supplyQuery.data * currentPrice : null

  // Whale tracker: detect large trades and exchange flow
  const whaleTracker = useWhaleTracker(symbol, {
    enabled: vis.whale,
    whaleThreshold: 100000, // $100k+ trades
    flowWindowMs: 3600000, // 1h window
    maxAlerts: 100,
  })

  // Load coin list from Turso (remote DB). Falls back to hardcoded SYMBOLS
  // if Turso env vars are not set or the request fails.
  useEffect(() => {
    loadSymbols().then((list) => setRemoteSymbols(list))
  }, [])

  // The ticker poll also seeds price/OHLCV, which the WebSocket then updates
  // live between polls.
  useEffect(() => {
    const t = tickerQuery.data
    if (!t) return
    setPrice({
      cur: fmtP(t.price),
      chg: (t.chg >= 0 ? '+' : '') + t.chg.toFixed(2) + '%',
      up: t.up,
    })
    setMarkPrice(t.price)
    setOhlcv((o) => ({
      ...o,
      o: fmtP(t.low),
      h: fmtP(t.high),
      l: fmtP(t.low),
      c: fmtP(t.price),
      v: fmtV(t.vol),
    }))
  }, [tickerQuery.data])

  // Spinner + status while the historical candles are loading.
  useEffect(() => {
    if (klinesQuery.isFetching) {
      setLoading(true)
      setLoadingText(`Tải dữ liệu ${symbolInfo.base}/${symbolInfo.quote} ${interval}…`)
    }
  }, [klinesQuery.isFetching, symbolInfo.base, symbolInfo.quote, interval])

  // Manual positions: list state, add/remove form, and chart price-line overlay.
  const {
    positions,
    showForm: showPosForm,
    setShowForm: setShowPosForm,
    form: posForm,
    setForm: setPosForm,
    addPosition,
    removePosition,
    updatePosition,
  } = usePositions(chartRefs, !loading, markPrice)

  // Compute suggested SL/TP for each open position (ATR + NWE bands).
  const posSuggestions = useMemo(() => {
    const candles = panelCandles
    if (!candles.length || !positions.length) return {}
    const nweData = calcMHBand(candles)
    const result: Record<string, { sl: number; tp1: number; tp2: number }> = {}
    for (const p of positions) {
      result[p.id] = suggestSlTp(p, candles, nweData)
    }
    return result
    // Re-compute when positions change or sidebar updates (new candle tick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, panelCandles, sidebar.rsiNow])

  useLayoutEffect(() => {
    symbolInfoRef.current = symbolInfo
    spikeMultRef.current = spikeMult
    oscViewRef.current = oscView
    oscOpenRef.current = oscOpen
    nweCfgRef.current = nweCfg
    signalConfigRef.current = signalConfig
  }, [symbolInfo, spikeMult, oscView, oscOpen, nweCfg, signalConfig])

  // Keep refs in sync with state for use inside imperative callbacks.
  useEffect(() => {
    visRef.current = vis
  }, [vis])
  useEffect(() => {
    intervalRef.current = interval
  }, [interval])
  useEffect(() => {
    symbolRef.current = symbol
  }, [symbol])

  // Reset chart state when the user switches pair or timeframe (not on first mount).
  const prevViewRef = useRef({ symbol, interval })
  useEffect(() => {
    const prev = prevViewRef.current
    const changed = prev.symbol !== symbol || prev.interval !== interval
    prevViewRef.current = { symbol, interval }
    if (!changed) return

    fitNextRef.current = true
    candlesRef.current = []
    panelCandleKeyRef.current = ''
    smcCacheKeyRef.current = ''
    smcCacheRef.current = null
    nweCacheKeyRef.current = ''
    nweCacheRef.current = null

    const refs = chartRefs.current
    if (refs?.candleSeries) {
      refs.candleSeries.setData([])
      refs.volSeries?.setData([])
    }

    const cfg = loadConfig()
    saveConfig({ ...cfg, zoom: null, symbol, interval })
  }, [symbol, interval])
  useEffect(() => {
    htfRef.current = htfQuery.data?.candles ?? null
  }, [htfQuery.data])
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    soundRef.current.setVolume(sound.volume)
  }, [sound.volume])
  useEffect(() => {
    soundEnabledRef.current = sound.enabled
  }, [sound.enabled])
  useEffect(() => {
    sidebarRef.current = sidebar
  }, [sidebar])

  // Persist on any config-affecting change.
  const persist = useCallback(
    (zoom: ChartConfig['zoom'] | undefined) => {
      saveConfig({
        version: 1,
        interval,
        symbol,
        vis,
        zoom: zoom === undefined ? loadConfig().zoom : zoom,
        alerts,
        sound,
        notifications: notifAllowed,
        minimal: false,
        oscOpen,
        oscView,
        oscHeight,
        spikeMult,
        signalConfig,
        luxNwe: nweCfg,
      })
    },
    [
      interval,
      symbol,
      vis,
      alerts,
      sound,
      notifAllowed,
      oscOpen,
      oscView,
      oscHeight,
      spikeMult,
      signalConfig,
      nweCfg,
    ],
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

    const panelKey = `${data.length}:${data[data.length - 1]?.time ?? 0}`
    if (panelKey !== panelCandleKeyRef.current) {
      panelCandleKeyRef.current = panelKey
      setPanelCandles(data)
      setLastCandleClose(data[data.length - 1]?.close ?? null)
    }

    // Initial render (after a fetch/symbol switch) should not fire alerts for
    // pre-existing candles; it only seeds the dedup state.
    const isInitial = fitNextRef.current

    const visFlags = visRef.current
    const nwe = calcMHBand(data)
    const sma50 = calcSMA(data, 50)
    const sma200 = calcSMA(data, 200)
    const rsi = calcRSI(data, 14)
    const macd = calcMACD(data)
    const adxR = calcADX(data, 14)
    const stoch = calcStochRSI(data)
    const obv = calcOBV(data)
    const vwapR = calcVWAP(data)
    const divs = detectRSIDivergence(data, rsi)
    const of_ = buildOrderFlow(data, nwe)
    const boxFlip = buildBoxFlipSignals(data, {
      minBoxBars: 10,
      maxBoxHeightPct: 0.012,
      breakoutConfirm: 'close',
      bufferPct: 0.0007,
    })
    // LuxAlgo Nadaraya-Watson Envelope (WASM-backed, JS fallback)
    // Guard: compute for vis.luxNwe OR TradeSetup (which relies on recent signals + upper/lower for SL/TP).
    // Memo + smaller window (default 250) when repaint to keep perf good.
    let luxNwe: any
    const currentNweCfg = nweCfgRef.current
    const nweKey = `${data.length}:${data[data.length - 1]?.time ?? 0}:${currentNweCfg.repaint}:${currentNweCfg.bandwidth}:${currentNweCfg.multiplier}:${currentNweCfg.maxBarsBack ?? NWE_DEFAULT_WINDOW}`
    if (nweKey === nweCacheKeyRef.current && nweCacheRef.current) {
      luxNwe = nweCacheRef.current
    } else {
      const t0 = performance.now()
      const win = Math.min(currentNweCfg.maxBarsBack ?? NWE_DEFAULT_WINDOW, data.length)
      // For repaint, use a sliced window to reduce compute cost (the function will limit anyway)
      const nweInput = currentNweCfg.repaint ? data.slice(-win) : data
      luxNwe = computeNadarayaWatson(nweInput, { ...currentNweCfg, maxBarsBack: win })
      // If we sliced, the result arrays are shorter. Align by padding front with nulls so indices match 'data'.
      if (currentNweCfg.repaint && nweInput.length < data.length) {
        const pad = data.length - nweInput.length
        luxNwe = {
          mid: [...Array(pad).fill(null), ...luxNwe.mid],
          upper: [...Array(pad).fill(null), ...luxNwe.upper],
          lower: [...Array(pad).fill(null), ...luxNwe.lower],
          signals: luxNwe.signals.map((s: any) => ({ ...s, index: s.index + pad })),
        }
      }
      const t1 = performance.now()
      // eslint-disable-next-line no-console
      console.log(
        `[perf] NWE ${currentNweCfg.repaint ? 'repaint' : 'non-repaint'} compute: ${(t1 - t0).toFixed(2)}ms (win=${win}, n=${data.length})`,
      )
      nweCacheKeyRef.current = nweKey
      nweCacheRef.current = luxNwe
    }
    // ICT sessions + Judas swing (intraday only; empty on 4h/1d)
    const ict = computeICT(data, intervalRef.current)
    ictDataRef.current = ict
    setICTResult(ict)
    const ml = mlSignal(
      data,
      nwe,
      sma50,
      sma200,
      rsi,
      macd,
      {
        adx: adxR,
        stoch,
        obv,
        vwap: vwapR.vwap,
        divs,
      },
      signalConfigRef.current,
    )

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
    const markers: any[] = []
    if (visFlags.boxFlip) {
      for (const sig of boxFlip.signals) {
        markers.push({
          time: sig.time,
          position: sig.dir === 'B' ? 'belowBar' : 'aboveBar',
          color: sig.dir === 'B' ? '#22c55e' : '#f97316',
          shape: sig.dir === 'B' ? 'arrowUp' : 'arrowDown',
          text: sig.dir,
        })
      }
    }
    if (visFlags.rsiDiv) {
      for (const d of divs) {
        markers.push({
          time: d.time,
          position: d.type === 'bull' ? 'belowBar' : 'aboveBar',
          color: d.type === 'bull' ? '#6fbcf0' : '#c792ea',
          shape: d.type === 'bull' ? 'arrowUp' : 'arrowDown',
          text: d.type === 'bull' ? 'Div+' : 'Div-',
        })
      }
    }
    // Boucher 3-bar reversal markers
    const bScalp = computeBoucherScalping(data)
    if (visFlags.scalping) {
      for (const sig of bScalp.threeBar) {
        markers.push({
          time: sig.time,
          position: sig.dir === 'long' ? 'belowBar' : 'aboveBar',
          color: sig.dir === 'long' ? '#80ffd5' : '#ffc46b',
          shape: sig.dir === 'long' ? 'arrowUp' : 'arrowDown',
          text: sig.dir === 'long' ? '3B+' : '3B-',
        })
      }
    }
    // Kathy Lien reversal markers
    const lienR = computeLienReversal(data)
    if (visFlags.reversal) {
      for (const rev of lienR.reversals) {
        markers.push({
          time: rev.time,
          position: rev.type === 'bullish' ? 'belowBar' : 'aboveBar',
          color: rev.type === 'bullish' ? '#6fbcf0' : '#c792ea',
          shape: rev.type === 'bullish' ? 'arrowUp' : 'arrowDown',
          text: rev.type === 'bullish' ? 'REV+' : 'REV-',
        })
      }
      // Candlestick pattern markers (Harami Cross, etc.)
      for (const pat of detectCandlePatterns(data)) {
        markers.push({
          time: pat.time,
          position: pat.type === 'bullish' ? 'belowBar' : 'aboveBar',
          color: pat.type === 'bullish' ? '#34d399' : '#fb7185',
          shape: pat.type === 'bullish' ? 'circle' : 'circle',
          text: pat.name,
        })
      }
    }
    // LuxAlgo NWE crossover markers
    if (visFlags.luxNwe) {
      for (const sig of luxNwe.signals) {
        markers.push({
          time: data[sig.index].time,
          position: sig.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: sig.type === 'buy' ? '#26A69A' : '#EF5350',
          shape: sig.type === 'buy' ? 'arrowUp' : 'arrowDown',
          text: sig.type === 'buy' ? '▲' : '▼',
        })
      }
    }
    // lightweight-charts requires markers sorted ascending by time.
    markers.sort((a, b) => a.time - b.time)
    if (markersRef.current) {
      markersRef.current.setMarkers(markers)
    } else {
      const LWC = window.LightweightCharts
      if (LWC?.createSeriesMarkers) {
        markersRef.current = LWC.createSeriesMarkers(refs.candleSeries, markers)
      }
    }
    boxFlipRef.current = boxFlip
    if (boxCanvasRef.current && mainElRef.current && refs.candleSeries) {
      drawBoxFlipOverlay(
        boxCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        data,
        boxFlip,
        visFlags.boxFlip,
      )
    }
    ofOverlayRef.current = of_.overlay
    if (ofCanvasRef.current && mainElRef.current && refs.candleSeries) {
      drawOrderFlow(
        ofCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        visFlags.of ? of_.overlay : [],
        true,
      )
    }

    refs.nweMidS.setData(visFlags.nwe ? toLine(nwe.mid) : [])
    refs.nweUpS.setData(visFlags.nwe ? toLine(nwe.upper) : [])
    refs.nweLowS.setData(visFlags.nwe ? toLine(nwe.lower) : [])

    // LuxAlgo Nadaraya-Watson Envelope
    refs.luxNweMidS.setData(visFlags.luxNwe ? toLine(luxNwe.mid) : [])
    refs.luxNweUpS.setData(visFlags.luxNwe ? toLine(luxNwe.upper) : [])
    refs.luxNweLoS.setData(visFlags.luxNwe ? toLine(luxNwe.lower) : [])

    // Update NWE result for FundingNwePanel
    setLuxNweResult(luxNwe)

    refs.ma50S.setData(visFlags.ma50 ? toLine(sma50) : [])
    refs.ma200S.setData(visFlags.ma200 ? toLine(sma200) : [])
    refs.vwapS.setData(visFlags.vwap ? toLine(vwapR.vwap) : [])
    refs.vwapUpS.setData(visFlags.vwap ? toLine(vwapR.upper) : [])
    refs.vwapLoS.setData(visFlags.vwap ? toLine(vwapR.lower) : [])

    // Double Bollinger Bands (Kathy Lien)
    if (dbbSeriesRef.current) {
      const dbbS = dbbSeriesRef.current
      if (visFlags.dbb && data.length >= 20) {
        const period = 20
        const smaArr: { time: number; value: number }[] = []
        const u2: typeof smaArr = [],
          l2: typeof smaArr = [],
          u1: typeof smaArr = [],
          l1: typeof smaArr = []
        for (let idx = period - 1; idx < data.length; idx++) {
          let sum = 0
          for (let j = idx - period + 1; j <= idx; j++) sum += data[j].close
          const sm = sum / period
          let vr = 0
          for (let j = idx - period + 1; j <= idx; j++) vr += (data[j].close - sm) ** 2
          const sd = Math.sqrt(vr / period)
          const t = data[idx].time
          smaArr.push({ time: t, value: sm })
          u2.push({ time: t, value: sm + 2 * sd })
          l2.push({ time: t, value: sm - 2 * sd })
          u1.push({ time: t, value: sm + sd })
          l1.push({ time: t, value: sm - sd })
        }
        dbbS.sma.setData(smaArr)
        dbbS.upper2.setData(u2)
        dbbS.lower2.setData(l2)
        dbbS.upper1.setData(u1)
        dbbS.lower1.setData(l1)
      } else {
        dbbS.sma.setData([])
        dbbS.upper2.setData([])
        dbbS.lower2.setData([])
        dbbS.upper1.setData([])
        dbbS.lower1.setData([])
      }
    }

    // Volume bars, with large-volume spikes highlighted (vol > spikeMult x
    // its 20-bar average). Spikes are colored bright amber so unusual
    // activity stands out on any timeframe (e.g. an H4 volume burst).
    const SPIKE_MULT = spikeMultRef.current
    const volArrAll = data.map((c) => c.volume)
    const volSmaAll = smaNum(volArrAll, 20)
    refs.volSeries.setData(
      visFlags.vol
        ? data.map((c, idx) => {
            const avg = volSmaAll[idx]
            const isSpike =
              visFlags.volSpike && avg != null && c.volume > (avg as number) * SPIKE_MULT
            const isBuy = c.close >= c.open
            return {
              time: c.time,
              value: c.volume,
              color: isSpike
                ? isBuy
                  ? '#34ffc8'
                  : '#ff5c6a'
                : isBuy
                  ? CHART.upSoft
                  : CHART.dnSoft,
            }
          })
        : [],
    )

    // ── Advanced oscillator pane (only the selected view holds data) ──
    const osc = oscRefs.current
    if (osc) {
      const view = oscViewRef.current
      const empty: { time: number; value: number }[] = []
      osc.rsiS.setData(view === 'rsi' ? toLine(rsi) : empty)
      osc.rsiOB.setData(view === 'rsi' ? data.map((c) => ({ time: c.time, value: 70 })) : empty)
      osc.rsiOS.setData(view === 'rsi' ? data.map((c) => ({ time: c.time, value: 30 })) : empty)
      osc.adxS.setData(view === 'adx' ? toLine(adxR.adx) : empty)
      osc.plusDIS.setData(view === 'adx' ? toLine(adxR.plusDI) : empty)
      osc.minusDIS.setData(view === 'adx' ? toLine(adxR.minusDI) : empty)
      osc.adxRef.setData(view === 'adx' ? data.map((c) => ({ time: c.time, value: 25 })) : empty)
      osc.stochKS.setData(view === 'stoch' ? toLine(stoch.k) : empty)
      osc.stochDS.setData(view === 'stoch' ? toLine(stoch.d) : empty)
      osc.stochOB.setData(view === 'stoch' ? data.map((c) => ({ time: c.time, value: 80 })) : empty)
      osc.stochOS.setData(view === 'stoch' ? data.map((c) => ({ time: c.time, value: 20 })) : empty)
      osc.obvS.setData(
        view === 'obv' ? data.map((c, i) => ({ time: c.time, value: obv[i] })) : empty,
      )
    }

    // Mark the latest candle if it is a volume spike, so it is visible even
    // without reading the volume bars, and raise an alert (sound + browser
    // notification + toast) once, only when a fresh candle closes as a spike.
    const lastIdx = data.length - 1
    const lastTime = data[lastIdx].time
    const isNewCandle = !isInitial && lastTime > lastCandleTimeRef.current
    // On initial load reset the marker; on live updates track the max seen.
    lastCandleTimeRef.current = isInitial ? lastTime : Math.max(lastCandleTimeRef.current, lastTime)
    const lastSpike =
      visFlags.volSpike &&
      volSmaAll[lastIdx] != null &&
      data[lastIdx].volume > (volSmaAll[lastIdx] as number) * SPIKE_MULT
    if (lastSpike) {
      markers.push({
        time: lastTime,
        position: 'aboveBar',
        color: '#ffd166',
        shape: 'circle',
        text: 'VOL',
      })
      markers.sort((a, b) => a.time - b.time)
      if (markersRef.current) markersRef.current.setMarkers(markers)

      if (!isInitial && isNewCandle) {
        const ratio = (data[lastIdx].volume / (volSmaAll[lastIdx] as number)).toFixed(1)
        const msg = `Volume spike ${ratio}x trung bình 20 nến`
        if (soundEnabledRef.current) soundRef.current.play()
        pushNotification('BTC Chart — Volume Spike', msg)
        setFiredToast(msg)
      }
    }

    if (fitNextRef.current) {
      const cfg = loadConfig()
      const canRestoreZoom =
        cfg.zoom != null && cfg.symbol === symbolRef.current && cfg.interval === intervalRef.current
      const range = canRestoreZoom
        ? cfg.zoom!
        : applyDefaultViewport(refs.mainChart.timeScale(), data.length)
      if (canRestoreZoom) {
        refs.mainChart.timeScale().setVisibleLogicalRange(range)
      }
      const oscChart = oscRefs.current?.chart
      if (oscChart) {
        oscChart.timeScale().setVisibleLogicalRange(range)
      }
      fitNextRef.current = false
    }

    if (vpCanvasRef.current && mainElRef.current) {
      const info = drawVP(vpCanvasRef.current, mainElRef.current, data.slice(-LIMIT), visFlags.vp, {
        ...vpOptsRef.current,
        heatmap: visFlags.heatmap,
      })
      setSidebar((s) => ({
        ...s,
        vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
        vpHvn: info.hvnCount,
      }))
    }

    // ── SMC overlay + trade setup confluence (always computed, cached) ──
    let smcResult: SMCResult
    const smcKey = `${data.length}:${data[data.length - 1]?.time ?? 0}`
    if (smcKey === smcCacheKeyRef.current && smcCacheRef.current) {
      smcResult = smcCacheRef.current
    } else {
      const t0 = performance.now()
      smcResult = computeSMC(data, {
        structure: true,
        orderBlocks: true,
        fvg: true,
        swingLen: 10,
        internalLen: 5,
      })
      const t1 = performance.now()
      // eslint-disable-next-line no-console
      console.log(`[perf] SMC compute: ${(t1 - t0).toFixed(2)}ms (n=${data.length})`)
      smcCacheKeyRef.current = smcKey
      smcCacheRef.current = smcResult
    }
    smcDataRef.current = smcResult
    if (smcCanvasRef.current && mainElRef.current && refs.mainChart) {
      drawSMCOverlay(
        smcCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        smcResult,
        visFlags.smc,
      )
    }

    // ── ICT sessions + Judas overlay ──
    if (ictCanvasRef.current && mainElRef.current && refs.mainChart) {
      drawICTOverlay(
        ictCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        ict,
        data,
        visFlags.ict,
      )
    }

    // ── ICT Liquidity: trading range, external/internal, sweeps, draw ──
    const liq = computeLiquidity(data, htfRef.current, smcResult, intervalRef.current)
    liqDataRef.current = liq
    setLiquidityResult(liq)
    if (liqCanvasRef.current && mainElRef.current && refs.mainChart) {
      drawLiquidityOverlay(
        liqCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        liq,
        data,
        visFlags.liquidity,
      )
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
        visFlags.vwap && vwapR.vwap[i] != null
          ? `<span style="color:#c792ea">VWAP ${fmtP(vwapR.vwap[i] as number)}</span>`
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
      const sell =
        prev.high > (nwe.upper[i - 1] as number) && prev.close > prev.open && c.close < c.open
      const buy =
        prev.low < (nwe.lower[i - 1] as number) && prev.close < prev.open && c.close > c.open
      if (buy) sigNwe = { text: '▲ Buy Rebound', cls: 'up' }
      else if (sell) sigNwe = { text: '▼ Sell Rebound', cls: 'dn' }
    }

    // ADX / DMI trend strength + direction
    const adxV = adxR.adx[i],
      pdi = adxR.plusDI[i],
      mdi = adxR.minusDI[i]
    let sigAdx = { text: '—', cls: '' }
    if (adxV != null && pdi != null && mdi != null) {
      const strong = adxV >= 25
      const dir = pdi > mdi ? 'up' : 'dn'
      const regime = adxV < 20 ? 'Sideway' : strong ? 'Strong' : 'Weak'
      sigAdx = {
        text: `${adxV.toFixed(0)} · ${regime} ${pdi > mdi ? '▲+DI' : '▼-DI'}`,
        cls: adxV < 20 ? '' : dir,
      }
    }

    // Stochastic RSI %K
    const sk = stoch.k[i]
    const sigStoch =
      sk != null
        ? {
            text: `${sk.toFixed(0)}${sk < 20 ? ' (OS)' : sk > 80 ? ' (OB)' : ''}`,
            cls: sk < 20 ? 'up' : sk > 80 ? 'dn' : '',
          }
        : { text: '—', cls: '' }

    // OBV slope (last 10 bars)
    let sigObv = { text: '—', cls: '' }
    if (i >= 10) {
      const slope = obv[i] - obv[i - 10]
      sigObv = {
        text: slope > 0 ? '▲ Accumulation' : slope < 0 ? '▼ Distribution' : 'Flat',
        cls: slope > 0 ? 'up' : slope < 0 ? 'dn' : '',
      }
    }

    // VWAP position
    const vwapNow = vwapR.vwap[i]
    const sigVwap =
      vwapNow != null
        ? c.close > vwapNow
          ? { text: '▲ Above VWAP', cls: 'up' }
          : { text: '▼ Below VWAP', cls: 'dn' }
        : { text: '—', cls: '' }

    // Latest RSI divergence within recent bars
    const recentDiv = divs.filter((d) => d.time >= data[Math.max(0, i - 6)].time)
    const lastDiv = recentDiv[recentDiv.length - 1]
    const sigDiv = lastDiv
      ? lastDiv.type === 'bull'
        ? { text: '▲ Bullish Div', cls: 'up' }
        : { text: '▼ Bearish Div', cls: 'dn' }
      : { text: '—', cls: '' }

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
      sigAdx,
      sigStoch,
      sigObv,
      sigVwap,
      sigDiv,
      ml,
      ofLog: of_.log,
      boxFlip: {
        count: boxFlip.signals.length,
        last: boxFlip.signals[boxFlip.signals.length - 1]?.dir ?? null,
      },
      rsiNow: rsi[i] ?? null,
      adxNow: adxR.adx[i] ?? null,
      stochKNow: stoch.k[i] ?? null,
      obvNow: obv[i] ?? null,
      nweUp: nwe.upper[i] ?? null,
      nweLo: nwe.lower[i] ?? null,
      tradeSetup: calcTradeSetup(data, nwe, rsi, adxR, ml, {
        boucher: bScalp,
        lien: lienR,
        luxNwe,
        ict,
        liquidity: liq,
        smc: smcResult,
      }),
    }))

    // ── Boucher M1 Scalping ──
    setBoucherScalp(bScalp)

    // ── Kathy Lien Reversal ──
    setLienReversal(lienR)
  }, [])

  // ── Setup charts (once) ───────────────────────────────────────────
  useEffect(() => {
    const LWC = window.LightweightCharts
    if (!LWC) {
      setLoadingText('Lỗi: lightweight-charts chưa được tải.')
      return
    }
    if (!mainElRef.current || !mainElRef.current.parentElement) return

    const col = mainElRef.current.parentElement

    // Use measured pane height from the CSS flex layout. ResizeObserver below
    // keeps it in sync after first paint, so the initial value can come
    // straight from clientHeight (or a safe fallback if layout is not ready).
    const initMain = mainElRef.current.clientHeight || 360

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

    // Main pane carries the time axis only when the oscillator pane is closed;
    // when open, the oscillator pane (bottom) shows it instead.
    const mainChart = LWC.createChart(mainElRef.current, {
      ...base,
      width: mainElRef.current.clientWidth,
      height: initMain,
      timeScale: { ...base.timeScale, visible: !oscOpenRef.current },
    })

    const candleSeries = mainChart.addSeries(LWC.CandlestickSeries, {
      upColor: CHART.up,
      downColor: CHART.dn,
      borderUpColor: CHART.up,
      borderDownColor: CHART.dn,
      wickUpColor: CHART.up,
      wickDownColor: CHART.dn,
    })

    const nweUpS = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(255,122,133,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH+',
    })
    const nweMidS = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(111,188,240,0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH',
    })
    const nweLowS = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(52,216,164,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH-',
    })
    const luxNweMidS = mainChart.addSeries(LWC.LineSeries, {
      color: '#FFD54F',
      lineWidth: 2,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'LuxNWE',
    })
    const luxNweUpS = mainChart.addSeries(LWC.LineSeries, {
      color: '#26A69A',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'LuxUp',
    })
    const luxNweLoS = mainChart.addSeries(LWC.LineSeries, {
      color: '#EF5350',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'LuxLo',
    })
    const ma50S = mainChart.addSeries(LWC.LineSeries, {
      color: CHART.ma50,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA50',
    })
    const ma200S = mainChart.addSeries(LWC.LineSeries, {
      color: CHART.hi,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA200',
    })

    // VWAP (anchored) + std-dev bands
    const vwapS = mainChart.addSeries(LWC.LineSeries, {
      color: '#c792ea',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'VWAP',
    })
    const vwapUpS = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const vwapLoS = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    // Double Bollinger Bands (Kathy Lien)
    const dbbSma = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(199,146,234,0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const dbbUpper2 = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(255,122,133,0.35)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const dbbLower2 = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(52,216,164,0.35)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const dbbUpper1 = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(255,122,133,0.2)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const dbbLower1 = mainChart.addSeries(LWC.LineSeries, {
      color: 'rgba(52,216,164,0.2)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    dbbSeriesRef.current = {
      upper2: dbbUpper2,
      lower2: dbbLower2,
      upper1: dbbUpper1,
      lower1: dbbLower1,
      sma: dbbSma,
    }

    // Volume is overlaid on the bottom of the main price pane (own scale).
    const volSeries = mainChart.addSeries(LWC.HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    mainChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    // Reserve the bottom 20% of the price scale for volume so candles and
    // volume bars don't overlap.
    mainChart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.2 },
    })

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
        )
      }
      if (smcCanvasRef.current && mainElRef.current) {
        drawSMCOverlay(
          smcCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          smcDataRef.current,
          visRef.current.smc,
        )
      }
      if (ictCanvasRef.current && mainElRef.current) {
        drawICTOverlay(
          ictCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          ictDataRef.current,
          candlesRef.current,
          visRef.current.ict,
        )
      }
      if (liqCanvasRef.current && mainElRef.current) {
        drawLiquidityOverlay(
          liqCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          liqDataRef.current,
          candlesRef.current,
          visRef.current.liquidity,
        )
      }
      if (boxCanvasRef.current && mainElRef.current) {
        drawBoxFlipOverlay(
          boxCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          candlesRef.current,
          boxFlipRef.current,
          visRef.current.boxFlip,
        )
      }
      // Update visible high/low price lines
      const cands = candlesRef.current
      if (cands.length) {
        const from = Math.max(0, Math.floor(r.from))
        const to = Math.min(cands.length - 1, Math.ceil(r.to))
        let hi = -Infinity,
          lo = Infinity
        for (let i = from; i <= to; i++) {
          if (cands[i].high > hi) hi = cands[i].high
          if (cands[i].low < lo) lo = cands[i].low
        }
        if (hiLoLinesRef.current) {
          try {
            candleSeries.removePriceLine(hiLoLinesRef.current.high)
            candleSeries.removePriceLine(hiLoLinesRef.current.low)
          } catch {
            /* noop */
          }
        }
        hiLoLinesRef.current = {
          high: candleSeries.createPriceLine({
            price: hi,
            color: 'rgba(52,216,164,0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `H ${fmtP(hi)}`,
          }),
          low: candleSeries.createPriceLine({
            price: lo,
            color: 'rgba(255,122,133,0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `L ${fmtP(lo)}`,
          }),
        }
      }
    })

    mainChart.subscribeCrosshairMove((param: any) => {
      if (!param?.time) return
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

    // Observe the main pane element so the chart sees real measured heights.
    const syncSize = () => {
      if (!mainElRef.current) return
      const mw = mainElRef.current.clientWidth
      const mh2 = mainElRef.current.clientHeight
      if (mh2 <= 0) return
      mainChart.applyOptions({ width: mw, height: mh2 })
      // Keep the oscillator pane width in step with the main pane.
      if (oscRefs.current && oscElRef.current && oscElRef.current.clientHeight > 0) {
        oscRefs.current.chart.applyOptions({
          width: oscElRef.current.clientWidth,
          height: oscElRef.current.clientHeight,
        })
      }
      if (candlesRef.current.length && vpCanvasRef.current) {
        const info = drawVP(
          vpCanvasRef.current,
          mainElRef.current,
          candlesRef.current.slice(-LIMIT),
          visRef.current.vp,
          {
            ...vpOptsRef.current,
            heatmap: visRef.current.heatmap,
          },
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
        )
      }
      if (boxCanvasRef.current) {
        drawBoxFlipOverlay(
          boxCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          candlesRef.current,
          boxFlipRef.current,
          visRef.current.boxFlip,
        )
      }
      if (smcCanvasRef.current) {
        drawSMCOverlay(
          smcCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          smcDataRef.current,
          visRef.current.smc,
        )
      }
      if (ictCanvasRef.current) {
        drawICTOverlay(
          ictCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          ictDataRef.current,
          candlesRef.current,
          visRef.current.ict,
        )
      }
      if (liqCanvasRef.current) {
        drawLiquidityOverlay(
          liqCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          liqDataRef.current,
          candlesRef.current,
          visRef.current.liquidity,
        )
      }
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(col)
    ro.observe(mainElRef.current)
    // First sync after layout settles
    requestAnimationFrame(syncSize)

    chartRefs.current = {
      mainChart,
      candleSeries,
      nweMidS,
      nweUpS,
      nweLowS,
      luxNweMidS,
      luxNweUpS,
      luxNweLoS,
      ma50S,
      ma200S,
      volSeries,
      vwapS,
      vwapUpS,
      vwapLoS,
      cleanup: () => {
        ro.disconnect()
        try {
          mainChart.remove()
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

  // ── Advanced oscillator pane (ADX / StochRSI / OBV) ────────────────
  // Created only while open to keep the base chart light. Time scale is
  // kept in sync with the main chart in both directions.
  useEffect(() => {
    if (!oscOpen) return
    const LWC = window.LightweightCharts
    const mainChart = chartRefs.current?.mainChart
    if (!LWC || !oscElRef.current || !mainChart) return

    const el = oscElRef.current
    const chart = LWC.createChart(el, {
      layout: {
        background: { type: 'solid', color: CHART.bg },
        textColor: CHART.axis,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART.grid },
        horzLines: { color: CHART.grid },
      },
      crosshair: { mode: LWC.CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: CHART.border, timeVisible: true, secondsVisible: false },
      width: el.clientWidth || 600,
      height: el.clientHeight || 150,
    })

    const lineOpts = (color: string, width = 1.5, dashed = false) => ({
      color,
      lineWidth: width,
      lineStyle: dashed ? 2 : 0,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    const adxRef = chart.addSeries(LWC.LineSeries, lineOpts('rgba(255,255,255,0.18)', 1, true))
    const adxS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#ffc46b', 2), title: 'ADX' })
    const plusDIS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#34d8a4', 1.5), title: '+DI' })
    const minusDIS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#ff7a85', 1.5), title: '-DI' })
    const stochOB = chart.addSeries(LWC.LineSeries, lineOpts('rgba(255,122,133,0.3)', 1, true))
    const stochOS = chart.addSeries(LWC.LineSeries, lineOpts('rgba(52,216,164,0.3)', 1, true))
    const stochKS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#6fbcf0', 2), title: '%K' })
    const stochDS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#ffc46b', 1.5), title: '%D' })
    const obvS = chart.addSeries(LWC.LineSeries, { ...lineOpts('#80ffd5', 2), title: 'OBV' })
    const rsiOB = chart.addSeries(LWC.LineSeries, lineOpts('rgba(255,122,133,0.3)', 1, true))
    const rsiOS = chart.addSeries(LWC.LineSeries, lineOpts('rgba(52,216,164,0.3)', 1, true))
    const rsiS = chart.addSeries(LWC.LineSeries, { ...lineOpts(CHART.neu, 2), title: 'RSI' })

    // Main pane gives up its time axis to the oscillator pane while open.
    mainChart.applyOptions({ timeScale: { visible: false } })

    const syncFrom = mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (r) chart.timeScale().setVisibleLogicalRange(r)
    })
    chart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (r) mainChart.timeScale().setVisibleLogicalRange(r)
    })
    // Match current main-chart view immediately.
    const cur = mainChart.timeScale().getVisibleLogicalRange()
    if (cur) chart.timeScale().setVisibleLogicalRange(cur)

    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0)
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    oscRefs.current = {
      chart,
      rsiS,
      rsiOB,
      rsiOS,
      adxS,
      plusDIS,
      minusDIS,
      adxRef,
      stochKS,
      stochDS,
      stochOB,
      stochOS,
      obvS,
      cleanup: () => {
        ro.disconnect()
        try {
          mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncFrom)
        } catch {
          /* noop */
        }
        try {
          chart.remove()
        } catch {
          /* noop */
        }
        // Restore the main pane's own time axis when the pane closes.
        try {
          chartRefs.current?.mainChart.applyOptions({ timeScale: { visible: true } })
        } catch {
          /* noop */
        }
      },
    }

    requestAnimationFrame(() => {
      if (el.clientHeight > 0)
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
      if (candlesRef.current.length) renderData(candlesRef.current)
    })

    return () => {
      oscRefs.current?.cleanup()
      oscRefs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oscOpen])

  // Re-render oscillator series when switching which one is shown.
  useEffect(() => {
    if (oscOpen && oscRefs.current && candlesRef.current.length) {
      queueMicrotask(() => renderData(candlesRef.current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oscView])

  // ── Wire klines + WebSocket once the query resolves ────────────────
  // Historical candles come from React Query (useKlines); the live socket
  // stays imperative. Re-runs when fresh data/error arrives or symbol/interval
  // changes, reconnecting the socket accordingly.
  useEffect(() => {
    const data = klinesQuery.data
    const err = klinesQuery.error
    if (!data && !err) return

    let cancelled = false

    const closeWs = () => {
      const ws = wsRef.current
      if (!ws) return
      wsRef.current = null
      // Detach handlers so late/queued events don't fire after teardown.
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.CONNECTING) {
        // Closing a socket mid-handshake logs a "closed before established"
        // warning — defer the close until it opens instead.
        ws.onopen = () => {
          try {
            ws.close()
          } catch {
            /* noop */
          }
        }
      } else {
        try {
          ws.close()
        } catch {
          /* noop */
        }
      }
    }

    /** Throttled price/PnL update (1s) */
    const throttledPriceUpdate = (close: number) => {
      const now = Date.now()
      if (now - lastPriceUpdateRef.current < 1000) return
      lastPriceUpdateRef.current = now
      setPrice((p) => ({ ...p, cur: fmtP(close) }))
      setMarkPrice(close)
      setOhlcv((o) => ({ ...o, c: fmtP(close) }))
      setLastUpdate(tsNow())
    }

    /** Throttled chart render (5s) */
    const throttledRender = (data: Candle[]) => {
      const now = Date.now()
      if (now - lastChartUpdateRef.current < 5000) return
      lastChartUpdateRef.current = now
      renderData(data)
    }

    const connectWs = (spotMode = false) => {
      let ws: WebSocket
      const info = symbolInfoRef.current
      if (info.exchange === 'mexc') {
        const msym = 'mexcSymbol' in info ? info.mexcSymbol : symbol
        ws = new WebSocket('wss://contract.mexc.com/edge')
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              method: 'sub.kline',
              param: { symbol: msym, interval: MEXC_INTERVAL[interval] },
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          if (msg.channel !== 'push.kline') return
          const k = msg.data
          if (!k) return
          const candle: Candle = {
            time: Math.floor(Number(k.t) / 1000),
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
          throttledPriceUpdate(candle.close)
          if (k.end) throttledRender(arr)
        }
      } else if (info.exchange === 'bybit') {
        const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
        ws = new WebSocket(`wss://stream.bybit.com/v5/public/${cat}`)
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              op: 'subscribe',
              args: [`kline.${BYBIT_INTERVAL[interval]}.${symbol}`],
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          const k = msg.data?.[0]
          if (!k) return
          const candle: Candle = {
            time: Math.floor(Number(k.start) / 1000),
            open: +k.open,
            high: +k.high,
            low: +k.low,
            close: +k.close,
            volume: +k.volume,
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
          throttledPriceUpdate(candle.close)
          if (k.confirm) throttledRender(arr)
        }
      } else if (info.exchange === 'okx') {
        const instId = 'okxInstId' in info ? info.okxInstId : symbol
        ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/business')
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              op: 'subscribe',
              args: [{ channel: 'candle' + OKX_INTERVAL[interval], instId }],
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          if (!msg.data?.[0]) return
          const k = msg.data[0]
          const candle: Candle = {
            time: Math.floor(Number(k[0]) / 1000),
            open: +k[1],
            high: +k[2],
            low: +k[3],
            close: +k[4],
            volume: +k[5],
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
          throttledPriceUpdate(candle.close)
          if (k[8] === '1') throttledRender(arr)
        }
      } else {
        const wsUrl = spotMode
          ? `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
          : `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`
        ws = new WebSocket(wsUrl)
        ws.onerror = () => {
          // If futures WS fails, retry with spot
          if (!spotMode && !cancelled) {
            wsRef.current = null
            const spotWs = new WebSocket(
              `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
            )
            spotWs.onopen = ws.onopen
            spotWs.onmessage = ws.onmessage
            spotWs.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
            spotWs.onclose = () => {
              if (!cancelled) setWsStatus({ text: 'Closed', tone: 'muted' })
            }
            wsRef.current = spotWs
            return
          }
          setWsStatus({ text: 'Error', tone: 'err' })
        }
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
          throttledPriceUpdate(candle.close)
          // ── Alerts ─────────────────────────────────────────────────
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
            if (sound.enabled) soundRef.current.play()
            for (const f of fired)
              pushNotification('BTC Chart Alert', `${describeRule(f.rule)} — ${f.message}`)
            setFiredToast(fired.map((f) => describeRule(f.rule)).join(' · '))
            setAlerts([...alertsRef.current])
          }
          if (k.x) throttledRender(arr)
        }
      }
      if (!ws.onerror) ws.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
      ws.onclose = () => {
        if (!cancelled) setWsStatus({ text: 'Closed', tone: 'muted' })
      }
      wsRef.current = ws
    }

    if (data) {
      if (data.symbol !== symbol || data.interval !== interval) return

      candlesRef.current = data.candles
      // Adjust price precision based on price level
      if (chartRefs.current?.candleSeries && data.candles.length) {
        const lastClose = data.candles[data.candles.length - 1].close
        const precision = lastClose < 0.01 ? 6 : lastClose < 1 ? 5 : lastClose < 100 ? 4 : 2
        const minMove = Math.pow(10, -precision)
        const pf = { type: 'price', precision, minMove }
        chartRefs.current.candleSeries.applyOptions({ priceFormat: pf })
        chartRefs.current.nweMidS.applyOptions({ priceFormat: pf })
        chartRefs.current.nweUpS.applyOptions({ priceFormat: pf })
        chartRefs.current.nweLowS.applyOptions({ priceFormat: pf })
        chartRefs.current.ma50S.applyOptions({ priceFormat: pf })
        chartRefs.current.ma200S.applyOptions({ priceFormat: pf })
        chartRefs.current.mainChart.priceScale('right').applyOptions({ autoScale: true })
      }
      fitNextRef.current = true
      renderData(data.candles)
      connectWs(data.usedSpot)
      setLoading(false)
    } else if (err) {
      console.error(err)
      // Mock fallback (offline / blocked) — render demo data, no socket.
      const step =
        { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[interval] || 3600
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
      fitNextRef.current = true
      renderData(cands)
      setWsStatus({ text: 'Demo data (offline)', tone: 'err' })
      setLoading(false)
    }

    return () => {
      cancelled = true
      closeWs()
    }
  }, [klinesQuery.data, klinesQuery.error, interval, symbol, renderData])

  // ── Toggles ─────────────────────────────────────────────────────────
  const toggle = useCallback(
    (key: keyof VisFlags) => {
      setVis((prev) => {
        const next = { ...prev, [key]: !prev[key] }
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

  const applyPreset = useCallback(
    (preset: LayerPresetId) => {
      setVis((prev) => {
        const next = applyLayerPreset(prev, preset)
        visRef.current = next
        if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
        return next
      })
    },
    [renderData],
  )

  const updateSignalConfig = useCallback(
    (cfg: SignalConfig) => {
      setSignalConfig(cfg)
      signalConfigRef.current = cfg
      if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
    },
    [renderData],
  )

  const updateNweConfig = useCallback(
    (patch: Partial<NadarayaConfig>) => {
      setNweCfg((prev) => {
        const next = {
          ...prev,
          ...patch,
          maxBarsBack: patch.maxBarsBack ?? prev.maxBarsBack ?? NWE_DEFAULT_WINDOW,
        }
        nweCfgRef.current = next
        // Invalidate memo so next render recomputes with new params
        nweCacheKeyRef.current = ''
        if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
        return next
      })
    },
    [renderData],
  )

  const toggleOscOpen = useCallback(() => {
    setOscOpen((o) => !o)
  }, [])

  // ── Oscillator pane resize (drag the top edge) ──────────────────────
  const startOscResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const startH = oscHeight
      const onMove = (ev: PointerEvent) => {
        // Drag up => taller pane.
        const next = Math.max(90, Math.min(480, startH + (startY - ev.clientY)))
        setOscHeight(next)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [oscHeight],
  )

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
  const requestNotif = useCallback(async () => {
    const result = await ensureNotificationPermission()
    setNotifAllowed(result === 'granted')
  }, [])

  // ── Snapshot ────────────────────────────────────────────────────────
  const snapshot = useCallback(() => {
    const refs = chartRefs.current
    if (!refs || !mainElRef.current) return
    const osc = oscRefs.current
    downloadChartSnapshot({
      main: { chart: refs.mainChart, height: mainElRef.current.clientHeight },
      rsi:
        osc && oscOpenRef.current && oscElRef.current
          ? { chart: osc.chart, height: oscElRef.current.clientHeight }
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
      symbol,
      vis,
      zoom: loadConfig().zoom,
      alerts,
      sound,
      notifications: notifAllowed,
      minimal: false,
      oscOpen,
      oscView,
      oscHeight,
      spikeMult,
    })
  }, [
    interval,
    symbol,
    vis,
    alerts,
    sound,
    notifAllowed,
    oscOpen,
    oscView,
    oscHeight,
    spikeMult,
    nweCfg,
  ])

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
        setOscOpen(cfg.oscOpen)
        setOscView(cfg.oscView)
        setOscHeight(cfg.oscHeight)
        setSpikeMult(cfg.spikeMult)
        spikeMultRef.current = cfg.spikeMult
        if (cfg.luxNwe) {
          setNweCfg(cfg.luxNwe as NadarayaConfig)
          nweCfgRef.current = cfg.luxNwe as NadarayaConfig
        }
        cfg.minimal = cfg.minimal ?? false
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

  // ── Header handlers ─────────────────────────────────────────────────
  const persistConfigField = (patch: Record<string, unknown>) => {
    try {
      const saved = JSON.parse(localStorage.getItem('btc-chart:config:v1') || '{}')
      localStorage.setItem('btc-chart:config:v1', JSON.stringify({ ...saved, ...patch }))
    } catch {
      /* noop */
    }
  }

  const selectSymbol = (next: SymbolId) => {
    if (next === symbol) return
    const entry = allSymbols.find((s) => s.symbol === next)
    const label = entry ? `${entry.base}/${entry.quote}` : next.replace(/USDT$/, '/USDT')
    setLoading(true)
    setLoadingText(`Tải dữ liệu ${label} ${interval}…`)
    setSymbol(next)
    persistConfigField({ symbol: next })
  }

  const selectInterval = (iv: Interval) => {
    setInterval_(iv)
    persistConfigField({ interval: iv })
  }

  // Validate an entered coin against Binance (spot or futures) before adding.
  const addCustomSymbol = async (raw: string) => {
    const cleaned = raw.trim().toUpperCase()
    if (!cleaned) return
    const sym = cleaned.endsWith('USDT') ? cleaned : cleaned + 'USDT'
    const base = sym.replace(/USDT$/, '')
    if (!allSymbols.find((s) => s.symbol === sym)) {
      try {
        const [spot, fut] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=1`).then(
            (r) => r.ok,
          ),
          fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&limit=1`)
            .then((r) => r.ok)
            .catch(() => false),
        ])
        if (!spot && !fut) {
          setFiredToast(`${base} không có trên Binance`)
          return
        }
      } catch {
        setFiredToast(`Không thể kiểm tra ${base} trên Binance`)
        return
      }
      const entry: SymbolEntry = { symbol: sym, base, quote: 'USDT', exchange: 'binance' }
      const next = [...customSymbols, entry]
      setCustomSymbols(next)
      saveCustomSymbols(next)
    }
    setSymbol(sym)
    persistConfigField({ symbol: sym })
  }

  return (
    <div className={`btc-chart btc-chart--stitch${loading ? '' : ' is-ready'}`} ref={rootRef}>
      <ChartLoadingOverlay loading={loading} text={loadingText} />
      <ChartToasts
        alertMessage={firedToast}
        onDismissAlert={() => setFiredToast(null)}
        errorMessage={importErr}
        onDismissError={() => setImportErr(null)}
      />
      <div className="btc-chart__chrome">
        <ChartHeader
          symbolInfo={symbolInfo}
          symbol={symbol}
          symbols={allSymbols}
          interval={interval}
          price={price}
          ohlcv={ohlcv}
          activeLayerCount={ALL_IND_KEYS.filter((k) => vis[k]).length}
          toolsOpen={toolsOpen}
          sidebarOpen={sidebarMobileOpen}
          onToggleTools={() => setToolsOpen((o) => !o)}
          onToggleSidebar={() => setSidebarMobileOpen((o) => !o)}
          onSelectSymbol={selectSymbol}
          onSelectInterval={selectInterval}
          onAddCustomSymbol={addCustomSymbol}
        />
      </div>

      {/* Body */}
      <div className="btc-chart__body">
        <div className="btc-chart__col">
          <ChartToolbarPanel
            open={toolsOpen}
            vis={vis}
            nweCfg={nweCfg}
            onToggle={toggle}
            onUpdateNweConfig={updateNweConfig}
            onClose={() => setToolsOpen(false)}
            soundEnabled={sound.enabled}
            onToggleSound={toggleSound}
            notifAllowed={notifAllowed}
            onRequestNotif={requestNotif}
            onSnapshot={snapshot}
            onExport={exportNow}
            onImport={importNow}
            onApplyPreset={applyPreset}
          />
          <div className="btc-chart__chart-stage">
            <div className="btc-chart__legend-dock">
              <div className="btc-chart__legend" ref={legendRef} />
            </div>
            <ChartLayerDots vis={vis} onToggle={toggle} onOpenTools={() => setToolsOpen(true)} />
            <canvas className="btc-chart__of-canvas" ref={ofCanvasRef} />
            <canvas className="btc-chart__ict-canvas" ref={ictCanvasRef} />
            <canvas className="btc-chart__liq-canvas" ref={liqCanvasRef} />
            <canvas className="btc-chart__smc-canvas" ref={smcCanvasRef} />
            <canvas className="btc-chart__box-canvas" ref={boxCanvasRef} />
            <div className="btc-chart__main" ref={mainElRef} />
            <canvas className="btc-chart__vp-canvas" ref={vpCanvasRef} />
          </div>
          <OscillatorPane
            open={oscOpen}
            height={oscHeight}
            view={oscView}
            readouts={{
              rsi: sidebar.rsiNow,
              adx: sidebar.adxNow,
              stochK: sidebar.stochKNow,
              obv: sidebar.obvNow,
            }}
            oscElRef={oscElRef}
            onToggleOpen={toggleOscOpen}
            onViewChange={setOscView}
            onResizeStart={startOscResize}
          />
        </div>

        {/* Sidebar */}
        <div className={`btc-chart__sidebar${sidebarMobileOpen ? ' is-mobile-open' : ''}`}>
          <RailSection label="Signals">
            <Suspense fallback={<div className="sb-empty">Loading signal…</div>}>
              <SignalPanelLazy
                ml={sidebar.ml}
                setup={sidebar.tradeSetup}
                signalConfig={signalConfig}
                onSignalConfigChange={updateSignalConfig}
              />
            </Suspense>
            <Suspense fallback={<div className="sb-empty">Loading setup…</div>}>
              <TradeSetupPanelLazy
                setup={sidebar.tradeSetup}
                positions={positions}
                showPosForm={showPosForm}
                setShowPosForm={setShowPosForm}
                posForm={posForm}
                setPosForm={setPosForm}
                onAddPosition={addPosition}
                onRemovePosition={removePosition}
                onUpdatePosition={updatePosition}
                markPrice={markPrice}
                posSuggestions={posSuggestions}
              />
            </Suspense>
            <Suspense fallback={<div className="sb-empty">Loading funding…</div>}>
              <FundingNwePanelLazy
                funding={funding}
                nwe={luxNweResult}
                candles={panelCandles}
                symbol={symbol}
              />
            </Suspense>
          </RailSection>

          <RailSection label="Context">
            <Suspense fallback={<div className="sb-empty">Loading sessions…</div>}>
              <SessionsPanelLazy ict={ictResult} />
            </Suspense>
            <Suspense fallback={<div className="sb-empty">Loading liquidity…</div>}>
              <LiquidityPanelLazy liquidity={liquidityResult} />
            </Suspense>
          </RailSection>

          <RailSection label="Strategies">
            <Suspense fallback={<div className="sb-empty">Loading scalping…</div>}>
              <ScalpingPanel
                scalp={boucherScalp}
                interval={interval}
                enabled={boucherEnabled}
                onToggle={() => setBoucherEnabled((v) => !v)}
              />
            </Suspense>
            <Suspense fallback={<div className="sb-empty">Loading reversal…</div>}>
              <ReversalPanel
                lien={lienReversal}
                enabled={lienEnabled}
                onToggle={() => setLienEnabled((v) => !v)}
              />
            </Suspense>
          </RailSection>

          <IntelRail
            tab={intelTab}
            onTabChange={setIntelTab}
            search={intelSearch}
            onSearchChange={setIntelSearch}
            mobileOpen={sidebarMobileOpen}
            onMobileClose={() => setSidebarMobileOpen(false)}
            panels={{
              trade: (
                <p className="sb-empty sb-empty--hint">
                  Vị thế quản lý tại icon <span className="sb-empty__mono">briefcase</span> trên
                  block Trade Setup.
                </p>
              ),
              market: (
                <>
                  <SidebarAccordion filterQuery={intelSearch} title="Open Interest">
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <OIPanelLazy
                        oi={oiQuery.data?.totalUsd ?? null}
                        mcap={mcap}
                        breakdown={oiQuery.data?.breakdown}
                        history={oiQuery.data?.history}
                        deltaPct={oiQuery.data?.deltaPct}
                      />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="Whale Tracker"
                    onToggle={(open) => {
                      if (open && !vis.whale) toggle('whale')
                    }}
                  >
                    <Suspense
                      fallback={
                        <div className="p-2 text-xs text-[var(--muted)]">Loading whale...</div>
                      }
                    >
                      <WhalePanel
                        whaleAlerts={whaleTracker.whaleAlerts}
                        exchangeFlow={whaleTracker.exchangeFlow}
                        whaleStats={whaleTracker.whaleStats}
                        recentBuyVolume={whaleTracker.recentBuyVolume}
                        recentSellVolume={whaleTracker.recentSellVolume}
                        onClear={whaleTracker.clearAlerts}
                      />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion filterQuery={intelSearch} title="24h Stats">
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <StatsPanel stats={stats} />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion filterQuery={intelSearch} title="Fear & Greed">
                    <Suspense fallback={<div className="sb-empty">Loading…</div>}>
                      <FearGreedPanel fng={fng} />
                    </Suspense>
                  </SidebarAccordion>
                </>
              ),
              flow: (
                <>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="Order Flow"
                    onToggle={(open) => {
                      if (open && !vis.of) toggle('of')
                    }}
                  >
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <OrderFlowPanel ofLog={sidebar.ofLog} />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="Box Flip"
                    onToggle={(open) => {
                      if (open && !vis.boxFlip) toggle('boxFlip')
                    }}
                  >
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <BoxFlipPanelLazy boxFlip={sidebar.boxFlip} />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="Volume Spike"
                    onToggle={(open) => {
                      if (open && !vis.volSpike) toggle('volSpike')
                    }}
                  >
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <VolumeSpikePanel
                        enabled={vis.volSpike}
                        onToggle={() => toggle('volSpike')}
                        spikeMult={spikeMult}
                        onChange={(val) => {
                          setSpikeMult(val)
                          spikeMultRef.current = val
                          if (candlesRef.current.length)
                            queueMicrotask(() => renderData(candlesRef.current))
                        }}
                      />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="Volume Profile"
                    onToggle={(open) => {
                      if (open && !vis.vp) toggle('vp')
                    }}
                  >
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <VolumeProfilePanel vp={sidebar.vp} vpHvn={sidebar.vpHvn} />
                    </Suspense>
                  </SidebarAccordion>
                </>
              ),
              alerts: (
                <>
                  <SidebarAccordion filterQuery={intelSearch} title="Alerts">
                    <AlertsPanel
                      alerts={alerts}
                      onAdd={addAlert}
                      onRemove={removeAlert}
                      onToggle={toggleAlert}
                      onReset={resetAlert}
                      currentPrice={lastCandleClose}
                      currentRsi={sidebar.rsiNow}
                    />
                  </SidebarAccordion>
                </>
              ),
              ml: (
                <>
                  <SidebarAccordion
                    filterQuery={intelSearch}
                    title="MH Band"
                    onToggle={(open) => {
                      if (open && !vis.nwe) toggle('nwe')
                    }}
                  >
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <MHBandPanelLazy sidebar={sidebar} />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion filterQuery={intelSearch} title="Technicals">
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <TechnicalsPanelLazy sidebar={sidebar} />
                    </Suspense>
                  </SidebarAccordion>
                  <SidebarAccordion filterQuery={intelSearch} title="Feature Weights">
                    <Suspense
                      fallback={<div className="p-2 text-xs text-[var(--muted)]">Loading...</div>}
                    >
                      <FeatureWeightsPanelLazy ml={sidebar.ml} />
                    </Suspense>
                  </SidebarAccordion>
                </>
              ),
            }}
          />
        </div>
      </div>
      <ChartStatusBar
        wsText={wsStatus.text}
        wsTone={wsStatus.tone}
        lastUpdate={lastUpdate}
        ofCount={sidebar.ofLog.length}
        boxCount={sidebar.boxFlip.count}
        vis={vis}
      />
    </div>
  )
}

// ── Plugin export ──────────────────────────────────────────────────────────

// Plugin-owned query client: the plugin is loaded as a separate chunk, so it
// provides its own React Query context rather than relying on the host.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
})

function BtcChartRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <BtcChartView />
    </QueryClientProvider>
  )
}

const BtcChartPlugin: Plugin = {
  name: 'BtcChart',
  version: '1.0.0',
  styleUrls: ['/plugins/btc-chart/style.css'],

  init(host: HostAPI) {
    host.registerComponent('BtcChart', BtcChartRoot)
    host.log('BtcChart plugin initialized')
  },

  mount() {
    initSmcWasm()
    console.log('[BtcChart] mounted')
  },

  unmount() {
    console.log('[BtcChart] unmounted')
  },
}

export default BtcChartPlugin
