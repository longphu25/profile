// BTC Chart Plugin — Pro view: Midnight Hunter band + Volume Profile + signals + ML
// Adapted from btc-chart-pro-v3.html for the profile plugin host (Shadow DOM scoped)
//
// External dependency: `lightweight-charts` global, loaded via CDN <script> tag
// in the host HTML page. The plugin reads window.LightweightCharts at mount time.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './style.css'
import {
  loadConfig,
  saveConfig,
  flushConfig,
  exportConfig,
  importConfigFromFile,
  type ChartConfig,
  type VisFlags,
  type OscView,
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
import { computeSMC, initSmcWasm, type SMCResult } from './smc-wasm'
import { buildBoxFlipSignals, type BoxFlipResult } from './box-flip'
import { downloadChartSnapshot } from './snapshot'
import {
  AlertsPanel,
  PositionsPanel,
  SignalPanel,
  FeatureWeightsPanel,
  FundingPanel,
  StatsPanel,
  FearGreedPanel,
  OrderFlowPanel,
  BoxFlipPanel,
  MHBandPanel,
  VolumeProfilePanel,
  TechnicalsPanel,
  VolumeSpikePanel,
  ChartHeader,
  IndicatorToolbar,
} from './components'
import { usePositions, useTicker, useFunding, useFearGreed, useKlines } from './hooks'
import {
  CHART,
  LIMIT,
  type Interval,
  SYMBOLS,
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
  INITIAL_SIDEBAR,
  statsFromTicker,
  DEFAULT_STATS,
  DEFAULT_FUNDING,
  DEFAULT_FNG,
  type Candle,
  type NWE,
  type ChartRefs,
  type SidebarState,
  type StatsState,
  type FundingState,
  type FngState,
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
  const smcDataRef = useRef<SMCResult>({ structures: [], orderBlocks: [], fvgs: [] })
  const boxFlipRef = useRef<BoxFlipResult>({ boxes: [], signals: [] })
  const ofOverlayRef = useRef<OFOverlaySignal[]>([])
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRefs = useRef<ChartRefs | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const hiLoLinesRef = useRef<{ high: any; low: any } | null>(null)
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
  const vpOptsRef = useRef({ heatmap: true, hvnRatio: 0.8 })
  const alertsRef = useRef<AlertRule[]>([...cfgInit.alerts])
  const soundRef = useRef<AlertSound>(new AlertSound())
  const lastPriceRef = useRef<number | null>(null)
  // Latest computed indicator snapshot — read from inside the WS handler.
  const sidebarRef = useRef<SidebarState>(INITIAL_SIDEBAR)

  const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
  const [symbol, setSymbol] = useState<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const [customSymbols, setCustomSymbols] = useState<SymbolEntry[]>(loadCustomSymbols)
  const allSymbols: SymbolEntry[] = [...SYMBOLS, ...customSymbols]
  const symbolInfo: SymbolEntry = allSymbols.find((s) => s.symbol === symbol) || {
    symbol,
    base: symbol.replace(/USDT$/, ''),
    quote: 'USDT',
    exchange: 'binance' as Exchange,
  }
  // Also keep a ref so effects always see the latest value without stale closures
  const symbolInfoRef = useRef(symbolInfo)
  symbolInfoRef.current = symbolInfo
  const [vis, setVis] = useState<VisFlags>(visRef.current)
  const [vpOpts, setVpOpts] = useState(vpOptsRef.current)
  const [oscOpen, setOscOpen] = useState<boolean>(cfgInit.oscOpen)
  const [oscView, setOscView] = useState<OscView>(cfgInit.oscView)
  const [oscHeight, setOscHeight] = useState<number>(cfgInit.oscHeight)
  const [spikeMult, setSpikeMult] = useState<number>(cfgInit.spikeMult)
  const spikeMultRef = useRef<number>(cfgInit.spikeMult)
  spikeMultRef.current = spikeMult
  const oscViewRef = useRef<OscView>(cfgInit.oscView)
  oscViewRef.current = oscView
  const oscOpenRef = useRef<boolean>(cfgInit.oscOpen)
  oscOpenRef.current = oscOpen
  const [alerts, setAlerts] = useState<AlertRule[]>(alertsRef.current)
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
  const [ohlcv, setOhlcv] = useState({ o: '—', h: '—', l: '—', c: '—', v: '—' })
  const [sidebar, setSidebar] = useState<SidebarState>(INITIAL_SIDEBAR)

  // ── Polled market data via React Query (ticker 5s, funding 30s, F&G 60s) ──
  const tickerQuery = useTicker(symbol, symbolInfo)
  const fundingQuery = useFunding(symbol, symbolInfo)
  const fngQuery = useFearGreed()
  // Historical candles (one-shot per symbol/interval); WS handles live ticks.
  const klinesQuery = useKlines(symbol, interval, symbolInfo)
  const stats: StatsState = tickerQuery.data ? statsFromTicker(tickerQuery.data) : DEFAULT_STATS
  const funding: FundingState = fundingQuery.data ?? DEFAULT_FUNDING
  const fng: FngState = fngQuery.data ?? DEFAULT_FNG

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
  } = usePositions(chartRefs)

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
      })
    },
    [interval, symbol, vis, alerts, sound, notifAllowed, oscOpen, oscView, oscHeight, spikeMult],
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
    const ml = mlSignal(data, nwe, sma50, sma200, rsi, macd, {
      adx: adxR,
      stoch,
      obv,
      vwap: vwapR.vwap,
      divs,
    })

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
    // lightweight-charts requires markers sorted ascending by time.
    markers.sort((a, b) => a.time - b.time)
    refs.candleSeries.setMarkers(markers)
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
    refs.ma50S.setData(visFlags.ma50 ? toLine(sma50) : [])
    refs.ma200S.setData(visFlags.ma200 ? toLine(sma200) : [])
    refs.vwapS.setData(visFlags.vwap ? toLine(vwapR.vwap) : [])
    refs.vwapUpS.setData(visFlags.vwap ? toLine(vwapR.upper) : [])
    refs.vwapLoS.setData(visFlags.vwap ? toLine(vwapR.lower) : [])

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
      refs.candleSeries.setMarkers(markers)

      if (!isInitial && isNewCandle) {
        const ratio = (data[lastIdx].volume / (volSmaAll[lastIdx] as number)).toFixed(1)
        const msg = `Volume spike ${ratio}x trung bình 20 nến`
        if (soundEnabledRef.current) soundRef.current.play()
        pushNotification('BTC Chart — Volume Spike', msg)
        setFiredToast(msg)
      }
    }

    if (fitNextRef.current) {
      refs.mainChart.timeScale().fitContent()
      fitNextRef.current = false
    }

    if (vpCanvasRef.current && mainElRef.current) {
      const info = drawVP(vpCanvasRef.current, mainElRef.current, data.slice(-LIMIT), visFlags.vp, {
        ...vpOptsRef.current,
        width: 220,
      })
      setSidebar((s) => ({
        ...s,
        vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
        vpHvn: info.hvnCount,
      }))
    }

    // ── SMC overlay ──
    const smcResult = visFlags.smc
      ? computeSMC(data, {
          structure: true,
          orderBlocks: true,
          fvg: true,
          swingLen: 10,
          internalLen: 5,
        })
      : { structures: [], orderBlocks: [], fvgs: [] }
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
    }))
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
      title: 'MH+',
    })
    const nweMidS = mainChart.addLineSeries({
      color: 'rgba(111,188,240,0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH',
    })
    const nweLowS = mainChart.addLineSeries({
      color: 'rgba(52,216,164,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH-',
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

    // VWAP (anchored) + std-dev bands
    const vwapS = mainChart.addLineSeries({
      color: '#c792ea',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'VWAP',
    })
    const vwapUpS = mainChart.addLineSeries({
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const vwapLoS = mainChart.addLineSeries({
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    // Volume is overlaid on the bottom of the main price pane (own scale).
    const volSeries = mainChart.addHistogramSeries({
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

    const adxRef = chart.addLineSeries(lineOpts('rgba(255,255,255,0.18)', 1, true))
    const adxS = chart.addLineSeries({ ...lineOpts('#ffc46b', 2), title: 'ADX' })
    const plusDIS = chart.addLineSeries({ ...lineOpts('#34d8a4', 1.5), title: '+DI' })
    const minusDIS = chart.addLineSeries({ ...lineOpts('#ff7a85', 1.5), title: '-DI' })
    const stochOB = chart.addLineSeries(lineOpts('rgba(255,122,133,0.3)', 1, true))
    const stochOS = chart.addLineSeries(lineOpts('rgba(52,216,164,0.3)', 1, true))
    const stochKS = chart.addLineSeries({ ...lineOpts('#6fbcf0', 2), title: '%K' })
    const stochDS = chart.addLineSeries({ ...lineOpts('#ffc46b', 1.5), title: '%D' })
    const obvS = chart.addLineSeries({ ...lineOpts('#80ffd5', 2), title: 'OBV' })
    const rsiOB = chart.addLineSeries(lineOpts('rgba(255,122,133,0.3)', 1, true))
    const rsiOS = chart.addLineSeries(lineOpts('rgba(52,216,164,0.3)', 1, true))
    const rsiS = chart.addLineSeries({ ...lineOpts(CHART.neu, 2), title: 'RSI' })

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
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* noop */
        }
        wsRef.current = null
      }
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
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k.end) renderData(arr)
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
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k.confirm) renderData(arr)
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
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k[8] === '1') renderData(arr)
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
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
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
          if (k.x) renderData(arr)
        }
      }
      if (!ws.onerror) ws.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
      ws.onclose = () => {
        if (!cancelled) setWsStatus({ text: 'Closed', tone: 'muted' })
      }
      wsRef.current = ws
    }

    if (data) {
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
      }
      fitNextRef.current = true
      renderData(data.candles)
      const savedZoom = loadConfig().zoom
      if (savedZoom && chartRefs.current?.mainChart) {
        chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(savedZoom)
      }
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

  // ── VP options ──────────────────────────────────────────────────────
  const toggleHeatmap = useCallback(() => {
    setVpOpts((o) => {
      const next = { ...o, heatmap: !o.heatmap }
      vpOptsRef.current = next
      queueMicrotask(() => renderData(candlesRef.current))
      return next
    })
  }, [renderData])

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
  }, [interval, symbol, vis, alerts, sound, notifAllowed, oscOpen, oscView, oscHeight, spikeMult])

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
    <div className={`btc-chart${loading ? '' : ' is-ready'}`} ref={rootRef}>
      <div className={`btc-chart__loading${loading ? '' : ' is-done'}`} aria-hidden={!loading}>
        <div className="btc-chart__spinner" />
        <span className="btc-chart__loading-text">{loadingText}</span>
      </div>
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
      <ChartHeader
        symbolInfo={symbolInfo}
        symbol={symbol}
        symbols={allSymbols}
        interval={interval}
        price={price}
        ohlcv={ohlcv}
        onSelectSymbol={selectSymbol}
        onSelectInterval={selectInterval}
        onAddCustomSymbol={addCustomSymbol}
      />
      {/* Toolbar */}
      <IndicatorToolbar
        vis={vis}
        onToggle={toggle}
        heatmap={vpOpts.heatmap}
        onToggleHeatmap={toggleHeatmap}
        soundEnabled={sound.enabled}
        onToggleSound={toggleSound}
        notifAllowed={notifAllowed}
        onRequestNotif={requestNotif}
        onSnapshot={snapshot}
        onExport={exportNow}
        onImport={importNow}
      />
      {/* Body */}
      <div className="btc-chart__body">
        <div className="btc-chart__col">
          <div className="btc-chart__legend" ref={legendRef} />
          <canvas className="btc-chart__of-canvas" ref={ofCanvasRef} />
          <canvas className="btc-chart__smc-canvas" ref={smcCanvasRef} />
          <canvas className="btc-chart__box-canvas" ref={boxCanvasRef} />
          <div className="btc-chart__main" ref={mainElRef} />
          <canvas className="btc-chart__vp-canvas" ref={vpCanvasRef} />
          {/* Oscillator pane — RSI / ADX / StochRSI / OBV, resizable + collapsible */}
          <div
            className={`btc-chart__osc-wrap${oscOpen ? ' is-open' : ''}`}
            style={oscOpen ? { height: oscHeight } : undefined}
          >
            {oscOpen && (
              <div
                className="btc-chart__osc-resize"
                onPointerDown={startOscResize}
                title="Kéo để chỉnh chiều cao"
                role="separator"
                aria-orientation="horizontal"
              />
            )}
            <div className="btc-chart__osc-bar">
              <button
                type="button"
                className="btc-chart__osc-toggle"
                onClick={() => setOscOpen((o) => !o)}
                aria-expanded={oscOpen}
              >
                <span className="btc-chart__osc-caret">{oscOpen ? '▾' : '▸'}</span>
                Oscillators
                <span className="btc-chart__osc-hint">
                  RSI {sidebar.rsiNow != null ? sidebar.rsiNow.toFixed(1) : '—'}
                  {' · '}ADX {sidebar.adxNow != null ? sidebar.adxNow.toFixed(1) : '—'}
                  {' · '}StochK {sidebar.stochKNow != null ? sidebar.stochKNow.toFixed(1) : '—'}
                  {' · '}OBV{' '}
                  {sidebar.obvNow != null ? (sidebar.obvNow / 1e6).toFixed(1) + 'M' : '—'}
                </span>
                <span className="btc-chart__osc-desc">
                  {sidebar.rsiNow != null && sidebar.rsiNow > 70
                    ? 'Quá mua'
                    : sidebar.rsiNow != null && sidebar.rsiNow < 30
                      ? 'Quá bán'
                      : 'Trung tính'}
                  {' · '}
                  {sidebar.adxNow != null && sidebar.adxNow >= 25 ? 'Xu hướng mạnh' : 'Sideway'}
                  {' · '}
                  {sidebar.stochKNow != null && sidebar.stochKNow > 80
                    ? 'Quá mua'
                    : sidebar.stochKNow != null && sidebar.stochKNow < 20
                      ? 'Quá bán'
                      : 'Trung tính'}
                </span>
              </button>
              {oscOpen && (
                <div className="btc-chart__osc-tabs">
                  {(
                    [
                      { id: 'rsi', label: 'RSI' },
                      { id: 'adx', label: 'ADX / DMI' },
                      { id: 'stoch', label: 'Stoch RSI' },
                      { id: 'obv', label: 'OBV' },
                    ] as { id: OscView; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`btc-chart__osc-tab${oscView === t.id ? ' is-on' : ''}`}
                      onClick={() => setOscView(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="btc-chart__osc" ref={oscElRef} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="btc-chart__sidebar">
          <SignalPanel ml={sidebar.ml} />
          <PositionsPanel
            positions={positions}
            showForm={showPosForm}
            setShowForm={setShowPosForm}
            form={posForm}
            setForm={setPosForm}
            onAdd={addPosition}
            onRemove={removePosition}
            markPrice={lastPriceRef.current}
          />
          <FundingPanel funding={funding} />
          <StatsPanel stats={stats} />
          <OrderFlowPanel ofLog={sidebar.ofLog} />
          <BoxFlipPanel boxFlip={sidebar.boxFlip} />
          <MHBandPanel sidebar={sidebar} />
          <AlertsPanel
            alerts={alerts}
            onAdd={addAlert}
            onRemove={removeAlert}
            onToggle={toggleAlert}
            onReset={resetAlert}
            currentPrice={candlesRef.current[candlesRef.current.length - 1]?.close ?? null}
            currentRsi={sidebar.rsiNow}
          />
          <TechnicalsPanel sidebar={sidebar} />
          <VolumeSpikePanel
            enabled={vis.volSpike}
            onToggle={() => toggle('volSpike')}
            spikeMult={spikeMult}
            onChange={(val) => {
              setSpikeMult(val)
              spikeMultRef.current = val
              if (candlesRef.current.length) queueMicrotask(() => renderData(candlesRef.current))
            }}
          />
          <FeatureWeightsPanel ml={sidebar.ml} />
          <VolumeProfilePanel vp={sidebar.vp} vpHvn={sidebar.vpHvn} />
          <FearGreedPanel fng={fng} />
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
        <span>Box · {sidebar.boxFlip.count}</span>
        <span className="btc-chart__status-tag">NWE · VP · Order Flow · Box Flip</span>
      </div>
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
