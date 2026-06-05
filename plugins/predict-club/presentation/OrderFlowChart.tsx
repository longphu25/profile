import { useEffect, useRef, useMemo } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type DeepPartial,
  type ChartOptions,
  type LineData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import type { OraclePrice } from '../infrastructure/deepbookOracleService'

/**
 * Professional DeepBook Order Flow chart using TradingView Lightweight Charts.
 * Dual line (Spot + Forward) with Basis histogram overlay.
 */
export function OrderFlowChart({ prices }: { prices: OraclePrice[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const spotSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const fwdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const basisSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Convert prices to chart data — dedup by time, sort ascending
  const { spotData, fwdData, basisData } = useMemo(() => {
    const spot: LineData<Time>[] = []
    const fwd: LineData<Time>[] = []
    const basis: HistogramData<Time>[] = []
    const seen = new Set<number>()

    // Sort ascending by timestamp
    const sorted = [...prices].sort((a, b) => a.timestamp - b.timestamp)

    for (const p of sorted) {
      const timeSec = Math.floor(p.timestamp / 1000)
      if (seen.has(timeSec)) continue
      seen.add(timeSec)
      const time = timeSec as Time
      spot.push({ time, value: p.spot })
      fwd.push({ time, value: p.forward })
      const b = p.forward - p.spot
      basis.push({
        time,
        value: b,
        color: b > 0 ? 'rgba(0, 224, 179, 0.5)' : 'rgba(255, 180, 171, 0.5)',
      })
    }
    return { spotData: spot, fwdData: fwd, basisData: basis }
  }, [prices])

  // Create chart
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Wait for container to have layout dimensions
    const tryCreate = () => {
      if (!el.clientWidth || !el.clientHeight) {
        const raf = requestAnimationFrame(tryCreate)
        return () => cancelAnimationFrame(raf)
      }
      return initChart(el)
    }

    const cleanup = tryCreate()
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  function initChart(el: HTMLElement) {
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { color: '#07100d' },
        textColor: '#83958d',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(58, 74, 68, 0.4)' },
        horzLines: { color: 'rgba(58, 74, 68, 0.4)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(58, 74, 68, 0.6)',
        textColor: '#83958d',
      },
      timeScale: {
        borderColor: 'rgba(58, 74, 68, 0.6)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0, // Normal
        vertLine: {
          color: 'rgba(0, 224, 179, 0.3)',
          labelBackgroundColor: '#19211e',
        },
        horzLine: {
          color: 'rgba(0, 224, 179, 0.3)',
          labelBackgroundColor: '#19211e',
        },
      },
      handleScroll: { vertTouchDrag: false },
    }

    const chart = createChart(el, {
      ...chartOptions,
      width: el.clientWidth,
      height: el.clientHeight,
      autoSize: true,
    })
    chartRef.current = chart

    // Spot line
    const spotSeries = chart.addLineSeries({
      color: '#00e0b3',
      lineWidth: 2,
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: 'rgba(0, 224, 179, 0.4)',
      priceLineStyle: 2,
      crosshairMarkerRadius: 5,
      crosshairMarkerBackgroundColor: '#00e0b3',
      crosshairMarkerBorderColor: '#07100d',
      title: 'Spot',
    })
    spotSeriesRef.current = spotSeries

    // Forward line
    const fwdSeries = chart.addLineSeries({
      color: '#b7c8e1',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: '#b7c8e1',
      crosshairMarkerBorderColor: '#07100d',
      title: 'Fwd',
    })
    fwdSeriesRef.current = fwdSeries

    // Basis histogram overlay
    const basisSeries = chart.addHistogramSeries({
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
      priceScaleId: 'basis',
      lastValueVisible: false,
      title: 'Basis',
    })
    basisSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    basisSeriesRef.current = basisSeries

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) chart.applyOptions({ width, height })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }

  // Update data
  useEffect(() => {
    if (!spotSeriesRef.current || spotData.length === 0) return
    spotSeriesRef.current.setData(spotData)
    fwdSeriesRef.current?.setData(fwdData)
    basisSeriesRef.current?.setData(basisData)
    chartRef.current?.timeScale().fitContent()
  }, [spotData, fwdData, basisData])

  const lastSpot = prices[prices.length - 1]?.spot
  const lastFwd = prices[prices.length - 1]?.forward
  const lastBasis = lastFwd && lastSpot ? lastFwd - lastSpot : 0

  if (prices.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[260px] bg-[#07100d]">
        <span className="font-data text-data-sm text-on-surface-variant opacity-60 flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-3xl">candlestick_chart</span>
          Waiting for oracle data…
        </span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Legend bar */}
      <div className="flex items-center gap-md px-md py-xs shrink-0 flex-wrap gap-y-1 bg-[#07100d] border-b border-[rgba(58,74,68,0.4)]">
        <span className="font-label text-label-caps text-on-surface-variant uppercase tracking-wider">
          DeepBook Oracle Flow
        </span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-[2px] rounded bg-[#00e0b3] inline-block" />
          <span className="font-data text-[11px] text-[#00e0b3] tabular-nums">
            Spot {lastSpot?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-[2px] rounded bg-[#b7c8e1] inline-block opacity-70" />
          <span className="font-data text-[11px] text-[#b7c8e1] tabular-nums">
            Forward {lastFwd?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-xs">
          <span className="font-label text-[10px] text-on-surface-variant uppercase">Basis</span>
          <span
            className={`font-data text-[11px] font-bold tabular-nums ${
              lastBasis > 0
                ? 'text-[#00e0b3]'
                : lastBasis < 0
                  ? 'text-error'
                  : 'text-on-surface-variant'
            }`}
          >
            {lastBasis >= 0 ? '+' : ''}
            {lastBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className="font-data text-[10px] text-on-surface-variant tabular-nums">
            ({lastSpot ? ((lastBasis / lastSpot) * 100).toFixed(3) : 0}%)
          </span>
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: '240px', height: '100%' }} />
    </div>
  )
}
