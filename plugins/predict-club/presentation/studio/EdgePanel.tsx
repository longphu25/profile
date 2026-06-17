import type { ReactNode } from 'react'
import type { ArbReport } from '../../application/arbFreeCheck'
import type { MispriceCell, RealizedVol, SurfaceColumn } from '../../domain/volSurface'

/**
 * Trader edge panel (plan 23, S2-S4).
 *
 * S2 fills the first edge row: ATM implied vol vs realized vol, shown as a signed,
 * labelled spread (never color alone). Mispricing (S3) and arb-free health (S4)
 * slot in below as further rows. Every number is either live or a defined
 * unavailable state - no fabricated zeros.
 */

function formatVol(value: number | null): string {
  return value == null ? '-' : `${(value * 100).toFixed(1)}%`
}

/** ATM IV for a column: the cell whose strike is nearest the forward. */
function atmIv(column: SurfaceColumn | null): number | null {
  if (!column || column.degraded) return null
  const withIv = column.cells.filter(
    (c): c is { strike: number; logMoneyness: number; iv: number } => c.iv != null,
  )
  if (withIv.length === 0) return null
  const atm = withIv.reduce((best, c) =>
    Math.abs(c.logMoneyness) < Math.abs(best.logMoneyness) ? c : best,
  )
  return atm.iv
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-md px-md py-sm">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="font-data text-data-sm tabular-nums text-on-surface">{children}</span>
    </div>
  )
}

export function EdgePanel({
  column,
  realized,
  mispriceCells,
  mispriceLoading,
  arbReport,
  className = '',
}: {
  column: SurfaceColumn | null
  realized: RealizedVol | null
  mispriceCells: MispriceCell[]
  mispriceLoading: boolean
  arbReport: ArbReport
  className?: string
}) {
  const iv = atmIv(column)
  const rv = realized?.value ?? null
  const spread = iv != null && rv != null ? iv - rv : null

  // Spread sign drives a bias label (IV rich = options expensive vs realized).
  const spreadLabel =
    spread == null ? 'unavailable' : spread > 0 ? 'IV rich' : spread < 0 ? 'IV cheap' : 'flat'
  const spreadColor =
    spread == null
      ? 'text-on-surface-variant'
      : spread > 0
        ? 'text-primary-fixed-dim'
        : spread < 0
          ? 'text-error'
          : 'text-on-surface-variant'
  const spreadSign = spread != null && spread > 0 ? '+' : ''

  return (
    <section
      data-pc-studio-edge
      aria-label="Trader edge"
      className={`flex min-h-0 flex-col bg-surface-container-lowest ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between px-md py-sm">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          Edge
        </span>
        {realized && realized.windowMinutes > 0 && (
          <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
            RV {realized.windowMinutes}m window
          </span>
        )}
      </header>

      <div className="flex flex-col gap-px bg-outline-variant">
        <Row label="ATM IV">{formatVol(iv)}</Row>
        <Row label="Realized vol">
          {rv == null ? (
            <span className="text-on-surface-variant">
              {realized && realized.sampleCount > 0 ? '-' : 'unavailable'}
            </span>
          ) : (
            formatVol(rv)
          )}
        </Row>
        <Row label="IV - RV spread">
          <span className={`flex items-center gap-sm ${spreadColor}`}>
            <span>{spread == null ? '-' : `${spreadSign}${(spread * 100).toFixed(1)}%`}</span>
            <span className="font-label text-label-caps uppercase tracking-wide">
              {spreadLabel}
            </span>
          </span>
        </Row>
        <Row label="Surface health">
          <SurfaceHealth report={arbReport} />
        </Row>
      </div>

      <MispricingLadder cells={mispriceCells} loading={mispriceLoading} forward={column?.forward} />
    </section>
  )
}

function fmtProb(p: number | null): string {
  return p == null ? '-' : `${(p * 100).toFixed(1)}%`
}

/**
 * Surface health (S4): the arb-free verdict for the whole grid. Clean = mint check;
 * violations = error count + icon + label (never color alone); not-checked when no
 * column carries usable SVI yet. The per-cell locations are flagged on the heatmap.
 */
function SurfaceHealth({ report }: { report: ArbReport }) {
  if (!report.butterflyChecked && !report.calendarChecked) {
    return (
      <span className="flex items-center gap-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          remove
        </span>
        <span className="font-label text-label-caps uppercase tracking-wide">not checked</span>
      </span>
    )
  }
  const count = report.violations.length
  if (count === 0) {
    return (
      <span className="flex items-center gap-sm text-primary-fixed-dim">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          check_circle
        </span>
        <span className="font-label text-label-caps uppercase tracking-wide">arb-free</span>
      </span>
    )
  }
  const butterfly = report.violations.filter((v) => v.rule === 'butterfly').length
  const calendar = count - butterfly
  const parts = [
    butterfly > 0 ? `${butterfly} butterfly` : null,
    calendar > 0 ? `${calendar} calendar` : null,
  ].filter(Boolean)
  return (
    <span className="flex items-center gap-sm text-error" title={parts.join(', ')}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
        warning
      </span>
      <span className="font-label text-label-caps uppercase tracking-wide">
        {count} violation{count === 1 ? '' : 's'}
      </span>
    </span>
  )
}

/**
 * Mispricing ladder (S3): per-strike contract-implied vs SVI-fair win probability,
 * with the signed edge. Positive edge = contract dearer than model (sell side),
 * negative = cheaper (buy side). Color is paired with a sign + label, never alone.
 */
function MispricingLadder({
  cells,
  loading,
  forward,
}: {
  cells: MispriceCell[]
  loading: boolean
  forward?: number
}) {
  const sorted = [...cells].sort((a, b) => b.strike - a.strike)
  const hasAny = sorted.some((c) => c.edge != null)
  // Average overround across the band: the house margin baked into the contract prices.
  // It is the bar an edge must clear to be real value, so it leads the ladder as a
  // warning. Null when no cell quoted both sides (we never fabricate a vig).
  const overrounds = sorted.map((c) => c.overround).filter((v): v is number => v != null)
  const avgOverround =
    overrounds.length > 0 ? overrounds.reduce((a, b) => a + b, 0) / overrounds.length : null

  return (
    <div className="flex min-h-0 flex-col border-t border-outline-variant">
      <div className="flex items-center justify-between px-md py-sm">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          Mispricing (ATM band)
        </span>
        {loading && (
          <span className="font-data text-data-sm text-on-surface-variant">quoting...</span>
        )}
      </div>

      {avgOverround != null && (
        <div className="flex flex-col gap-0.5 px-md pb-sm">
          <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
            Overround (vig) {(avgOverround * 100).toFixed(1)}%
          </span>
          <span className="font-data text-[10px] text-on-surface-variant">
            Edge below this is mostly the house margin, not real value. Read the Net column.
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="px-md pb-sm font-data text-data-sm text-on-surface-variant">
          {loading
            ? 'Quoting the contract around the forward.'
            : 'Pick an active expiry to quote its ATM band against the model.'}
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Column header. */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-md px-md py-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
            <span>Strike</span>
            <span className="text-right">Fair</span>
            <span className="text-right">Contract</span>
            <span className="text-right">Edge</span>
            <span className="text-right">Net</span>
          </div>
          {sorted.map((cell) => {
            const atm = forward != null && Math.abs(cell.strike - forward) < forward * 0.0025
            const edge = cell.edge
            const edgeColor =
              edge == null
                ? 'text-on-surface-variant'
                : edge > 0
                  ? 'text-primary-fixed-dim'
                  : edge < 0
                    ? 'text-error'
                    : 'text-on-surface-variant'
            const edgeSign = edge != null && edge > 0 ? '+' : ''
            // Net-of-vig edge: the raw gap minus the house margin, the part actually
            // worth trading. Same sign convention and coloring as the raw edge.
            const net = cell.netEdge
            const netColor =
              net == null
                ? 'text-on-surface-variant'
                : net > 0
                  ? 'text-primary-fixed-dim'
                  : net < 0
                    ? 'text-error'
                    : 'text-on-surface-variant'
            const netSign = net != null && net > 0 ? '+' : ''
            return (
              <div
                key={cell.strike}
                className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-md px-md py-1 font-data text-data-sm tabular-nums ${
                  atm ? 'bg-surface-container' : ''
                }`}
              >
                <span className="text-on-surface">
                  {cell.strike >= 1000 ? `${(cell.strike / 1000).toFixed(1)}k` : cell.strike}
                </span>
                <span className="text-right text-on-surface-variant">
                  {fmtProb(cell.fairProbability)}
                </span>
                <span className="text-right text-on-surface-variant">
                  {fmtProb(cell.contractProbability)}
                </span>
                <span className={`text-right ${edgeColor}`}>
                  {edge == null ? '-' : `${edgeSign}${(edge * 100).toFixed(1)}%`}
                </span>
                <span className={`text-right ${netColor}`}>
                  {net == null ? '-' : `${netSign}${(net * 100).toFixed(1)}%`}
                </span>
              </div>
            )
          })}
          {!hasAny && !loading && (
            <div className="px-md py-sm font-data text-data-sm text-on-surface-variant">
              Contract quotes unavailable for this band right now.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
