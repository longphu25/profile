// BTC Chart — imperative chart render pipeline (extracted from plugin.tsx renderData).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { pushNotification } from '../alerts'
import type { OFOverlaySignal } from '../order-flow-overlay'
import { drawVolumeProfile as drawVP } from '../volume-profile'
import { drawOrderFlow } from '../order-flow-overlay'
import { computeSMC, computeNadarayaWatson } from '../smc-wasm'
import { buildBoxFlipSignals } from '../box-flip'
import { loadConfig } from '../storage'
import type { ChartRenderContext } from './chart-render-context'
import { buildSidebarSnapshot } from './build-sidebar-snapshot'
import { stabilizeTradeSetup } from './trade-setup-stable'
import { CHART, HEAVY_COMPUTE_MS, LIMIT, NWE_DEFAULT_WINDOW } from './constants'
import { resolvePipelineNeeds } from './pipeline-needs'
import { sidebarSnapshotKey } from './sidebar-snapshot-key'
import { detectCandlePatterns } from './candlestick-patterns'
import { computeBoucherScalping } from './boucher-scalping'
import { computeLienReversal } from './lien-reversal'
import { computeLiquidity } from './liquidity'
import { computeICT } from './ict-sessions'
import {
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
} from './indicators'
import { mlSignal } from './ml'
import { HTF_MAP } from './liquidity'
import { computeSupplyDemand } from './supply-demand'
import {
  drawSmcStackOverlay,
  drawBoxFlipOverlay,
  drawICTOverlay,
  drawLiquidityOverlay,
} from './overlays'
import { drawTradeSetupOverlay } from './trade-setup-overlay'
import { applyDefaultViewport } from './chart-viewport'
import { fmtP } from './format'
import type { Candle, OrderFlowSignal } from './types'

/**
 * Render all chart series, overlays, and sidebar state for the given candle data.
 * Behavior matches the original `renderData` callback in plugin.tsx.
 */
export function renderChartPipeline(ctx: ChartRenderContext, data: Candle[]): void {
  const refs = ctx.chartRefs.current
  if (!data.length || !refs) return

  const panelKey = `${data.length}:${data[data.length - 1]?.time ?? 0}`
  if (panelKey !== ctx.panelCandleKeyRef.current) {
    ctx.panelCandleKeyRef.current = panelKey
    ctx.setPanelCandles(data)
    ctx.setLastCandleClose(data[data.length - 1]?.close ?? null)
  }

  const isInitial = ctx.fitNextRef.current

  const visFlags = ctx.visRef.current
  const needs = resolvePipelineNeeds(visFlags, ctx.oscOpenRef.current)
  const lastCandle = data[data.length - 1]
  const barKey = `${data.length}:${lastCandle.time}`
  const now = Date.now()
  const needHeavy =
    barKey !== ctx.heavyBarKeyRef.current ||
    now - ctx.lastHeavyComputeMsRef.current >= HEAVY_COMPUTE_MS
  if (needHeavy) {
    ctx.heavyBarKeyRef.current = barKey
    ctx.lastHeavyComputeMsRef.current = now
  }

  const nwe = calcMHBand(data)
  const sma50 = calcSMA(data, 50)
  const sma200 = calcSMA(data, 200)
  const rsi = calcRSI(data, 14)
  const macd = calcMACD(data)
  const adxR = calcADX(data, 14)
  const stoch = calcStochRSI(data)
  const obv = calcOBV(data)
  const vwapR = calcVWAP(data)
  const divs = needs.rsiDiv ? detectRSIDivergence(data, rsi) : []
  const of_ = needs.orderFlow
    ? buildOrderFlow(data, nwe)
    : { overlay: [] as OFOverlaySignal[], log: [] as OrderFlowSignal[] }
  const boxFlip = needs.boxFlip
    ? buildBoxFlipSignals(data, {
        minBoxBars: 10,
        maxBoxHeightPct: 0.012,
        breakoutConfirm: 'close',
        bufferPct: 0.0007,
      })
    : ctx.boxFlipRef.current

  let luxNwe = ctx.nweCacheRef.current ?? {
    mid: [],
    upper: [],
    lower: [],
    signals: [],
  }
  if (needs.luxNwe && (needHeavy || !ctx.nweCacheRef.current)) {
    const currentNweCfg = ctx.nweCfgRef.current
    const nweKey = `${barKey}:${currentNweCfg.repaint}:${currentNweCfg.bandwidth}:${currentNweCfg.multiplier}:${currentNweCfg.maxBarsBack ?? NWE_DEFAULT_WINDOW}`
    if (nweKey !== ctx.nweCacheKeyRef.current || !ctx.nweCacheRef.current) {
      const t0 = performance.now()
      const win = Math.min(currentNweCfg.maxBarsBack ?? NWE_DEFAULT_WINDOW, data.length)
      const nweInput = currentNweCfg.repaint ? data.slice(-win) : data
      luxNwe = computeNadarayaWatson(nweInput, { ...currentNweCfg, maxBarsBack: win })
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
      ctx.nweCacheKeyRef.current = nweKey
      ctx.nweCacheRef.current = luxNwe
      ctx.setLuxNweResult(luxNwe)
    }
  }

  let ict = ctx.ictDataRef.current
  if (needs.ict && (needHeavy || !ctx.ictDataRef.current.sessions.length)) {
    ict = computeICT(data, ctx.intervalRef.current)
    ctx.ictDataRef.current = ict
    ctx.setICTResult(ict)
  }
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
    ctx.signalConfigRef.current,
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

  let bScalp = ctx.boucherCacheRef.current
  if (needs.boucher && (needHeavy || !bScalp)) {
    bScalp = computeBoucherScalping(data)
    ctx.boucherCacheRef.current = bScalp
  }
  if (visFlags.scalping && bScalp) {
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

  let lienR = ctx.lienCacheRef.current
  if (needs.lien && (needHeavy || !lienR)) {
    lienR = computeLienReversal(data)
    ctx.lienCacheRef.current = lienR
  }
  if (visFlags.reversal && lienR) {
    for (const rev of lienR.reversals) {
      markers.push({
        time: rev.time,
        position: rev.type === 'bullish' ? 'belowBar' : 'aboveBar',
        color: rev.type === 'bullish' ? '#6fbcf0' : '#c792ea',
        shape: rev.type === 'bullish' ? 'arrowUp' : 'arrowDown',
        text: rev.type === 'bullish' ? 'REV+' : 'REV-',
      })
    }
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
  markers.sort((a, b) => a.time - b.time)
  if (ctx.markersRef.current) {
    ctx.markersRef.current.setMarkers(markers)
  } else {
    const LWC = window.LightweightCharts
    if (LWC?.createSeriesMarkers) {
      ctx.markersRef.current = LWC.createSeriesMarkers(refs.candleSeries, markers)
    }
  }
  ctx.boxFlipRef.current = boxFlip
  if (ctx.boxCanvasRef.current && ctx.mainElRef.current && refs.candleSeries) {
    drawBoxFlipOverlay(
      ctx.boxCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      data,
      boxFlip,
      visFlags.boxFlip,
    )
  }
  ctx.ofOverlayRef.current = of_.overlay
  if (ctx.ofCanvasRef.current && ctx.mainElRef.current && refs.candleSeries) {
    drawOrderFlow(
      ctx.ofCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      visFlags.of ? of_.overlay : [],
      true,
    )
  }

  refs.nweMidS.setData(visFlags.nwe ? toLine(nwe.mid) : [])
  refs.nweUpS.setData(visFlags.nwe ? toLine(nwe.upper) : [])
  refs.nweLowS.setData(visFlags.nwe ? toLine(nwe.lower) : [])

  refs.luxNweMidS.setData(visFlags.luxNwe ? toLine(luxNwe.mid) : [])
  refs.luxNweUpS.setData(visFlags.luxNwe ? toLine(luxNwe.upper) : [])
  refs.luxNweLoS.setData(visFlags.luxNwe ? toLine(luxNwe.lower) : [])

  refs.ma50S.setData(visFlags.ma50 ? toLine(sma50) : [])
  refs.ma200S.setData(visFlags.ma200 ? toLine(sma200) : [])
  refs.vwapS.setData(visFlags.vwap ? toLine(vwapR.vwap) : [])
  refs.vwapUpS.setData(visFlags.vwap ? toLine(vwapR.upper) : [])
  refs.vwapLoS.setData(visFlags.vwap ? toLine(vwapR.lower) : [])

  if (ctx.dbbSeriesRef.current) {
    const dbbS = ctx.dbbSeriesRef.current
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

  const SPIKE_MULT = ctx.spikeMultRef.current
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
            color: isSpike ? (isBuy ? '#34ffc8' : '#ff5c6a') : isBuy ? CHART.upSoft : CHART.dnSoft,
          }
        })
      : [],
  )

  const osc = needs.oscillators ? ctx.oscRefs.current : null
  if (osc) {
    const view = ctx.oscViewRef.current
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
    osc.obvS.setData(view === 'obv' ? data.map((c, i) => ({ time: c.time, value: obv[i] })) : empty)
  }

  const lastIdx = data.length - 1
  const lastTime = data[lastIdx].time
  const isNewCandle = !isInitial && lastTime > ctx.lastCandleTimeRef.current
  ctx.lastCandleTimeRef.current = isInitial
    ? lastTime
    : Math.max(ctx.lastCandleTimeRef.current, lastTime)
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
    if (ctx.markersRef.current) ctx.markersRef.current.setMarkers(markers)

    if (!isInitial && isNewCandle) {
      const ratio = (data[lastIdx].volume / (volSmaAll[lastIdx] as number)).toFixed(1)
      const msg = `Volume spike ${ratio}x trung bình 20 nến`
      if (ctx.soundEnabledRef.current) ctx.soundRef.current.play()
      pushNotification('BTC Chart — Volume Spike', msg)
      ctx.setFiredToast(msg)
    }
  }

  if (ctx.fitNextRef.current) {
    const cfg = loadConfig()
    const canRestoreZoom =
      cfg.zoom != null &&
      cfg.symbol === ctx.symbolRef.current &&
      cfg.interval === ctx.intervalRef.current
    const range = canRestoreZoom
      ? cfg.zoom!
      : applyDefaultViewport(refs.mainChart.timeScale(), data.length)
    if (canRestoreZoom) {
      refs.mainChart.timeScale().setVisibleLogicalRange(range)
    }
    const oscChart = ctx.oscRefs.current?.chart
    if (oscChart) {
      oscChart.timeScale().setVisibleLogicalRange(range)
    }
    ctx.fitNextRef.current = false
  }

  if (needs.vp && ctx.vpCanvasRef.current && ctx.mainElRef.current) {
    const info = drawVP(
      ctx.vpCanvasRef.current,
      ctx.mainElRef.current,
      data.slice(-LIMIT),
      visFlags.vp,
      {
        ...ctx.vpOptsRef.current,
        heatmap: visFlags.heatmap && visFlags.vp,
      },
    )
    ctx.setSidebar((s) => ({
      ...s,
      vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
      vpHvn: info.hvnCount,
    }))
  }

  let smcResult = ctx.smcCacheRef.current ?? ctx.smcDataRef.current
  if (needs.smc && (needHeavy || !ctx.smcCacheRef.current)) {
    const smcKey = barKey
    if (smcKey !== ctx.smcCacheKeyRef.current || !ctx.smcCacheRef.current) {
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
      ctx.smcCacheKeyRef.current = smcKey
      ctx.smcCacheRef.current = smcResult
    }
    ctx.smcDataRef.current = smcResult
  }

  let sdResult = ctx.sdDataRef.current
  if (needs.supplyDemand && (needHeavy || !ctx.sdDataRef.current.zones.length)) {
    const ltfInterval = ctx.intervalRef.current
    const htfInterval = HTF_MAP[ltfInterval]
    sdResult = computeSupplyDemand(data, {
      htfData: ctx.htfRef.current,
      htfInterval: htfInterval ?? null,
      ltfInterval,
    })
    ctx.sdDataRef.current = sdResult
  }

  if (needHeavy && ctx.smcCanvasRef.current && ctx.mainElRef.current && refs.mainChart) {
    drawSmcStackOverlay(
      ctx.smcCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      smcResult,
      sdResult,
      visFlags.smc,
      visFlags.supplyDemand,
    )
  }

  if (needHeavy && ctx.ictCanvasRef.current && ctx.mainElRef.current && refs.mainChart) {
    drawICTOverlay(
      ctx.ictCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      ict,
      data,
      visFlags.ict,
    )
  }

  let liq = ctx.liqDataRef.current
  if (needs.liquidity && (needHeavy || !ctx.liqDataRef.current.range)) {
    liq = computeLiquidity(data, ctx.htfRef.current, smcResult, ctx.intervalRef.current)
    ctx.liqDataRef.current = liq
    ctx.setLiquidityResult(liq)
  }
  if (needHeavy && ctx.liqCanvasRef.current && ctx.mainElRef.current && refs.mainChart) {
    drawLiquidityOverlay(
      ctx.liqCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      liq,
      data,
      visFlags.liquidity,
    )
  }

  const i = data.length - 1
  if (ctx.legendRef.current) {
    ctx.legendRef.current.innerHTML = [
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

  const snapshot = buildSidebarSnapshot({
    data,
    nwe,
    sma50,
    sma200,
    rsi,
    macd,
    adxR,
    stoch,
    obv,
    vwapR,
    divs,
    ofLog: of_.log,
    boxFlip,
    ml,
    bScalp: bScalp ?? {
      atr: 0,
      boxSize: 0,
      currentBox: null,
      boxes: [],
      ladder: [],
      threeBar: [],
      entries: [],
      envelope: 0,
      target: 0,
      speed: 'normal' as const,
      stats: { signals: 0, wins: 0, rr: 0 },
    },
    lienR: lienR ?? {
      dbb: null,
      zone: 'neutral' as const,
      prevZone: 'neutral' as const,
      regime: 'range' as const,
      squeeze: { active: false, bars: 0, breakout: null },
      reversals: [],
      latestSignal: null,
      exhaustion: false,
      bandTouch: null,
      adrSpent: 0,
    },
    luxNwe,
    ict,
    liq,
    smcResult,
    supplyDemand: sdResult,
  })

  const lastBar = data[data.length - 1]
  const stabilizedSetup = stabilizeTradeSetup(snapshot.tradeSetup, ctx.tradeSetupLockRef.current, {
    candleTime: lastBar.time,
    spot: lastBar.close,
  })
  const snapshotWithPlan = { ...snapshot, tradeSetup: stabilizedSetup }

  const snapKey = sidebarSnapshotKey(snapshotWithPlan)
  if (snapKey !== ctx.sidebarKeyRef.current) {
    ctx.sidebarKeyRef.current = snapKey
    ctx.setSidebar((s) => ({ ...s, ...snapshotWithPlan }))
  }
  ctx.tradeSetupRef.current = stabilizedSetup
  if (
    needs.tradeSetup &&
    ctx.setupCanvasRef.current &&
    ctx.mainElRef.current &&
    refs.candleSeries
  ) {
    drawTradeSetupOverlay(
      ctx.setupCanvasRef.current,
      ctx.mainElRef.current,
      refs.mainChart,
      refs.candleSeries,
      data,
      stabilizedSetup,
      visFlags.tradeSetup,
    )
  }
  if (needHeavy && bScalp) ctx.setBoucherScalp(bScalp)
  if (needHeavy && lienR) ctx.setLienReversal(lienR)
}
