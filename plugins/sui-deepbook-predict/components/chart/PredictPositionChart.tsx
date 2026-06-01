import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts'
import { PRICE_SCALE, STRIKE_SCALE } from '../../domain/constants'
import type { PositionOverlay } from '../../domain/types'

type ChartMode = 'binary' | 'range'

interface PriceTick {
  spot?: number
  forward?: number
  timestamp?: number
  timestamp_ms?: number
  onchain_timestamp?: number
}

interface Props {
  prices: PriceTick[]
  spotRaw: number
  mode: ChartMode
  selectedStrike?: number | null
  selectedLower?: number | null
  selectedUpper?: number | null
  overlays: PositionOverlay[]
  overlaysLoading?: boolean
  overlaysError?: string | null
  onBinarySelect: (strike: number, isUp: boolean) => void
  onRangeSelect: (lowerStrike: number, upperStrike: number) => void
}

interface DragRange {
  start: number
  end: number
}

function toSeconds(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp
}

function readTimestamp(row: PriceTick, fallbackMs: number): number {
  const raw = row.timestamp_ms ?? row.timestamp ?? row.onchain_timestamp ?? fallbackMs
  return raw < 10_000_000_000 ? raw * 1000 : raw
}

function roundStrike(price: number): number {
  return Math.max(1, Math.round(price))
}

function formatStrike(raw: number): string {
  return `$${(raw / STRIKE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function PredictPositionChart({
  prices,
  spotRaw,
  mode,
  selectedStrike,
  selectedLower,
  selectedUpper,
  overlays,
  overlaysLoading,
  overlaysError,
  onBinarySelect,
  onRangeSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const [height, setHeight] = useState(280)
  const [drag, setDrag] = useState<DragRange | null>(null)
  const [plotVersion, setPlotVersion] = useState(0)

  const spot = spotRaw / PRICE_SCALE
  const seriesData = useMemo(() => {
    const now = Date.now()
    const source =
      prices.length > 0
        ? prices
        : spotRaw
          ? [
              { spot: spotRaw, timestamp: now - 4 * 60_000 },
              { spot: spotRaw, timestamp: now },
            ]
          : []

    return source
      .map((row, index) => ({
        time: toSeconds(readTimestamp(row, now - (source.length - index) * 30_000)),
        value: Number(row.spot || row.forward || 0) / PRICE_SCALE,
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => a.time - b.time)
      .filter((row, i, arr) => i === 0 || row.time > arr[i - 1].time)
  }, [prices, spotRaw])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#071011' },
        textColor: '#9fb9b1',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(190, 255, 234, 0.06)' },
        horzLines: { color: 'rgba(190, 255, 234, 0.08)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(190, 255, 234, 0.16)' },
      timeScale: {
        borderColor: 'rgba(190, 255, 234, 0.16)',
        timeVisible: true,
        secondsVisible: false,
      },
    })
    const series = chart.addAreaSeries({
      topColor: 'rgba(128, 255, 213, 0.22)',
      bottomColor: 'rgba(128, 255, 213, 0.02)',
      lineColor: '#80ffd5',
      lineWidth: 2,
      priceLineVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    const resize = () => {
      const width = containerRef.current?.clientWidth || 0
      const nextHeight = width < 560 ? 240 : 280
      setHeight(nextHeight)
      chart.applyOptions({ width, height: nextHeight })
      setPlotVersion((value) => value + 1)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || seriesData.length === 0) return
    series.setData(seriesData)
    chart.timeScale().fitContent()
    setPlotVersion((value) => value + 1)
  }, [seriesData])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    const handleClick = (param: MouseEventParams) => {
      if (!param.point) return
      const price = series.coordinateToPrice(param.point.y)
      if (!price) return
      const strike = roundStrike(price)
      // Direction needs a valid spot; skip selection if the oracle spot is missing.
      if (mode === 'binary' && spot) {
        onBinarySelect(strike, strike >= spot)
      }
    }

    chart.subscribeClick(handleClick)
    return () => chart.unsubscribeClick(handleClick)
  }, [mode, onBinarySelect, spot])

  // Re-render overlays when the user pans/zooms so Y positions stay correct.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const bump = () => setPlotVersion((v) => v + 1)
    chart.timeScale().subscribeVisibleLogicalRangeChange(bump)
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(bump)
      } catch {
        /* chart already removed */
      }
    }
  }, [seriesData]) // re-subscribe after data changes (chart is ready)

  const priceToY = (price: number | null | undefined) => {
    if (!price || !seriesRef.current) return null
    const coordinate = seriesRef.current.priceToCoordinate(price)
    return coordinate == null ? null : coordinate
  }

  const yToPrice = (clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !seriesRef.current) return null
    const price = seriesRef.current.coordinateToPrice(clientY - rect.top)
    return price ? roundStrike(price) : null
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== 'range') return
    event.currentTarget.setPointerCapture(event.pointerId)
    const price = yToPrice(event.clientY)
    if (!price) return
    setDrag({ start: price, end: price })
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || mode !== 'range') return
    const price = yToPrice(event.clientY)
    if (!price) return
    setDrag({ ...drag, end: price })
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || mode !== 'range') return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const lower = Math.min(drag.start, drag.end)
    const upper = Math.max(drag.start, drag.end)
    if (upper > lower) onRangeSelect(lower, upper)
    setDrag(null)
  }

  const selectedLines = [
    selectedStrike
      ? {
          key: 'selected',
          label: `Selected $${selectedStrike.toLocaleString()}`,
          price: selectedStrike,
          className: 'predict-chart__line--selected',
        }
      : null,
    selectedLower
      ? {
          key: 'lower',
          label: `Lower $${selectedLower.toLocaleString()}`,
          price: selectedLower,
          className: 'predict-chart__line--range',
        }
      : null,
    selectedUpper
      ? {
          key: 'upper',
          label: `Upper $${selectedUpper.toLocaleString()}`,
          price: selectedUpper,
          className: 'predict-chart__line--range',
        }
      : null,
    spot
      ? {
          key: 'spot',
          label: `Spot $${spot.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
          price: spot,
          className: 'predict-chart__line--spot',
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; price: number; className: string }[]

  const dragLower = drag ? Math.min(drag.start, drag.end) : null
  const dragUpper = drag ? Math.max(drag.start, drag.end) : null
  const dragTop = priceToY(dragUpper)
  const dragBottom = priceToY(dragLower)

  return (
    <div className="predict-chart">
      <div className="predict-chart__header">
        <div>
          <h3 className="sui-predict__card-title">Interactive Position Chart</h3>
          <p className="predict-chart__sub">
            {mode === 'binary' ? 'Binary strike selection' : 'Range strike selection'}
          </p>
        </div>
        <div className="predict-chart__meta">
          {overlaysLoading
            ? 'Loading positions'
            : `${overlays.length} open overlay${overlays.length === 1 ? '' : 's'}`}
        </div>
      </div>
      <div
        className="predict-chart__frame"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div ref={containerRef} className="predict-chart__canvas" />
        <div className="predict-chart__overlay" data-version={plotVersion}>
          {selectedLines.map((line) => {
            const y = priceToY(line.price)
            if (y == null) return null
            return (
              <div
                key={line.key}
                className={`predict-chart__line ${line.className}`}
                style={{ top: y }}
              >
                <span>{line.label}</span>
              </div>
            )
          })}
          {overlays.map((overlay) => {
            if (overlay.kind === 'binary') {
              const y = priceToY(overlay.strike ? overlay.strike / STRIKE_SCALE : null)
              if (y == null) return null
              return (
                <div
                  key={overlay.id}
                  className="predict-chart__line predict-chart__line--position"
                  style={{ top: y }}
                >
                  <span>
                    {overlay.isUp ? 'UP' : 'DOWN'} {formatStrike(overlay.strike || 0)} ·{' '}
                    {overlay.quantity}
                  </span>
                </div>
              )
            }

            const top = priceToY(overlay.upperStrike ? overlay.upperStrike / STRIKE_SCALE : null)
            const bottom = priceToY(overlay.lowerStrike ? overlay.lowerStrike / STRIKE_SCALE : null)
            if (top == null || bottom == null) return null
            return (
              <div
                key={overlay.id}
                className="predict-chart__range-overlay"
                style={{ top, height: Math.max(2, bottom - top) }}
              >
                <span>
                  {formatStrike(overlay.lowerStrike || 0)}-{formatStrike(overlay.upperStrike || 0)}{' '}
                  · {overlay.quantity}
                </span>
              </div>
            )
          })}
          {dragTop != null && dragBottom != null && (
            <div
              className="predict-chart__range-overlay predict-chart__range-overlay--draft"
              style={{ top: dragTop, height: Math.max(2, dragBottom - dragTop) }}
            >
              <span>
                ${dragLower?.toLocaleString()}-${dragUpper?.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
      {overlaysError && <div className="predict-chart__error">{overlaysError}</div>}
    </div>
  )
}
