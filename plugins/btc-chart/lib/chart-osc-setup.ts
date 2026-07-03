// BTC Chart — advanced oscillator pane setup (ADX / StochRSI / OBV / RSI).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MutableRefObject, RefObject } from 'react'
import { CHART } from './constants'
import type { OscChartRefs } from './chart-render-context'
import type { Candle, ChartRefs } from './types'

export interface OscChartSetupParams {
  readonly oscElRef: RefObject<HTMLDivElement | null>
  readonly chartRefs: MutableRefObject<ChartRefs | null>
  readonly oscRefs: MutableRefObject<OscChartRefs | null>
  readonly candlesRef: MutableRefObject<Candle[]>
  readonly onReady: () => void
}

/**
 * Create the oscillator lightweight-charts pane synced to the main chart.
 * Returns a cleanup function.
 */
export function createOscChart(params: OscChartSetupParams): (() => void) | null {
  const LWC = window.LightweightCharts
  const mainChart = params.chartRefs.current?.mainChart
  if (!LWC || !params.oscElRef.current || !mainChart) return null

  const el = params.oscElRef.current
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

  mainChart.applyOptions({ timeScale: { visible: false } })

  const syncFrom = mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
    if (r) chart.timeScale().setVisibleLogicalRange(r)
  })
  chart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
    if (r) mainChart.timeScale().setVisibleLogicalRange(r)
  })
  const cur = mainChart.timeScale().getVisibleLogicalRange()
  if (cur) chart.timeScale().setVisibleLogicalRange(cur)

  const ro = new ResizeObserver(() => {
    if (el.clientHeight > 0) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
  })
  ro.observe(el)

  params.oscRefs.current = {
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
      try {
        params.chartRefs.current?.mainChart.applyOptions({ timeScale: { visible: true } })
      } catch {
        /* noop */
      }
    },
  }

  requestAnimationFrame(() => {
    if (el.clientHeight > 0) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    if (params.candlesRef.current.length) params.onReady()
  })

  return () => {
    params.oscRefs.current?.cleanup()
    params.oscRefs.current = null
  }
}
