import type { ReactNode } from 'react'
import type { RealizedVol, SurfaceColumn } from '../../domain/volSurface'

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
  className = '',
}: {
  column: SurfaceColumn | null
  realized: RealizedVol | null
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
      </div>

      <div className="border-t border-outline-variant px-md py-sm">
        <span className="font-data text-data-sm text-on-surface-variant">
          Mispricing and arb-free health arrive in S3-S4.
        </span>
      </div>
    </section>
  )
}
