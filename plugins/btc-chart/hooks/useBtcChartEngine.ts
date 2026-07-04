// BTC Chart — chart engine: refs, render pipeline, init effects, WS wiring.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoxFlipResult } from '../box-flip'
import type { OFOverlaySignal } from '../order-flow-overlay'
import type { SMCResult } from '../smc-wasm'
import { loadConfig, saveConfig, type VisFlags, type NadarayaConfig } from '../storage'

import { downloadChartSnapshot } from '../snapshot'
import { applyLayerPreset, type LayerPresetId } from '../lib/layer-presets'
import { visOverlayTurnedOn } from '../lib/overlay-vis-keys'
import { createMainChart } from '../lib/chart-main-setup'
import { createOscChart } from '../lib/chart-osc-setup'
import { closeKlinesWebSocket, wireKlinesWebSocket } from '../lib/chart-websocket'
import type { ChartRenderContext, LuxNweResult } from '../lib/chart-render-context'
import {
  bumpRenderGeneration,
  scheduleChartRender,
  type ScheduleChartRenderOptions,
} from '../lib/chart-render-scheduler'
import { NWE_DEFAULT_WINDOW } from '../lib/constants'
import { EMPTY_SIGNAL_NOTIFY_STATE, resetSignalNotifyState } from '../lib/signal-notify'
import { INITIAL_SIDEBAR } from '../lib/types'
import type { BoucherResult } from '../lib/boucher-scalping'
import type { Interval } from '../lib/constants'
import type { ICTResult } from '../lib/ict-sessions'
import type { LienResult } from '../lib/lien-reversal'
import type { LiquidityResult } from '../lib/liquidity'
import type { SupplyDemandResult } from '../lib/supply-demand'
import type { SignalConfig } from '../lib/signal-config'
import type { SymbolEntry, SymbolId } from '../lib/symbols'
import type { Candle, ChartRefs, OhlcvState, SidebarState } from '../lib/types'
import type { UseBtcChartConfig } from './useBtcChartConfig'

export interface UseBtcChartEngineParams {
  config: Pick<
    UseBtcChartConfig,
    | 'vis'
    | 'setVis'
    | 'visRef'
    | 'interval'
    | 'symbol'
    | 'intervalRef'
    | 'symbolRef'
    | 'nweCfg'
    | 'setNweCfg'
    | 'nweCfgRef'
    | 'signalConfig'
    | 'setSignalConfig'
    | 'signalConfigRef'
    | 'signalNotifyRef'
    | 'notifAllowedRef'
    | 'oscOpen'
    | 'setOscOpen'
    | 'oscView'
    | 'oscViewRef'
    | 'oscOpenRef'
    | 'oscHeight'
    | 'setOscHeight'
    | 'spikeMultRef'
    | 'alertsRef'
    | 'soundRef'
    | 'soundEnabledRef'
    | 'sound'
    | 'setAlerts'
  >
  symbolInfoRef: React.MutableRefObject<SymbolEntry>
  klinesQuery: {
    data?: { symbol: SymbolId; interval: Interval; candles: Candle[]; usedSpot?: boolean }
    error: unknown
    isFetching: boolean
  }
  setFiredToast: React.Dispatch<React.SetStateAction<string | null>>
  htfRef: React.MutableRefObject<Candle[] | null>
}

export interface UseBtcChartEngine {
  rootRef: React.RefObject<HTMLDivElement | null>
  mainElRef: React.RefObject<HTMLDivElement | null>
  vpCanvasRef: React.RefObject<HTMLCanvasElement | null>
  ofCanvasRef: React.RefObject<HTMLCanvasElement | null>
  smcCanvasRef: React.RefObject<HTMLCanvasElement | null>
  boxCanvasRef: React.RefObject<HTMLCanvasElement | null>
  ictCanvasRef: React.RefObject<HTMLCanvasElement | null>
  liqCanvasRef: React.RefObject<HTMLCanvasElement | null>
  setupCanvasRef: React.RefObject<HTMLCanvasElement | null>
  legendRef: React.RefObject<HTMLDivElement | null>
  oscElRef: React.RefObject<HTMLDivElement | null>
  chartRefs: React.MutableRefObject<ChartRefs | null>
  candlesRef: React.MutableRefObject<Candle[]>
  loading: boolean
  loadingText: string
  wsStatus: { text: string; tone: 'muted' | 'live' | 'err' }
  lastUpdate: string
  price: { cur: string; chg: string; up: boolean }
  markPrice: number | null
  ohlcv: OhlcvState
  sidebar: SidebarState
  boucherScalp: BoucherResult
  lienReversal: LienResult
  panelCandles: Candle[]
  lastCandleClose: number | null
  luxNweResult: LuxNweResult
  ictResult: ICTResult
  liquidityResult: LiquidityResult
  renderData: (data: Candle[], options?: ScheduleChartRenderOptions) => void
  toggle: (key: keyof VisFlags) => void
  applyPreset: (preset: LayerPresetId) => void
  updateSignalConfig: (cfg: SignalConfig) => void
  updateNweConfig: (patch: Partial<NadarayaConfig>) => void
  toggleOscOpen: () => void
  startOscResize: (e: React.PointerEvent) => void
  snapshot: () => void
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setLoadingText: React.Dispatch<React.SetStateAction<string>>
  setPrice: React.Dispatch<React.SetStateAction<{ cur: string; chg: string; up: boolean }>>
  setMarkPrice: React.Dispatch<React.SetStateAction<number | null>>
  setOhlcv: React.Dispatch<React.SetStateAction<OhlcvState>>
  setLastUpdate: React.Dispatch<React.SetStateAction<string>>
  htfRef: React.MutableRefObject<Candle[] | null>
}

/** Owns chart refs, render pipeline, init effects, and live data wiring. */
export function useBtcChartEngine(params: UseBtcChartEngineParams): UseBtcChartEngine {
  const { config, symbolInfoRef, klinesQuery, setFiredToast, htfRef } = params

  const rootRef = useRef<HTMLDivElement>(null)
  const mainElRef = useRef<HTMLDivElement>(null)
  const vpCanvasRef = useRef<HTMLCanvasElement>(null)
  const ofCanvasRef = useRef<HTMLCanvasElement>(null)
  const smcCanvasRef = useRef<HTMLCanvasElement>(null)
  const boxCanvasRef = useRef<HTMLCanvasElement>(null)
  const ictCanvasRef = useRef<HTMLCanvasElement>(null)
  const liqCanvasRef = useRef<HTMLCanvasElement>(null)
  const setupCanvasRef = useRef<HTMLCanvasElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const oscElRef = useRef<HTMLDivElement>(null)

  const ictDataRef = useRef<ICTResult>({
    sessions: [],
    judas: [],
    killzones: [],
    activeSession: null,
    adrPct: 0,
  })
  const liqDataRef = useRef<LiquidityResult>({
    range: null,
    levels: [],
    inverseFvgs: [],
    sweeps: [],
    nextTarget: null,
  })
  const smcDataRef = useRef<SMCResult>({ structures: [], orderBlocks: [], fvgs: [] })
  const sdDataRef = useRef<SupplyDemandResult>({
    zones: [],
    grabs: [],
    nearestDemand: null,
    nearestSupply: null,
    htfInterval: null,
    nearestHtfDemand: null,
    nearestHtfSupply: null,
    mtfLong: null,
    mtfShort: null,
    longEntry: null,
    longSl: null,
    shortEntry: null,
    shortSl: null,
  })
  const boxFlipRef = useRef<BoxFlipResult>({ boxes: [], signals: [] })
  const tradeSetupRef = useRef(INITIAL_SIDEBAR.tradeSetup)
  const tradeSetupLockRef = useRef({ plan: null, lockedBarTime: 0, lockedAtMs: 0 })
  const ofOverlayRef = useRef<OFOverlaySignal[]>([])
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
  const lastCandleTimeRef = useRef<number>(0)
  const oscRefs = useRef<ChartRenderContext['oscRefs']['current']>(null)
  const vpOptsRef = useRef({ hvnRatio: 0.8 })
  const lastPriceRef = useRef<number | null>(null)
  const lastPriceUpdateRef = useRef(0)
  const lastChartUpdateRef = useRef(0)
  const sidebarRef = useRef<SidebarState>(INITIAL_SIDEBAR)
  const nweCacheKeyRef = useRef<string>('')
  const nweCacheRef = useRef<LuxNweResult | null>(null)
  const smcCacheKeyRef = useRef<string>('')
  const smcCacheRef = useRef<SMCResult | null>(null)
  const heavyBarKeyRef = useRef('')
  const lastHeavyComputeMsRef = useRef(0)
  const sidebarKeyRef = useRef('')
  const boucherCacheRef = useRef<BoucherResult | null>(null)
  const lienCacheRef = useRef<LienResult | null>(null)
  const fitNextRef = useRef(true)
  const panelCandleKeyRef = useRef('')
  const renderGenRef = useRef(0)
  const nwePendingKeyRef = useRef('')
  const renderGenerationRef = useRef({ current: 0 })
  const signalNotifyStateRef = useRef({ ...EMPTY_SIGNAL_NOTIFY_STATE })

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
  const [panelCandles, setPanelCandles] = useState<Candle[]>([])
  const [lastCandleClose, setLastCandleClose] = useState<number | null>(null)
  const [luxNweResult, setLuxNweResult] = useState<LuxNweResult>({
    mid: [],
    upper: [],
    lower: [],
    signals: [],
  })
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

  useEffect(() => {
    sidebarRef.current = sidebar
  }, [sidebar])

  const renderCtx = useRef<ChartRenderContext>({
    mainElRef,
    vpCanvasRef,
    ofCanvasRef,
    smcCanvasRef,
    boxCanvasRef,
    ictCanvasRef,
    liqCanvasRef,
    setupCanvasRef,
    legendRef,
    chartRefs,
    markersRef,
    dbbSeriesRef,
    ictDataRef,
    liqDataRef,
    htfRef,
    smcDataRef,
    sdDataRef,
    boxFlipRef,
    tradeSetupRef,
    tradeSetupLockRef,
    ofOverlayRef,
    oscRefs,
    fitNextRef,
    panelCandleKeyRef,
    lastCandleTimeRef,
    soundEnabledRef: config.soundEnabledRef,
    soundRef: config.soundRef,
    visRef: config.visRef,
    intervalRef: config.intervalRef,
    symbolRef: config.symbolRef,
    spikeMultRef: config.spikeMultRef,
    oscViewRef: config.oscViewRef,
    oscOpenRef: config.oscOpenRef,
    nweCfgRef: config.nweCfgRef,
    signalConfigRef: config.signalConfigRef,
    signalNotifyRef: config.signalNotifyRef,
    notifAllowedRef: config.notifAllowedRef,
    signalNotifyStateRef,
    vpOptsRef,
    nweCacheKeyRef,
    nweCacheRef,
    smcCacheKeyRef,
    smcCacheRef,
    heavyBarKeyRef,
    lastHeavyComputeMsRef,
    sidebarKeyRef,
    boucherCacheRef,
    lienCacheRef,
    setPanelCandles,
    setLastCandleClose,
    setICTResult,
    setLuxNweResult,
    setLiquidityResult,
    setSidebar,
    setBoucherScalp,
    setLienReversal,
    setFiredToast,
    renderGenRef,
    nwePendingKeyRef,
  })

  const renderData = useCallback((data: Candle[], options?: ScheduleChartRenderOptions) => {
    scheduleChartRender(renderCtx.current, data, renderGenerationRef.current, options)
  }, [])

  const prevViewRef = useRef({ symbol: config.symbol, interval: config.interval })
  useEffect(() => {
    const prev = prevViewRef.current
    const changed = prev.symbol !== config.symbol || prev.interval !== config.interval
    prevViewRef.current = { symbol: config.symbol, interval: config.interval }
    if (!changed) return

    bumpRenderGeneration(renderGenerationRef.current)
    renderGenRef.current = renderGenerationRef.current.current
    nwePendingKeyRef.current = ''
    resetSignalNotifyState(signalNotifyStateRef.current)
    fitNextRef.current = true
    panelCandleKeyRef.current = ''
    smcCacheKeyRef.current = ''
    smcCacheRef.current = null
    heavyBarKeyRef.current = ''
    lastHeavyComputeMsRef.current = 0
    sidebarKeyRef.current = ''
    tradeSetupLockRef.current = { plan: null, lockedBarTime: 0, lockedAtMs: 0 }
    boucherCacheRef.current = null
    lienCacheRef.current = null
    nweCacheKeyRef.current = ''
    nweCacheRef.current = null

    const cfg = loadConfig()
    saveConfig({ ...cfg, zoom: null, symbol: config.symbol, interval: config.interval })
  }, [config.symbol, config.interval])

  useEffect(() => {
    if (klinesQuery.isFetching) {
      setLoading(true)
      setLoadingText(
        `Tải dữ liệu ${symbolInfoRef.current.base}/${symbolInfoRef.current.quote} ${config.interval}…`,
      )
    }
  }, [klinesQuery.isFetching, config.interval, symbolInfoRef])

  useEffect(() => {
    const cleanup = createMainChart({
      mainElRef,
      vpCanvasRef,
      ofCanvasRef,
      smcCanvasRef,
      boxCanvasRef,
      ictCanvasRef,
      liqCanvasRef,
      setupCanvasRef,
      chartRefs,
      dbbSeriesRef,
      hiLoLinesRef,
      candlesRef,
      visRef: config.visRef,
      vpOptsRef,
      ofOverlayRef,
      smcDataRef,
      sdDataRef,
      ictDataRef,
      liqDataRef,
      boxFlipRef,
      tradeSetupRef,
      oscOpenRef: config.oscOpenRef,
      oscRefs,
      oscElRef,
      setSidebar,
      setOhlcv,
      ohlcvVolume: ohlcv.v,
    })
    if (!cleanup && !window.LightweightCharts) {
      setLoadingText('Lỗi: lightweight-charts chưa được tải.')
    }
    return cleanup ?? undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-doctor/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!config.oscOpen) return
    const cleanup = createOscChart({
      oscElRef,
      chartRefs,
      oscRefs,
      candlesRef,
      onReady: () => {
        if (candlesRef.current.length) renderData(candlesRef.current)
      },
    })
    return cleanup ?? undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-doctor/exhaustive-deps
  }, [config.oscOpen])

  useEffect(() => {
    if (config.oscOpen && oscRefs.current && candlesRef.current.length) {
      queueMicrotask(() => renderData(candlesRef.current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-doctor/exhaustive-deps
  }, [config.oscView])

  useEffect(() => {
    let cancelled = false
    const handled = wireKlinesWebSocket({
      data: klinesQuery.data,
      error: klinesQuery.error,
      symbol: config.symbol,
      interval: config.interval,
      cancelled: () => cancelled,
      wsRef,
      candlesRef,
      chartRefs,
      fitNextRef,
      lastPriceUpdateRef,
      lastChartUpdateRef,
      lastPriceRef,
      symbolInfoRef,
      alertsRef: config.alertsRef,
      sidebarRef,
      soundRef: config.soundRef,
      soundEnabledRef: config.soundEnabledRef,
      renderData,
      setPrice,
      setMarkPrice,
      setOhlcv,
      setLastUpdate,
      setWsStatus,
      setLoading,
      setFiredToast,
      setAlerts: config.setAlerts,
    })
    if (!handled) return
    return () => {
      cancelled = true
      closeKlinesWebSocket(wsRef)
    }
  }, [klinesQuery.data, klinesQuery.error, config.interval, config.symbol, renderData])

  const toggle = useCallback(
    (key: keyof VisFlags) => {
      config.setVis((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        config.visRef.current = next
        if (candlesRef.current.length) {
          const sync = visOverlayTurnedOn(prev, next)
          queueMicrotask(() =>
            renderData(candlesRef.current, sync ? { deferHeavy: false } : undefined),
          )
        }
        return next
      })
    },
    [config, renderData],
  )

  const applyPreset = useCallback(
    (preset: LayerPresetId) => {
      config.setVis((prev) => {
        const next = applyLayerPreset(prev, preset)
        config.visRef.current = next
        if (candlesRef.current.length) {
          queueMicrotask(() => renderData(candlesRef.current, { deferHeavy: false }))
        }
        return next
      })
    },
    [config, renderData],
  )

  const updateSignalConfig = useCallback(
    (cfg: SignalConfig) => {
      config.setSignalConfig(cfg)
      config.signalConfigRef.current = cfg
      if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
    },
    [config, renderData],
  )

  const updateNweConfig = useCallback(
    (patch: Partial<NadarayaConfig>) => {
      config.setNweCfg((prev) => {
        const next = {
          ...prev,
          ...patch,
          maxBarsBack: patch.maxBarsBack ?? prev.maxBarsBack ?? NWE_DEFAULT_WINDOW,
        }
        config.nweCfgRef.current = next
        nweCacheKeyRef.current = ''
        if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
        return next
      })
    },
    [config, renderData],
  )

  const toggleOscOpen = useCallback(() => {
    config.setOscOpen((o) => !o)
  }, [config])

  const startOscResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const startH = config.oscHeight
      const onMove = (ev: PointerEvent) => {
        const next = Math.max(90, Math.min(480, startH + (startY - ev.clientY)))
        config.setOscHeight(next)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [config.oscHeight, config.setOscHeight],
  )

  const snapshot = useCallback(() => {
    const refs = chartRefs.current
    if (!refs || !mainElRef.current) return
    const osc = oscRefs.current
    downloadChartSnapshot({
      main: { chart: refs.mainChart, height: mainElRef.current.clientHeight },
      rsi:
        osc && config.oscOpenRef.current && oscElRef.current
          ? { chart: osc.chart, height: oscElRef.current.clientHeight }
          : null,
      vpOverlay: config.visRef.current.vp ? vpCanvasRef.current : null,
      ofOverlay: config.visRef.current.of ? ofCanvasRef.current : null,
    })
  }, [config])

  return {
    rootRef,
    mainElRef,
    vpCanvasRef,
    ofCanvasRef,
    smcCanvasRef,
    boxCanvasRef,
    ictCanvasRef,
    liqCanvasRef,
    setupCanvasRef,
    legendRef,
    oscElRef,
    chartRefs,
    candlesRef,
    htfRef,
    loading,
    loadingText,
    wsStatus,
    lastUpdate,
    price,
    markPrice,
    ohlcv,
    sidebar,
    boucherScalp,
    lienReversal,
    panelCandles,
    lastCandleClose,
    luxNweResult,
    ictResult,
    liquidityResult,
    renderData,
    toggle,
    applyPreset,
    updateSignalConfig,
    updateNweConfig,
    toggleOscOpen,
    startOscResize,
    snapshot,
    setLoading,
    setLoadingText,
    setPrice,
    setMarkPrice,
    setOhlcv,
    setLastUpdate,
  }
}
