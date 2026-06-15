import { useEffect, useRef, useState } from 'react'
import { type SVIParams, totalVarianceAtLogMoneyness } from '../../domain/payoutPreview'
import type { MispriceCell, SurfaceColumn } from '../../domain/volSurface'

/**
 * Per-expiry volatility smile (plan 23, S2): IV plotted against strike for the
 * selected expiry column. This is the 1-D slice of the heatmap a trader reads to
 * judge skew - the shape of implied vol across moneyness for one expiry.
 *
 * A one-line plain-language read sits above the chart so the panel is useful even
 * at a glance. The chart is a custom themeable SVG (same approach as the cockpit
 * king chart, no chart lib): the curve is resampled densely straight off the SVI
 * total-variance function, so it renders as the smooth smile SVI actually is, not
 * a jagged polyline through the dozen sampled strikes. It is drawn in real pixel
 * space (a ResizeObserver feeds it the container size) so circles stay round and
 * slopes keep their true aspect. Degrades to a defined empty state with no SVI.
 */

const MINT = '#00e0b3'
const FWD = '#7fb0d0'
const GRID = 'rgba(58,74,68,0.5)'
const AXIS_TEXT = 'rgba(185,203,194,0.65)'
// BUY = contract cheaper than the model (edge < 0), so the side is underpriced and
// worth buying; SELL = contract richer (edge > 0), worth selling. Green/red is paired
// with a BUY/SELL word + arrow so the signal never rides on color alone (colorblind-safe).
const BUY = '#34d399'
const SELL = '#ff5d73'
const PAD = { top: 20, right: 16, bottom: 28, left: 46 }
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
const CURVE_SAMPLES = 96
const SKEW_FLAT_PTS = 0.5
// Below this absolute edge (in win-probability points) the contract and model agree
// closely enough that we offer no BUY/SELL flag - matches the cockpit's edge band.
const EDGE_FLAG_EPS = 0.01

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

interface SmileStats {
  atmIv: number | null
  lowIv: number | null
  highIv: number | null
  minStrike: number
  maxStrike: number
  skewPts: number | null
}

// One read of the smile: ATM vol, the wings (low/high strike IV), and the skew in
// vol points (downside minus upside). Positive skew = downside vol richer.
function smileStats(column: SurfaceColumn): SmileStats | null {
  if (!column.svi) return null
  const sampled = column.cells.filter((c) => c.iv != null).map((c) => c.strike)
  if (sampled.length < 2) return null
  const minStrike = Math.min(...sampled)
  const maxStrike = Math.max(...sampled)
  const { svi, forward, secondsToExpiry } = column
  const atmIv = ivAtStrike(svi, forward, secondsToExpiry, forward)
  const lowIv = ivAtStrike(svi, forward, secondsToExpiry, minStrike)
  const highIv = ivAtStrike(svi, forward, secondsToExpiry, maxStrike)
  const skewPts = lowIv != null && highIv != null ? (lowIv - highIv) * 100 : null
  return { atmIv, lowIv, highIv, minStrike, maxStrike, skewPts }
}

// An actionable edge flag on the smile: the strike, which side reads BUY or SELL,
// and the signed edge in win-probability points (contract - model). Drawn as a
// colored, labeled marker on the curve so a trader sees where the model and the
// contract disagree, not just the smile shape.
interface EdgeMarker {
  strike: number
  side: 'BUY' | 'SELL'
  edge: number
  /** SVI fair-value win probability (model), for the legend read. */
  fair: number | null
  /** Contract-implied win probability (devInspect quote), for the legend read. */
  contract: number | null
}

// Pick the single best BUY and best SELL strike out of the quoted ATM band. BUY =
// contract cheaper than the model (edge < 0, underpriced); SELL = contract richer
// (edge > 0). Only the most extreme each side is flagged so the small chart stays
// readable, and only when the gap clears EDGE_FLAG_EPS (otherwise the two agree).
function edgeMarkers(cells: MispriceCell[]): EdgeMarker[] {
  let bestBuy: EdgeMarker | null = null
  let bestSell: EdgeMarker | null = null
  for (const c of cells) {
    if (c.edge == null || Math.abs(c.edge) < EDGE_FLAG_EPS) continue
    if (c.edge < 0 && (bestBuy == null || c.edge < bestBuy.edge)) {
      bestBuy = {
        strike: c.strike,
        side: 'BUY',
        edge: c.edge,
        fair: c.fairProbability,
        contract: c.contractProbability,
      }
    } else if (c.edge > 0 && (bestSell == null || c.edge > bestSell.edge)) {
      bestSell = {
        strike: c.strike,
        side: 'SELL',
        edge: c.edge,
        fair: c.fairProbability,
        contract: c.contractProbability,
      }
    }
  }
  return [bestBuy, bestSell].filter((m): m is EdgeMarker => m != null)
}

// A plain-language read of the smile for the description line above the chart.
function smileDescription(stats: SmileStats): string {
  if (stats.atmIv == null) return 'Implied vol across strikes for this expiry.'
  const atm = formatIv(stats.atmIv)
  if (stats.skewPts == null) return `At-the-money implied vol is ${atm} for this expiry.`
  const mag = Math.abs(stats.skewPts).toFixed(1)
  if (stats.skewPts > SKEW_FLAT_PTS) {
    return `ATM vol ${atm}. Downside strikes price ${mag} vol points richer than upside - the market is paying up for protection.`
  }
  if (stats.skewPts < -SKEW_FLAT_PTS) {
    return `ATM vol ${atm}. Upside strikes price ${mag} vol points richer than downside - demand is skewed to calls.`
  }
  return `ATM vol ${atm}. Wings are within ${mag} vol points of each other - a near-symmetric smile.`
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
  mispriceCells = [],
  className = '',
}: {
  column: SurfaceColumn | null
  mispriceCells?: MispriceCell[]
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const stats = column && !column.degraded ? smileStats(column) : null
  // Edge flags only apply to the selected column's quoted ATM band; ignore quotes
  // from any other column so a stale set never paints the wrong smile.
  const markers =
    column && stats ? edgeMarkers(mispriceCells.filter((c) => c.oracleId === column.oracleId)) : []

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
        <div className="flex items-center gap-sm">
          {column && (
            <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
              {formatExpiry(column.secondsToExpiry)} expiry
            </span>
          )}
          {stats && (
            <button
              type="button"
              data-pc-studio-smile-expand
              onClick={() => setExpanded(true)}
              aria-label="Expand smile detail"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-on-surface-variant outline-none transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-fixed"
            >
              <span
                className="material-symbols-outlined text-[18px] leading-none"
                aria-hidden="true"
              >
                open_in_full
              </span>
            </button>
          )}
        </div>
      </header>

      {!column ? (
        <div className="min-h-0 flex-1 px-md pb-md">
          <EmptyState message="Pick an expiry column in the heatmap to see its IV smile." />
        </div>
      ) : column.degraded || !column.svi ? (
        <div className="min-h-0 flex-1 px-md pb-md">
          <EmptyState message="This expiry has no SVI surface yet, so its smile is unavailable." />
        </div>
      ) : !stats ? (
        <div className="min-h-0 flex-1 px-md pb-md">
          <EmptyState message="Not enough strikes sampled for a smile at this expiry." />
        </div>
      ) : (
        <>
          <p className="shrink-0 px-md pb-sm font-data text-data-sm leading-snug text-on-surface-variant">
            {smileDescription(stats)}
          </p>
          {markers.length > 0 && <EdgeLegend markers={markers} />}
          {/* Cap the chart height so the smile reads at a natural aspect instead of
              stretching tall and sparse to fill the panel; the curve stays compact and
              legible, and the expand button opens the full-size modal for detail. */}
          <div className="min-h-0 flex-1 px-sm pb-sm">
            <div className="mx-auto h-full max-h-[14rem] w-full">
              <SmileChartHost column={column} stats={stats} markers={markers} />
            </div>
          </div>
        </>
      )}

      {expanded && column?.svi && stats && (
        <SmileModal
          column={column}
          stats={stats}
          markers={markers}
          onClose={() => setExpanded(false)}
        />
      )}
    </section>
  )
}

function SmileModal({
  column,
  stats,
  markers,
  onClose,
}: {
  column: SurfaceColumn
  stats: SmileStats
  markers: EdgeMarker[]
  onClose: () => void
}) {
  const [hostRef, { width, height }] = useElementSize()
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-pc-studio-smile-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-lg backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`IV smile, ${formatExpiry(column.secondsToExpiry)} expiry`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-[44rem] flex-col gap-sm rounded-md bg-surface-container-lowest p-md shadow-lg outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-md">
          <div className="flex flex-col gap-px">
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              IV smile - {formatExpiry(column.secondsToExpiry)} expiry
            </span>
            <span className="font-data text-data-sm leading-snug text-on-surface-variant">
              {smileDescription(stats)}
            </span>
          </div>
          <button
            type="button"
            data-pc-studio-smile-close
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-on-surface-variant outline-none transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-fixed"
          >
            <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        <div ref={hostRef} className="min-h-[20rem] flex-1">
          {width > 0 && height > 0 && (
            <SmileChart
              svi={column.svi as SVIParams}
              forward={column.forward}
              secondsToExpiry={column.secondsToExpiry}
              minStrike={stats.minStrike}
              maxStrike={stats.maxStrike}
              markers={markers}
              width={width}
              height={height}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-md px-px font-data text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: MINT }} />
            IV curve
          </span>
          <span className="flex items-center gap-1">
            <span
              className="h-[2px] w-4 rounded-full"
              style={{ backgroundColor: FWD, opacity: 0.8 }}
            />
            forward (ATM)
          </span>
          <span className="tabular-nums">
            Wings: {stats.lowIv != null ? formatIv(stats.lowIv) : '-'} /{' '}
            {stats.highIv != null ? formatIv(stats.highIv) : '-'}
          </span>
        </footer>
      </div>
    </div>
  )
}

function SmileChartHost({
  column,
  stats,
  markers,
}: {
  column: SurfaceColumn
  stats: SmileStats
  markers: EdgeMarker[]
}) {
  const [hostRef, { width, height }] = useElementSize()
  return (
    <div ref={hostRef} className="h-full w-full">
      {width > 0 && height > 0 && (
        <SmileChart
          svi={column.svi as SVIParams}
          forward={column.forward}
          secondsToExpiry={column.secondsToExpiry}
          minStrike={stats.minStrike}
          maxStrike={stats.maxStrike}
          markers={markers}
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
  markers,
  width,
  height,
}: {
  svi: SVIParams
  forward: number
  secondsToExpiry: number
  minStrike: number
  maxStrike: number
  markers: EdgeMarker[]
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
  // Where the ATM % label sits (above the forward point). Edge flags that land near
  // the forward must clear this so the SELL word never paints over the ATM number.
  const atmLabelY = fwdInRange && atmIv != null ? yAt(atmIv) - 9 : null

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

      {/* BUY / SELL edge flags: where the contract and model most disagree in the
          quoted band. Each is a small dot on the curve plus an opaque pill carrying
          the side word AND the edge in win-prob points, so the flag reads regardless
          of the gradient underneath (the old green word was lost against the teal
          fill) and the signal never rides on color alone. BUY (green) = contract
          cheaper than model; SELL (red) = richer. The pill is clamped inside the plot
          so the small chart never clips it, and a SELL pill near the forward flips
          below its dot so it does not cover the ATM % label. */}
      {markers.map((m) => {
        const iv = ivAtStrike(svi, forward, secondsToExpiry, m.strike)
        if (iv == null || m.strike < minStrike || m.strike > maxStrike) return null
        const mx = xAt(m.strike)
        const my = yAt(iv)
        const color = m.side === 'BUY' ? BUY : SELL
        const pts = (Math.abs(m.edge) * 100).toFixed(1)
        const arrow = m.side === 'BUY' ? '▼' : '▲'
        const label = `${arrow} ${m.side} ${pts}pt`
        const pillH = 13
        const pillW = label.length * 5.0 + 8
        // SELL sits above the dot, BUY below, so the two flags never stack. A SELL pill
        // near the forward would cover the ATM % label (also above the forward), so flip
        // it below when it lands within ~28px horizontally of the forward.
        let above = m.side === 'SELL'
        if (above && atmLabelY != null && Math.abs(mx - fwdX) < 28) above = false
        const gap = 7
        let pillCy = above ? my - gap - pillH / 2 : my + gap + pillH / 2
        const minCy = PAD.top + pillH / 2 + 1
        const maxCy = PAD.top + plotH - pillH / 2 - 1
        pillCy = Math.max(minCy, Math.min(maxCy, pillCy))
        let pillX = mx - pillW / 2
        pillX = Math.max(PAD.left + 1, Math.min(PAD.left + plotW - pillW - 1, pillX))
        return (
          <g key={`${m.side}-${m.strike}`}>
            <circle cx={mx} cy={my} r="3" fill={color} stroke="#04140f" strokeWidth="1" />
            <rect
              x={pillX}
              y={pillCy - pillH / 2}
              width={pillW}
              height={pillH}
              rx="3"
              fill={color}
            />
            <text
              x={pillX + pillW / 2}
              y={pillCy + 3.1}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#04140f"
              className="uppercase tabular-nums"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function formatProb(p: number | null): string {
  return p == null ? '-' : `${(p * 100).toFixed(0)}%`
}

// A richer, screen-reader-friendly read of the BUY/SELL flags above the chart, so the
// signal is legible without parsing the SVG and explains WHY it fires. Each card names
// the side + strike, then prints the model fair win-probability against the contract's
// implied probability (the two numbers whose gap IS the edge), and the signed edge in
// win-probability points. BUY (green) = contract cheaper than the model (underpriced);
// SELL (red) = richer. The number pair never rides on color alone.
function EdgeLegend({ markers }: { markers: EdgeMarker[] }) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-stretch gap-sm px-md pb-sm"
      role="list"
      aria-label="Mispricing edge flags"
    >
      {markers.map((m) => {
        const color = m.side === 'BUY' ? BUY : SELL
        const pts = (Math.abs(m.edge) * 100).toFixed(1)
        const verb = m.side === 'BUY' ? 'cheaper than' : 'richer than'
        return (
          <div
            key={`${m.side}-${m.strike}`}
            role="listitem"
            className="flex flex-col gap-px rounded-sm border-l-2 px-sm py-1"
            style={{ backgroundColor: `${color}1a`, borderColor: color }}
            aria-label={`${m.side} ${formatStrike(m.strike)}: model ${formatProb(m.fair)}, contract ${formatProb(m.contract)}, ${verb} model by ${pts} points`}
          >
            <span
              className="flex items-center gap-1 font-label text-[10px] uppercase tracking-wide"
              style={{ color }}
            >
              <span
                className="material-symbols-outlined text-[12px] leading-none"
                aria-hidden="true"
              >
                {m.side === 'BUY' ? 'trending_down' : 'trending_up'}
              </span>
              {m.side} {formatStrike(m.strike)}
            </span>
            <span className="flex items-center gap-2 font-data text-[10px] tabular-nums text-on-surface-variant">
              <span aria-hidden="true">
                model <span className="text-on-surface">{formatProb(m.fair)}</span>
              </span>
              <span aria-hidden="true">
                contract <span className="text-on-surface">{formatProb(m.contract)}</span>
              </span>
              <span aria-hidden="true" className="font-semibold" style={{ color }}>
                {m.edge > 0 ? '+' : '-'}
                {pts}pt
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
