// BTC Chart — main lightweight-charts pane setup (once per mount).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { drawVolumeProfile as drawVP } from '../volume-profile'
import { drawOrderFlow } from '../order-flow-overlay'
import { loadConfig, saveConfig } from '../storage'
import type { VisFlags } from '../storage'
import type { BoxFlipResult } from '../box-flip'
import type { OFOverlaySignal } from '../order-flow-overlay'
import type { SMCResult } from '../smc-wasm'
import { CHART, LIMIT } from './constants'
import { fmtP } from './format'
import type { DbbSeriesRefs } from './chart-render-context'
import type { ICTResult } from './ict-sessions'
import type { LiquidityResult } from './liquidity'
import {
  drawSMCOverlay,
  drawBoxFlipOverlay,
  drawICTOverlay,
  drawLiquidityOverlay,
} from './overlays'
import type { Candle, ChartRefs, OhlcvState, SidebarState } from './types'

/** Refs and callbacks required to create and wire the main chart pane. */
export interface MainChartSetupParams {
  readonly mainElRef: RefObject<HTMLDivElement | null>
  readonly vpCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly ofCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly smcCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly boxCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly ictCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly liqCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly chartRefs: MutableRefObject<ChartRefs | null>
  readonly dbbSeriesRef: MutableRefObject<DbbSeriesRefs | null>
  readonly hiLoLinesRef: MutableRefObject<{ high: any; low: any } | null>
  readonly candlesRef: MutableRefObject<Candle[]>
  readonly visRef: MutableRefObject<VisFlags>
  readonly vpOptsRef: MutableRefObject<{ hvnRatio: number }>
  readonly ofOverlayRef: MutableRefObject<OFOverlaySignal[]>
  readonly smcDataRef: MutableRefObject<SMCResult>
  readonly ictDataRef: MutableRefObject<ICTResult>
  readonly liqDataRef: MutableRefObject<LiquidityResult>
  readonly boxFlipRef: MutableRefObject<BoxFlipResult>
  readonly oscOpenRef: MutableRefObject<boolean>
  readonly oscRefs: MutableRefObject<{ chart: any } | null>
  readonly oscElRef: RefObject<HTMLDivElement | null>
  readonly setSidebar: Dispatch<SetStateAction<SidebarState>>
  readonly setOhlcv: Dispatch<SetStateAction<OhlcvState>>
  readonly ohlcvVolume: string
}

/**
 * Create the main lightweight-charts instance, series, overlay redraw hooks,
 * and ResizeObserver. Returns a cleanup function.
 */
export function createMainChart(params: MainChartSetupParams): (() => void) | null {
  const LWC = window.LightweightCharts
  if (!LWC) return null
  if (!params.mainElRef.current || !params.mainElRef.current.parentElement) return null

  const col = params.mainElRef.current.parentElement
  const initMain = params.mainElRef.current.clientHeight || 360

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

  const mainChart = LWC.createChart(params.mainElRef.current, {
    ...base,
    width: params.mainElRef.current.clientWidth,
    height: initMain,
    timeScale: { ...base.timeScale, visible: !params.oscOpenRef.current },
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
  params.dbbSeriesRef.current = {
    upper2: dbbUpper2,
    lower2: dbbLower2,
    upper1: dbbUpper1,
    lower1: dbbLower1,
    sma: dbbSma,
  }

  const volSeries = mainChart.addSeries(LWC.HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
  })
  mainChart.priceScale('vol').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  })
  mainChart.priceScale('right').applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.2 },
  })

  mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
    if (!r) return
    saveConfig({
      ...loadConfig(),
      zoom: { from: r.from, to: r.to },
    })
    if (params.ofCanvasRef.current && params.mainElRef.current) {
      drawOrderFlow(
        params.ofCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.visRef.current.of ? params.ofOverlayRef.current : [],
        true,
      )
    }
    if (params.smcCanvasRef.current && params.mainElRef.current) {
      drawSMCOverlay(
        params.smcCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.smcDataRef.current,
        params.visRef.current.smc,
      )
    }
    if (params.ictCanvasRef.current && params.mainElRef.current) {
      drawICTOverlay(
        params.ictCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.ictDataRef.current,
        params.candlesRef.current,
        params.visRef.current.ict,
      )
    }
    if (params.liqCanvasRef.current && params.mainElRef.current) {
      drawLiquidityOverlay(
        params.liqCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.liqDataRef.current,
        params.candlesRef.current,
        params.visRef.current.liquidity,
      )
    }
    if (params.boxCanvasRef.current && params.mainElRef.current) {
      drawBoxFlipOverlay(
        params.boxCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.candlesRef.current,
        params.boxFlipRef.current,
        params.visRef.current.boxFlip,
      )
    }
    const cands = params.candlesRef.current
    if (cands.length) {
      const from = Math.max(0, Math.floor(r.from))
      const to = Math.min(cands.length - 1, Math.ceil(r.to))
      let hi = -Infinity,
        lo = Infinity
      for (let i = from; i <= to; i++) {
        if (cands[i].high > hi) hi = cands[i].high
        if (cands[i].low < lo) lo = cands[i].low
      }
      if (params.hiLoLinesRef.current) {
        try {
          candleSeries.removePriceLine(params.hiLoLinesRef.current.high)
          candleSeries.removePriceLine(params.hiLoLinesRef.current.low)
        } catch {
          /* noop */
        }
      }
      params.hiLoLinesRef.current = {
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
      params.setOhlcv({
        o: fmtP(d.open),
        h: fmtP(d.high),
        l: fmtP(d.low),
        c: fmtP(d.close),
        v: params.ohlcvVolume,
      })
    }
  })

  const syncSize = () => {
    if (!params.mainElRef.current) return
    const mw = params.mainElRef.current.clientWidth
    const mh2 = params.mainElRef.current.clientHeight
    if (mh2 <= 0) return
    mainChart.applyOptions({ width: mw, height: mh2 })
    if (
      params.oscRefs.current &&
      params.oscElRef.current &&
      params.oscElRef.current.clientHeight > 0
    ) {
      params.oscRefs.current.chart.applyOptions({
        width: params.oscElRef.current.clientWidth,
        height: params.oscElRef.current.clientHeight,
      })
    }
    if (params.candlesRef.current.length && params.vpCanvasRef.current) {
      const info = drawVP(
        params.vpCanvasRef.current,
        params.mainElRef.current,
        params.candlesRef.current.slice(-LIMIT),
        params.visRef.current.vp,
        {
          ...params.vpOptsRef.current,
          heatmap: params.visRef.current.heatmap,
        },
      )
      params.setSidebar((s) => ({
        ...s,
        vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
        vpHvn: info.hvnCount,
      }))
    }
    if (params.ofCanvasRef.current) {
      drawOrderFlow(
        params.ofCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.visRef.current.of ? params.ofOverlayRef.current : [],
        true,
      )
    }
    if (params.boxCanvasRef.current) {
      drawBoxFlipOverlay(
        params.boxCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.candlesRef.current,
        params.boxFlipRef.current,
        params.visRef.current.boxFlip,
      )
    }
    if (params.smcCanvasRef.current) {
      drawSMCOverlay(
        params.smcCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.smcDataRef.current,
        params.visRef.current.smc,
      )
    }
    if (params.ictCanvasRef.current) {
      drawICTOverlay(
        params.ictCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.ictDataRef.current,
        params.candlesRef.current,
        params.visRef.current.ict,
      )
    }
    if (params.liqCanvasRef.current) {
      drawLiquidityOverlay(
        params.liqCanvasRef.current,
        params.mainElRef.current,
        mainChart,
        candleSeries,
        params.liqDataRef.current,
        params.candlesRef.current,
        params.visRef.current.liquidity,
      )
    }
  }
  const ro = new ResizeObserver(syncSize)
  ro.observe(col)
  ro.observe(params.mainElRef.current)
  requestAnimationFrame(syncSize)

  params.chartRefs.current = {
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
    params.chartRefs.current?.cleanup()
    params.chartRefs.current = null
  }
}
