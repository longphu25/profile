import { type KeyboardEvent, useRef, useState } from 'react'
import type { ArbReport } from '../../application/arbFreeCheck'
import type { MispriceCell, SurfaceColumn, SurfaceGrid } from '../../domain/volSurface'

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
  edgeByStrike,
  arbKeys,
}: {
  grid: SurfaceGrid
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
  edgeByStrike: Map<number, number>
  arbKeys: Set<string>
}) {
  const { strikes, columns, ivRange } = grid
  const templateColumns = `minmax(3.5rem, auto) repeat(${columns.length}, minmax(0, 1fr))`

  // Roving tabindex: the data cells form one tab stop; arrow keys move focus
  // between them so a keyboard user is not trapped tabbing through every cell.
  // `active` is the [row, col] of the cell that currently owns tabIndex 0.
  const [active, setActive] = useState<[number, number]>([0, 0])
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([])

  const focusCell = (row: number, col: number) => {
    const r = Math.max(0, Math.min(strikes.length - 1, row))
    const c = Math.max(0, Math.min(columns.length - 1, col))
    setActive([r, c])
    cellRefs.current[r]?.[c]?.focus()
  }

  const onCellKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: number, col: number) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        focusCell(row - 1, col)
        break
      case 'ArrowDown':
        e.preventDefault()
        focusCell(row + 1, col)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusCell(row, col - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusCell(row, col + 1)
        break
      case 'Home':
        e.preventDefault()
        focusCell(row, 0)
        break
      case 'End':
        e.preventDefault()
        focusCell(row, columns.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(columns[col].oracleId)
        break
    }
  }

  return (
    <div
      role="grid"
      aria-label="Implied volatility by strike and expiry"
      aria-rowcount={strikes.length + 1}
      aria-colcount={columns.length + 1}
      className="grid h-full w-full gap-px bg-outline-variant"
      style={{
        gridTemplateColumns: templateColumns,
        gridTemplateRows: `auto repeat(${strikes.length}, minmax(0, 1fr))`,
      }}
    >
      {/* Header row: corner + clickable expiry headers. */}
      <div role="row" style={{ display: 'contents' }}>
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
      </div>

      {/* Strike rows. */}
      {strikes.map((strike, rowIndex) => (
        <Row
          key={strike}
          strike={strike}
          rowIndex={rowIndex}
          columns={columns}
          ivRange={ivRange}
          selectedOracleId={selectedOracleId}
          edgeByStrike={edgeByStrike}
          arbKeys={arbKeys}
          active={active}
          cellRefs={cellRefs}
          onCellKeyDown={onCellKeyDown}
        />
      ))}
    </div>
  )
}

function Row({
  strike,
  rowIndex,
  columns,
  ivRange,
  selectedOracleId,
  edgeByStrike,
  arbKeys,
  active,
  cellRefs,
  onCellKeyDown,
}: {
  strike: number
  rowIndex: number
  columns: SurfaceColumn[]
  ivRange: SurfaceGrid['ivRange']
  selectedOracleId: string | null
  edgeByStrike: Map<number, number>
  arbKeys: Set<string>
  active: [number, number]
  cellRefs: React.RefObject<(HTMLDivElement | null)[][]>
  onCellKeyDown: (e: KeyboardEvent<HTMLDivElement>, row: number, col: number) => void
}) {
  if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = []
  return (
    <div role="row" style={{ display: 'contents' }}>
      <div
        role="rowheader"
        className="flex items-center justify-end bg-surface-container px-xs font-data text-data-sm tabular-nums text-on-surface-variant"
      >
        {formatStrike(strike)}
      </div>
      {columns.map((column, colIndex) => {
        const cell = column.cells.find((c) => c.strike === strike)
        const iv = cell?.iv ?? null
        const selectedCol = column.oracleId === selectedOracleId
        const edge = selectedCol ? (edgeByStrike.get(strike) ?? null) : null
        const arb = arbKeys.has(`${column.oracleId}|${strike}`)
        const isActive = active[0] === rowIndex && active[1] === colIndex
        const setRef = (el: HTMLDivElement | null) => {
          cellRefs.current[rowIndex][colIndex] = el
        }
        if (iv == null || !ivRange) {
          return (
            <div
              key={column.oracleId}
              ref={setRef}
              role="gridcell"
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
              aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: no data`}
              className={`flex items-center justify-center bg-surface-container-lowest font-data text-data-sm text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed-dim focus-visible:ring-inset ${
                selectedCol ? 'ring-1 ring-primary-fixed-dim/40 ring-inset' : ''
              }`}
            >
              -
            </div>
          )
        }
        const edgeLabel =
          edge != null
            ? `, mispricing edge ${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)} points`
            : ''
        const arbLabel = arb ? ', no-arbitrage violation' : ''
        return (
          <div
            key={column.oracleId}
            ref={setRef}
            role="gridcell"
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
            aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: implied vol ${formatIv(iv)}${edgeLabel}${arbLabel}`}
            className={`relative flex items-center justify-center font-data text-data-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
              arb
                ? 'ring-2 ring-error ring-inset'
                : selectedCol
                  ? 'ring-1 ring-primary-fixed ring-inset'
                  : ''
            }`}
            style={{
              backgroundColor: rampColor(iv, ivRange.min, ivRange.max),
              color: cellTextColor(iv, ivRange.min, ivRange.max),
            }}
          >
            {formatIv(iv)}
            {arb && (
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-[2px] top-[2px] text-[12px] leading-none text-error"
              >
                warning
              </span>
            )}
            {edge != null && (
              <span
                aria-hidden="true"
                className="absolute right-[2px] top-[2px] h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: edge > 0 ? '#ff5d73' : '#04140f' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function VolHeatmap({
  grid,
  loaded,
  selectedOracleId,
  onSelect,
  mispriceCells,
  arbReport,
  className = '',
}: {
  grid: SurfaceGrid
  loaded: boolean
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
  mispriceCells: MispriceCell[]
  arbReport: ArbReport
  className?: string
}) {
  const hasCells = grid.columns.length > 0 && grid.strikes.length > 0 && grid.ivRange != null
  // Edge by strike for the selected column only (the ATM band we quoted).
  const edgeByStrike = new Map<number, number>()
  for (const cell of mispriceCells) {
    if (cell.edge != null) edgeByStrike.set(cell.strike, cell.edge)
  }
  // Arb violations keyed by (oracleId|strike) so any column's flagged cell shows it.
  const arbKeys = new Set<string>()
  for (const v of arbReport.violations) {
    arbKeys.add(`${v.oracleId}|${v.strike}`)
  }

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
          <HeatmapBody
            grid={grid}
            selectedOracleId={selectedOracleId}
            onSelect={onSelect}
            edgeByStrike={edgeByStrike}
            arbKeys={arbKeys}
          />
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
