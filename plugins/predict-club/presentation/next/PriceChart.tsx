import { useEffect, useMemo, useRef, useState } from 'react'
import { usePredictClub } from '../usePredictClub'
import { secondsToSettlement, formatTimer } from '../../domain/roundPhase'
import { formatUsd } from '../shared'

/**
 * King chart (C1) for the rebuilt cockpit: a custom, fully themeable SVG area
 * chart of the selected oracle's recent spot series. It is the dominant zone, so
 * it carries the round's strike line, the current-price marker, and (only when
 * truthful) the settlement countdown.
 *
 * Why custom SVG and not a chart library: decision 8 of plan 22. We own a small,
 * fast, on-brand component instead of bending lightweight-charts to the Terminal
 * palette. Coordinates are computed in real pixels (via ResizeObserver) so axis
 * and price labels stay crisp - `preserveAspectRatio="none"` would distort text.
 *
 * Truthful countdown: `secondsToSettlement` returns a number ONLY when the round
 * is `executed` with a future oracle expiry, so a fabricated timer never shows.
 */

const PAD = { top: 16, right: 64, bottom: 22, left: 8 } as const
const MINT = '#00e0b3'
const RED = '#ff5d73'
const FWD = '#7fb0d0'
const GRID = 'rgba(58, 74, 68, 0.5)'
const AXIS_TEXT = 'rgba(185, 203, 194, 0.65)'

/** Re-render once per second, but only while a live deadline needs ticking. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/** Track the chart container's pixel size so the SVG renders crisp at any width. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ w: box.width, h: box.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export function PriceChart() {
  const { oracleSnapshot, club } = usePredictClub()
  const wrapRef = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(wrapRef)

  const round = club.activeRound
  const status = round.status
  const strike = round.strike > 0 ? round.strike : null
  const expiryMs = oracleSnapshot.oracleState?.expiry ?? null

  const countdownActive = status === 'executed'
  const now = useNow(countdownActive)
  const countdownSeconds = secondsToSettlement({
    status,
    oracleExpiryMs: expiryMs,
    nowMs: now,
  })

  const { series, fwdSeries } = useMemo(() => {
    const spot: number[] = []
    const fwd: number[] = []
    for (const p of oracleSnapshot.prices) {
      if (!Number.isFinite(p.spot) || p.spot <= 0) continue
      spot.push(p.spot)
      fwd.push(Number.isFinite(p.forward) && p.forward > 0 ? p.forward : p.spot)
    }
    return { series: spot, fwdSeries: fwd }
  }, [oracleSnapshot.prices])
  const latest = series.length > 0 ? series[series.length - 1] : null
  const latestFwd = fwdSeries.length > 0 ? fwdSeries[fwdSeries.length - 1] : null
  const rising = series.length >= 2 ? series[series.length - 1] >= series[0] : true
  const stroke = rising ? MINT : RED

  const asset = oracleSnapshot.oracleState?.underlying_asset ?? round.market ?? 'BTC'

  if (series.length < 2) {
    return (
      <div
        ref={wrapRef}
        data-pc-chart-canvas
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 bg-surface-container-lowest text-center"
      >
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">
          show_chart
        </span>
        <span className="font-data text-data-sm text-on-surface-variant/50">
          Collecting live prices for {asset}
        </span>
      </div>
    )
  }

  // Y range tracks the PRICE SERIES (spot + forward) only (like the old
  // OrderFlowChart), so small intrabar moves stay readable. Forcing the strike in
  // would flatten the series whenever the strike sits far from spot; instead an
  // off-range strike is shown as a clamped edge marker below.
  let min = Math.min(...series, ...fwdSeries)
  let max = Math.max(...series, ...fwdSeries)
  const span = max - min || Math.max(1, max * 0.001)
  min -= span * 0.12
  max += span * 0.12

  const plotW = Math.max(0, w - PAD.left - PAD.right)
  const plotH = Math.max(0, h - PAD.top - PAD.bottom)
  const xAt = (i: number) => PAD.left + (i / (series.length - 1)) * plotW
  const yAt = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH

  const linePts = series.map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`).join(' ')
  const fwdPts = fwdSeries.map((v, i) => `${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`).join(' ')
  const areaPts = `${PAD.left},${(PAD.top + plotH).toFixed(2)} ${linePts} ${(PAD.left + plotW).toFixed(2)},${(PAD.top + plotH).toFixed(2)}`

  // 3 horizontal gridlines at 25/50/75% of the range, labeled with the price.
  const gridVals = [0.25, 0.5, 0.75].map((t) => min + (max - min) * t)
  const latestY = latest != null ? yAt(latest) : 0
  const strikeAbove = strike != null && strike > max
  const strikeBelow = strike != null && strike < min
  const strikeOffRange = strikeAbove || strikeBelow
  // Clamp an off-range strike to the nearest plot edge so its marker stays visible.
  const strikeY =
    strike == null ? 0 : strikeAbove ? PAD.top : strikeBelow ? PAD.top + plotH : yAt(strike)
  const ready = w > 0 && h > 0

  return (
    <div
      ref={wrapRef}
      data-pc-chart-canvas
      className="relative h-full min-h-0 w-full bg-surface-container-lowest"
    >
      {ready && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="block"
          role="img"
          aria-label={`${asset} spot price, ${rising ? 'rising' : 'falling'}, current ${latest != null ? formatUsd(latest) : 'unknown'}`}
        >
          <defs>
            <linearGradient id="pc-king-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines + right-edge price labels */}
          {gridVals.map((v) => {
            const y = yAt(v)
            return (
              <g key={v}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + plotW}
                  y2={y}
                  stroke={GRID}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
                <text
                  x={w - PAD.right + 6}
                  y={y + 3}
                  fill={AXIS_TEXT}
                  className="font-data"
                  fontSize="10"
                >
                  {formatUsd(v)}
                </text>
              </g>
            )
          })}

          {/* Area + line */}
          <polygon points={areaPts} fill="url(#pc-king-fill)" />
          {/* Forward curve (dashed, drawn under spot) when it diverges from spot. */}
          {fwdPts && (
            <polyline
              points={fwdPts}
              fill="none"
              stroke={FWD}
              strokeWidth="1.25"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}
          <polyline
            points={linePts}
            fill="none"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Strike reference. In-range: a dashed line across the plot. Off-range:
              the line is clamped to the nearest edge and the label carries a caret
              so the strike is never drawn at a price the series never reached. */}
          {strike != null && (
            <g opacity={strikeOffRange ? 0.65 : 1}>
              <line
                x1={PAD.left}
                y1={strikeY}
                x2={PAD.left + plotW}
                y2={strikeY}
                stroke={AXIS_TEXT}
                strokeWidth="1"
                strokeDasharray="5 4"
              />
              <rect
                x={w - PAD.right + 2}
                y={strikeY - 8}
                width={PAD.right - 4}
                height="16"
                rx="2"
                fill="#232c28"
              />
              <text
                x={w - PAD.right + 6}
                y={strikeY + 3}
                fill={AXIS_TEXT}
                className="font-data"
                fontSize="10"
              >
                {strikeAbove ? '▲ ' : strikeBelow ? '▼ ' : ''}
                {formatUsd(strike)}
              </text>
            </g>
          )}

          {/* Current price marker + pill */}
          {latest != null && (
            <g>
              <circle cx={PAD.left + plotW} cy={latestY} r="3" fill={stroke} />
              <rect
                x={w - PAD.right + 2}
                y={latestY - 9}
                width={PAD.right - 4}
                height="18"
                rx="2"
                fill={stroke}
              />
              <text
                x={w - PAD.right + 6}
                y={latestY + 4}
                fill="#07100d"
                className="font-data"
                fontSize="11"
                fontWeight="700"
              >
                {formatUsd(latest)}
              </text>
            </g>
          )}

          {/* Forward end marker (hollow), only when it diverges from spot. */}
          {latestFwd != null && latest != null && Math.abs(latestFwd - latest) > span * 0.02 && (
            <circle
              cx={PAD.left + plotW}
              cy={yAt(latestFwd)}
              r="3"
              fill="none"
              stroke={FWD}
              strokeWidth="1.5"
            />
          )}
        </svg>
      )}

      {/* Header overlay: asset + current spot + legend (top-left). */}
      <div className="pointer-events-none absolute left-md top-sm flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-headline-md font-black tracking-tight text-on-surface">
            {asset}
          </span>
          {latest != null && (
            <span
              className="font-data text-data-lg font-bold tabular-nums"
              style={{ color: stroke }}
            >
              ${formatUsd(latest)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-md font-label text-label-caps uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: stroke }} />
            <span className="text-on-surface-variant">
              Spot {latest != null ? `$${formatUsd(latest)}` : '-'}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-3 border-t border-dashed"
              style={{ borderColor: FWD }}
              aria-hidden="true"
            />
            <span className="text-on-surface-variant">
              Forward {latestFwd != null ? `$${formatUsd(latestFwd)}` : '-'}
            </span>
          </span>
        </div>
      </div>

      {/* Truthful countdown overlay (top-right) — only while live. */}
      {countdownSeconds != null && (
        <div className="pointer-events-none absolute right-md top-sm flex items-center gap-1.5 rounded bg-surface-container-high/90 px-2 py-1">
          <span
            className="material-symbols-outlined text-[14px] text-primary-fixed-dim"
            aria-hidden="true"
          >
            timer
          </span>
          <span className="font-data text-data-sm font-bold tabular-nums text-on-surface">
            {formatTimer(countdownSeconds)}
          </span>
        </div>
      )}
    </div>
  )
}
