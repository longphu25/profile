import type { SurfaceColumn } from '../../domain/volSurface'

/**
 * Per-expiry volatility smile (plan 23, S2): IV plotted against strike for the
 * selected expiry column. This is the 1-D slice of the heatmap a trader reads to
 * judge skew - the shape of implied vol across moneyness for one expiry.
 *
 * Custom themeable SVG (same approach as the cockpit king chart): a single IV
 * polyline, a forward marker at log-moneyness 0, and the ATM strike highlighted.
 * Degrades to a defined empty state when the column has no SVI (null IV cells).
 */

const MINT = '#00e0b3'
const FWD = '#7fb0d0'
const GRID = 'rgba(58,74,68,0.5)'
const AXIS_TEXT = 'rgba(185,203,194,0.65)'
const PAD = { top: 18, right: 16, bottom: 28, left: 44 }

function formatIv(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`
}

function formatStrike(strike: number): string {
  return strike >= 1000 ? `${(strike / 1000).toFixed(1)}k` : `${strike}`
}

function formatExpiry(seconds: number): string {
  if (seconds <= 0) return 'expired'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface SmilePoint {
  strike: number
  iv: number
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
  if (!column) {
    return <EmptyState message="Pick an expiry column in the heatmap to see its IV smile." />
  }
  if (column.degraded) {
    return <EmptyState message="This expiry has no SVI surface yet, so its smile is unavailable." />
  }

  const points: SmilePoint[] = column.cells
    .filter((c): c is { strike: number; logMoneyness: number; iv: number } => c.iv != null)
    .map((c) => ({ strike: c.strike, iv: c.iv }))

  if (points.length < 2) {
    return <EmptyState message="Not enough strikes sampled for a smile at this expiry." />
  }

  const W = 320
  const H = 200
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const strikes = points.map((p) => p.strike)
  const ivs = points.map((p) => p.iv)
  const minStrike = Math.min(...strikes)
  const maxStrike = Math.max(...strikes)
  let minIv = Math.min(...ivs)
  let maxIv = Math.max(...ivs)
  const ivSpan = maxIv - minIv || Math.max(0.01, maxIv * 0.05)
  minIv -= ivSpan * 0.15
  maxIv += ivSpan * 0.15
  const strikeSpan = maxStrike - minStrike || 1

  const xAt = (strike: number) => PAD.left + ((strike - minStrike) / strikeSpan) * plotW
  const yAt = (iv: number) => PAD.top + (1 - (iv - minIv) / (maxIv - minIv)) * plotH

  const linePts = points.map((p) => `${xAt(p.strike)},${yAt(p.iv)}`).join(' ')

  // Forward marker: clamp to the plotted strike range so it always renders.
  const fwd = column.forward
  const fwdInRange = fwd >= minStrike && fwd <= maxStrike
  const fwdX = xAt(Math.max(minStrike, Math.min(maxStrike, fwd)))

  // ATM cell: strike nearest the forward (lowest |logMoneyness|).
  const atm = points.reduce((best, p) =>
    Math.abs(p.strike - fwd) < Math.abs(best.strike - fwd) ? p : best,
  )

  const yTicks = [minIv + (maxIv - minIv) * 0.2, minIv + (maxIv - minIv) * 0.8]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label={`IV smile: ATM implied vol ${formatIv(atm.iv)} at strike ${formatStrike(atm.strike)}`}
    >
      {/* Y grid + labels. */}
      {yTicks.map((iv) => (
        <g key={iv}>
          <line
            x1={PAD.left}
            y1={yAt(iv)}
            x2={W - PAD.right}
            y2={yAt(iv)}
            stroke={GRID}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD.left - 6}
            y={yAt(iv) + 3}
            textAnchor="end"
            fontSize="9"
            fill={AXIS_TEXT}
            className="tabular-nums"
          >
            {formatIv(iv)}
          </text>
        </g>
      ))}

      {/* X labels: min / forward / max strike. */}
      <text x={PAD.left} y={H - 8} textAnchor="start" fontSize="9" fill={AXIS_TEXT}>
        {formatStrike(minStrike)}
      </text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="9" fill={AXIS_TEXT}>
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
            vectorEffect="non-scaling-stroke"
          />
          <text x={fwdX} y={PAD.top - 6} textAnchor="middle" fontSize="9" fill={FWD}>
            fwd
          </text>
        </g>
      )}

      {/* Smile polyline. */}
      <polyline
        points={linePts}
        fill="none"
        stroke={MINT}
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* ATM marker. */}
      <circle cx={xAt(atm.strike)} cy={yAt(atm.iv)} r="3" fill={MINT} />
      <text
        x={xAt(atm.strike)}
        y={yAt(atm.iv) - 7}
        textAnchor="middle"
        fontSize="9"
        fill={MINT}
        className="tabular-nums"
      >
        {formatIv(atm.iv)}
      </text>
    </svg>
  )
}
