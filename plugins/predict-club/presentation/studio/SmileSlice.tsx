import { useEffect, useRef, useState } from 'react'
import { type SVIParams, totalVarianceAtLogMoneyness } from '../../domain/payoutPreview'
import type { SurfaceColumn } from '../../domain/volSurface'

/**
 * Per-expiry volatility smile (plan 23, S2): IV plotted against strike for the
 * selected expiry column. This is the 1-D slice of the heatmap a trader reads to
 * judge skew - the shape of implied vol across moneyness for one expiry.
 *
 * Custom themeable SVG (same approach as the cockpit king chart, no chart lib).
 * The curve is resampled densely straight off the SVI total-variance function, so
 * it renders as the smooth smile SVI actually is, not a jagged polyline through the
 * dozen sampled strikes. The SVG is drawn in real pixel space (a ResizeObserver
 * feeds it the container size) so circles stay round and slopes keep their true
 * aspect - no preserveAspectRatio stretching. Degrades to a defined empty state
 * when the column has no SVI.
 */

const MINT = '#00e0b3'
const FWD = '#7fb0d0'
const GRID = 'rgba(58,74,68,0.5)'
const AXIS_TEXT = 'rgba(185,203,194,0.65)'
const PAD = { top: 20, right: 16, bottom: 28, left: 46 }
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
const CURVE_SAMPLES = 96

function formatIv(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`
}

function formatStrike(strike: number): string {
  return `$${Math.round(strike).toLocaleString('en-US')}`
}

function formatExpiry(seconds: number): string {
  if (seconds <= 0) return 'expired'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Annualized IV at an arbitrary strike, straight off the column's SVI curve. This
// is the same math the sampler uses per cell, evaluated at a continuum of strikes
// so the drawn smile is the real curve and not a coarse interpolation.
function ivAtStrike(svi: SVIParams, forward: number, secondsToExpiry: number, strike: number) {
  if (forward <= 0 || secondsToExpiry <= 0 || strike <= 0) return null
  const w = totalVarianceAtLogMoneyness(svi, Math.log(strike / forward))
  if (!Number.isFinite(w) || w <= 0) return null
  const iv = Math.sqrt(w / (secondsToExpiry / SECONDS_PER_YEAR))
  return Number.isFinite(iv) ? iv : null
}

// Track the rendered pixel size of the plot host so the SVG can draw 1:1 (no
// viewBox stretching that would distort the marker and slopes).
function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-sm p-md text-center">
      <span
        className="material-symbols-outlined text-[28px] text-on-surface-variant"
        aria-hidden="true"
      >
        show_chart
      </span>
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        Smile slice
      </span>
      <span className="max-w-[20rem] font-data text-data-sm text-on-surface-variant">
        {message}
      </span>
    </div>
  )
}

export function SmileSlice({
  column,
  className = '',
}: {
  column: SurfaceColumn | null
  className?: string
}) {
  return (
    <section
      data-pc-studio-smile
      aria-label="Smile slice"
      className={`flex min-h-0 flex-col bg-surface-container-lowest ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between px-md py-sm">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          IV smile
        </span>
        {column && (
          <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
            {formatExpiry(column.secondsToExpiry)} expiry
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 px-sm pb-sm">
        <SmileBody column={column} />
      </div>
    </section>
  )
}

function SmileBody({ column }: { column: SurfaceColumn | null }) {
  const [hostRef, { width, height }] = useElementSize()

  if (!column) {
    return <EmptyState message="Pick an expiry column in the heatmap to see its IV smile." />
  }
  if (column.degraded || !column.svi) {
    return <EmptyState message="This expiry has no SVI surface yet, so its smile is unavailable." />
  }

  // The drawn strike range comes from the sampled cells (the heatmap's band), but
  // the curve itself is resampled densely off the SVI function across that range.
  const sampledStrikes = column.cells.filter((c) => c.iv != null).map((c) => c.strike)
  if (sampledStrikes.length < 2) {
    return <EmptyState message="Not enough strikes sampled for a smile at this expiry." />
  }

  return (
    <div ref={hostRef} className="h-full w-full">
      {width > 0 && height > 0 && (
        <SmileChart
          svi={column.svi}
          forward={column.forward}
          secondsToExpiry={column.secondsToExpiry}
          minStrike={Math.min(...sampledStrikes)}
          maxStrike={Math.max(...sampledStrikes)}
          width={width}
          height={height}
        />
      )}
    </div>
  )
}

function SmileChart({
  svi,
  forward,
  secondsToExpiry,
  minStrike,
  maxStrike,
  width,
  height,
}: {
  svi: SVIParams
  forward: number
  secondsToExpiry: number
  minStrike: number
  maxStrike: number
  width: number
  height: number
}) {
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const plotH = Math.max(1, height - PAD.top - PAD.bottom)
  const strikeSpan = maxStrike - minStrike || 1

  // Dense resample of the SVI curve across the strike range: this is what makes the
  // smile read as the smooth curve it is rather than a jagged join of sparse cells.
  const curve: { strike: number; iv: number }[] = []
  for (let i = 0; i < CURVE_SAMPLES; i += 1) {
    const strike = minStrike + (strikeSpan * i) / (CURVE_SAMPLES - 1)
    const iv = ivAtStrike(svi, forward, secondsToExpiry, strike)
    if (iv != null) curve.push({ strike, iv })
  }
  if (curve.length < 2) {
    return <EmptyState message="Not enough strikes sampled for a smile at this expiry." />
  }

  const ivs = curve.map((p) => p.iv)
  let minIv = Math.min(...ivs)
  let maxIv = Math.max(...ivs)
  const ivSpan = maxIv - minIv || Math.max(0.01, maxIv * 0.05)
  minIv -= ivSpan * 0.18
  maxIv += ivSpan * 0.18

  const xAt = (strike: number) => PAD.left + ((strike - minStrike) / strikeSpan) * plotW
  const yAt = (iv: number) => PAD.top + (1 - (iv - minIv) / (maxIv - minIv)) * plotH

  const linePts = curve.map((p) => `${xAt(p.strike).toFixed(2)},${yAt(p.iv).toFixed(2)}`).join(' ')
  const areaPts = `${PAD.left},${PAD.top + plotH} ${linePts} ${PAD.left + plotW},${PAD.top + plotH}`

  // Forward marker + ATM point sampled exactly at the forward.
  const fwdInRange = forward >= minStrike && forward <= maxStrike
  const fwdX = xAt(Math.max(minStrike, Math.min(maxStrike, forward)))
  const atmIv = ivAtStrike(svi, forward, secondsToExpiry, forward)

  const yTicks = [minIv + (maxIv - minIv) * 0.2, minIv + (maxIv - minIv) * 0.8]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label={
        atmIv != null
          ? `IV smile: ATM implied vol ${formatIv(atmIv)} at forward ${formatStrike(forward)}`
          : 'IV smile'
      }
    >
      <defs>
        <linearGradient id="pc-smile-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MINT} stopOpacity="0.18" />
          <stop offset="100%" stopColor={MINT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y grid + labels. */}
      {yTicks.map((iv) => (
        <g key={iv}>
          <line
            x1={PAD.left}
            y1={yAt(iv)}
            x2={width - PAD.right}
            y2={yAt(iv)}
            stroke={GRID}
            strokeWidth="1"
          />
          <text
            x={PAD.left - 8}
            y={yAt(iv) + 3}
            textAnchor="end"
            fontSize="10"
            fill={AXIS_TEXT}
            className="tabular-nums"
          >
            {formatIv(iv)}
          </text>
        </g>
      ))}

      {/* X labels: min / max strike. */}
      <text
        x={PAD.left}
        y={height - 8}
        textAnchor="start"
        fontSize="10"
        fill={AXIS_TEXT}
        className="tabular-nums"
      >
        {formatStrike(minStrike)}
      </text>
      <text
        x={width - PAD.right}
        y={height - 8}
        textAnchor="end"
        fontSize="10"
        fill={AXIS_TEXT}
        className="tabular-nums"
      >
        {formatStrike(maxStrike)}
      </text>

      {/* Forward vertical marker. */}
      {fwdInRange && (
        <g>
          <line
            x1={fwdX}
            y1={PAD.top}
            x2={fwdX}
            y2={PAD.top + plotH}
            stroke={FWD}
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text x={fwdX} y={PAD.top - 7} textAnchor="middle" fontSize="10" fill={FWD}>
            fwd
          </text>
        </g>
      )}

      {/* Area fill under the curve, then the smile curve. */}
      <polygon points={areaPts} fill="url(#pc-smile-fill)" stroke="none" />
      <polyline
        points={linePts}
        fill="none"
        stroke={MINT}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ATM marker at the forward. */}
      {fwdInRange && atmIv != null && (
        <g>
          <circle cx={fwdX} cy={yAt(atmIv)} r="3.5" fill={MINT} />
          <text
            x={fwdX}
            y={yAt(atmIv) - 9}
            textAnchor="middle"
            fontSize="10"
            fill={MINT}
            className="tabular-nums"
          >
            {formatIv(atmIv)}
          </text>
        </g>
      )}
    </svg>
  )
}
