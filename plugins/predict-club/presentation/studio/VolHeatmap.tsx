import type { SurfaceColumn, SurfaceGrid } from '../../domain/volSurface'

/**
 * Vol-surface heatmap (plan 23, S1-S2): a strike x expiry implied-vol matrix.
 *
 * Rendered as a semantic CSS grid (not SVG) so every cell is a real focusable
 * element with its IV printed as text - color is a SECOND encoding on top of the
 * number, never the only signal (ui-ux-pro-max: colorblind-safe + AA contrast).
 * Strike rows run high-to-low top-to-bottom; expiry columns run near-to-far
 * left-to-right, matching how a trader reads a vol matrix.
 *
 * Presentational: the surface service lifecycle + selection live in StudioShell
 * so the smile slice and edge panel share the same snapshot. Clicking an expiry
 * column header selects it (drives the smile slice in S2).
 */

const COLD = { r: 0x12, g: 0x2a, b: 0x24 }
const HOT = { r: 0x00, g: 0xe0, b: 0xb3 }

/** Map an IV into the cold->hot ramp by its position in the live IV range. */
function rampColor(iv: number, min: number, max: number): string {
  const t = max > min ? (iv - min) / (max - min) : 0.5
  const clamped = Math.max(0, Math.min(1, t))
  const r = Math.round(COLD.r + (HOT.r - COLD.r) * clamped)
  const g = Math.round(COLD.g + (HOT.g - COLD.g) * clamped)
  const b = Math.round(COLD.b + (HOT.b - COLD.b) * clamped)
  return `rgb(${r} ${g} ${b})`
}

/** Text color that stays AA-legible against the ramp (dark text on the hot end). */
function cellTextColor(iv: number, min: number, max: number): string {
  const t = max > min ? (iv - min) / (max - min) : 0.5
  return t > 0.55 ? '#04140f' : '#dbe5df'
}

function formatIv(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`
}

function formatStrike(strike: number): string {
  return strike >= 1000 ? `${Math.round(strike / 1000)}k` : `${strike}`
}

function formatExpiryHeader(column: SurfaceColumn): string {
  const s = column.secondsToExpiry
  if (s <= 0) return 'exp'
  if (s < 3600) return `${Math.round(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function HeatmapBody({
  grid,
  selectedOracleId,
  onSelect,
}: {
  grid: SurfaceGrid
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
}) {
  const { strikes, columns, ivRange } = grid
  const templateColumns = `minmax(3.5rem, auto) repeat(${columns.length}, minmax(0, 1fr))`

  return (
    <div
      role="grid"
      aria-label="Implied volatility by strike and expiry"
      className="grid h-full w-full gap-px bg-outline-variant"
      style={{
        gridTemplateColumns: templateColumns,
        gridTemplateRows: `auto repeat(${strikes.length}, minmax(0, 1fr))`,
      }}
    >
      {/* Header row: corner + clickable expiry headers. */}
      <div
        role="columnheader"
        className="flex items-center justify-center bg-surface-container px-xs py-1 font-label text-label-caps uppercase tracking-wider text-on-surface-variant"
      >
        K \ T
      </div>
      {columns.map((column) => {
        const selected = column.oracleId === selectedOracleId
        return (
          <button
            key={column.oracleId}
            type="button"
            role="columnheader"
            aria-pressed={selected}
            onClick={() => onSelect(column.oracleId)}
            className={`flex flex-col items-center justify-center px-xs py-1 font-data text-data-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
              selected
                ? 'bg-primary-fixed-dim text-on-primary-fixed'
                : 'bg-surface-container text-on-surface hover:bg-surface-bright'
            }`}
          >
            <span className="tabular-nums">{formatExpiryHeader(column)}</span>
            {column.degraded && (
              <span className="font-label text-[10px] uppercase tracking-wide text-error">
                no svi
              </span>
            )}
          </button>
        )
      })}

      {/* Strike rows. */}
      {strikes.map((strike) => (
        <Row
          key={strike}
          strike={strike}
          columns={columns}
          ivRange={ivRange}
          selectedOracleId={selectedOracleId}
        />
      ))}
    </div>
  )
}

function Row({
  strike,
  columns,
  ivRange,
  selectedOracleId,
}: {
  strike: number
  columns: SurfaceColumn[]
  ivRange: SurfaceGrid['ivRange']
  selectedOracleId: string | null
}) {
  return (
    <>
      <div
        role="rowheader"
        className="flex items-center justify-end bg-surface-container px-xs font-data text-data-sm tabular-nums text-on-surface-variant"
      >
        {formatStrike(strike)}
      </div>
      {columns.map((column) => {
        const cell = column.cells.find((c) => c.strike === strike)
        const iv = cell?.iv ?? null
        const selectedCol = column.oracleId === selectedOracleId
        if (iv == null || !ivRange) {
          return (
            <div
              key={column.oracleId}
              role="gridcell"
              tabIndex={0}
              aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: no data`}
              className={`flex items-center justify-center bg-surface-container-lowest font-data text-data-sm text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed-dim focus-visible:ring-inset ${
                selectedCol ? 'ring-1 ring-primary-fixed-dim/40 ring-inset' : ''
              }`}
            >
              -
            </div>
          )
        }
        return (
          <div
            key={column.oracleId}
            role="gridcell"
            tabIndex={0}
            aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: implied vol ${formatIv(iv)}`}
            className={`flex items-center justify-center font-data text-data-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
              selectedCol ? 'ring-1 ring-primary-fixed ring-inset' : ''
            }`}
            style={{
              backgroundColor: rampColor(iv, ivRange.min, ivRange.max),
              color: cellTextColor(iv, ivRange.min, ivRange.max),
            }}
          >
            {formatIv(iv)}
          </div>
        )
      })}
    </>
  )
}

export function VolHeatmap({
  grid,
  loaded,
  selectedOracleId,
  onSelect,
  className = '',
}: {
  grid: SurfaceGrid
  loaded: boolean
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
  className?: string
}) {
  const hasCells = grid.columns.length > 0 && grid.strikes.length > 0 && grid.ivRange != null

  return (
    <section
      data-pc-studio-heatmap
      aria-label="Volatility surface"
      className={`flex min-h-0 flex-col bg-surface-container-lowest ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between px-md py-sm">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
          Vol surface (IV)
        </span>
        {hasCells && grid.ivRange && (
          <span className="flex items-center gap-sm font-data text-data-sm text-on-surface-variant">
            <span className="tabular-nums">{formatIv(grid.ivRange.min)}</span>
            <span
              className="h-2 w-16 rounded-sm"
              aria-hidden="true"
              style={{
                background: `linear-gradient(to right, ${rampColor(
                  grid.ivRange.min,
                  grid.ivRange.min,
                  grid.ivRange.max,
                )}, ${rampColor(grid.ivRange.max, grid.ivRange.min, grid.ivRange.max)})`,
              }}
            />
            <span className="tabular-nums">{formatIv(grid.ivRange.max)}</span>
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 p-px">
        {hasCells ? (
          <HeatmapBody grid={grid} selectedOracleId={selectedOracleId} onSelect={onSelect} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-sm p-lg text-center">
            <span
              className="material-symbols-outlined text-[40px] text-on-surface-variant"
              aria-hidden="true"
            >
              grid_on
            </span>
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              {loaded ? 'No live oracle SVI' : 'Sampling surface'}
            </span>
            <span className="max-w-[24rem] font-data text-data-sm text-on-surface-variant">
              {loaded
                ? 'No active oracle is publishing an SVI surface right now. The matrix fills as soon as a live expiry has SVI params.'
                : 'Fetching the SVI surface for each live expiry.'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
