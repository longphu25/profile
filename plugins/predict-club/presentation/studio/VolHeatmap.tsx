import { type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
import type { ArbReport } from '../../application/arbFreeCheck'
import { edgeSide, edgeTier } from '../../application/submitStudioTrade'
import { computeFairValue } from '../../domain/payoutPreview'
import type {
  MispriceCell,
  RealizedVol,
  SurfaceCell,
  SurfaceColumn,
  SurfaceGrid,
} from '../../domain/volSurface'

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

// Current-price marker: amber, deliberately outside the teal IV ramp, the red arb
// flag, and the pink edge dot so "where the market is now" never reads as any of
// those signals.
const PRICE_MARKER = '#ffb224'
const PRICE_CHIP_BG = '#04140f'

// Minted-position marker: violet, deliberately outside the teal IV ramp, the amber
// price line, the red arb flag, and the pink edge dot, so "you hold a position here"
// reads as its own signal. A corner ribbon + ring, not a fill, so the IV color
// underneath stays readable (color is a second encoding, never the only one).
const MINTED_MARKER = '#c08bff'

// Cell edge signal: a caret (UP/DOWN value side) plus the edge in probability points,
// drawn only on cells that carry a real edge. The caret is the primary encoding
// (colorblind-safe); color is a second layer. Strong edges get a chip background so a
// glance separates the few clear opportunities from the merely-nonzero ones.
const EDGE_SIGNAL_COLOR = '#ffd166'
const EDGE_SIGNAL_CHIP_BG = '#04140f'

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
  return `$${Math.round(strike).toLocaleString('en-US')}`
}

function formatExpiryHeader(column: SurfaceColumn): string {
  const s = column.secondsToExpiry
  if (s <= 0) return 'exp'
  if (s < 3600) return `${Math.round(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

// How far a strike sits above/below the column forward, in percent. The sign tells
// a trader which way the bet leans before they read anything else (above = needs a
// rise to pay UP). Null when the forward is missing.
function formatMoneyness(strike: number, forward: number): string | null {
  if (!Number.isFinite(forward) || forward <= 0) return null
  const pct = (strike / forward - 1) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// Model UP win-probability for any strike from the column SVI (free, no network).
// Null when the column is degraded or has no positive forward.
function modelUpProbability(column: SurfaceColumn, strike: number): number | null {
  if (!column.svi || column.forward <= 0) return null
  const p = computeFairValue(column.svi, column.forward, column.expiryMs, strike, 0)
  return Number.isFinite(p) && p > 0 ? p : null
}

// Read IV against the surface realized-vol estimate so a trader sees whether the
// option is rich (IV well above RV), cheap (well below), or fair. The +-5% band
// keeps small gaps from over-claiming a signal. Null when RV is unavailable.
function ivVsRealized(iv: number, realized: RealizedVol | null): 'rich' | 'cheap' | 'fair' | null {
  if (!realized || realized.value == null || realized.value <= 0) return null
  const ratio = iv / realized.value
  if (ratio > 1.05) return 'rich'
  if (ratio < 0.95) return 'cheap'
  return 'fair'
}

/**
 * Where the current price (the selected column's forward) sits on the descending
 * strike axis. The marker line is drawn at the boundary between the two strikes
 * that bracket the forward: at the bottom edge of `row` when the price is inside
 * the band or below it, and at the top edge of row 0 when the price is above the
 * whole band. Null when there is no positive forward to place.
 */
function priceMarkerFor(
  strikes: number[],
  forward: number,
): { row: number; edge: 'top' | 'bottom'; forward: number } | null {
  if (!Number.isFinite(forward) || forward <= 0 || strikes.length === 0) return null
  if (forward >= strikes[0]) return { row: 0, edge: 'top', forward }
  for (let i = 0; i < strikes.length - 1; i += 1) {
    if (forward <= strikes[i] && forward > strikes[i + 1])
      return { row: i, edge: 'bottom', forward }
  }
  return { row: strikes.length - 1, edge: 'bottom', forward }
}

function HeatmapBody({
  grid,
  selectedOracleId,
  onSelect,
  onCellSelect,
  edgeByStrike,
  arbKeys,
  mintedKeys,
  realized,
}: {
  grid: SurfaceGrid
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
  onCellSelect?: (column: SurfaceColumn, cell: SurfaceCell, anchorRect: DOMRect) => void
  edgeByStrike: Map<number, number>
  arbKeys: Set<string>
  mintedKeys?: Set<string>
  realized?: RealizedVol | null
}) {
  const { strikes, columns, ivRange } = grid
  const templateColumns = `minmax(5rem, auto) repeat(${columns.length}, minmax(0, 1fr))`

  // Roving tabindex: the data cells form one tab stop; arrow keys move focus
  // between them so a keyboard user is not trapped tabbing through every cell.
  // `active` is the [row, col] of the cell that currently owns tabIndex 0.
  const [active, setActive] = useState<[number, number]>([0, 0])
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([])

  // The cell whose tooltip is showing (hover or keyboard focus), with the screen
  // rect to anchor the floating panel. Cleared on mouse-leave / blur. The tooltip
  // is aria-hidden: its facts already live in each cell's aria-label, so a screen
  // reader is not told the same thing twice.
  const [hovered, setHovered] = useState<{ row: number; col: number; rect: DOMRect } | null>(null)
  const onCellHover = (row: number, col: number, rect: DOMRect | null) => {
    setHovered(
      rect ? { row, col, rect } : (prev) => (prev?.row === row && prev?.col === col ? null : prev),
    )
  }

  // Current-price line: the selected column's forward, placed on the shared strike
  // axis. Falls back to the first column so the marker still shows before a column
  // is picked. Drawn once per row in `Row` when its index matches.
  const markerColumn = columns.find((c) => c.oracleId === selectedOracleId) ?? columns[0]
  const priceMarker = markerColumn ? priceMarkerFor(strikes, markerColumn.forward) : null

  const focusCell = (row: number, col: number) => {
    const r = Math.max(0, Math.min(strikes.length - 1, row))
    const c = Math.max(0, Math.min(columns.length - 1, col))
    setActive([r, c])
    cellRefs.current[r]?.[c]?.focus()
  }

  // Selecting a cell drives the smile/edge (column select) and, when the cell has
  // a live IV, opens the trade ticket anchored to it. No-data cells only navigate.
  const fireCellSelect = (row: number, col: number, rect: DOMRect | null) => {
    const column = columns[col]
    if (!column) return
    onSelect(column.oracleId)
    const cell = column.cells.find((c) => c.strike === strikes[row])
    if (cell && cell.iv != null && rect && onCellSelect) onCellSelect(column, cell, rect)
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
        fireCellSelect(row, col, cellRefs.current[row]?.[col]?.getBoundingClientRect() ?? null)
        break
    }
  }

  // The hovered/focused cell resolved to its column + cell so the tooltip can read
  // moneyness, model probability, the quoted contract edge, and IV-vs-realized. Null
  // when nothing is hovered or the target row/col no longer exists.
  const tipColumn = hovered ? columns[hovered.col] : null
  const tipStrike = hovered ? strikes[hovered.row] : null
  const tipCell =
    tipColumn && tipStrike != null
      ? (tipColumn.cells.find((c) => c.strike === tipStrike) ?? null)
      : null
  const tipEdge =
    tipColumn && tipColumn.oracleId === selectedOracleId && tipStrike != null
      ? (edgeByStrike.get(tipStrike) ?? null)
      : null

  return (
    <>
      <div
        role="grid"
        aria-label="Implied volatility by strike and expiry"
        aria-rowcount={strikes.length + 1}
        aria-colcount={columns.length + 1}
        className="grid h-full w-full gap-px bg-outline-variant"
        style={{
          gridTemplateColumns: templateColumns,
          gridTemplateRows: `auto repeat(${strikes.length}, minmax(2.75rem, 1fr))`,
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
            priceMarker={priceMarker}
            mintedKeys={mintedKeys}
            onCellKeyDown={onCellKeyDown}
            onCellActivate={fireCellSelect}
            onCellHover={onCellHover}
          />
        ))}
      </div>
      {hovered && tipColumn && tipStrike != null && (
        <CellTooltip
          rect={hovered.rect}
          column={tipColumn}
          strike={tipStrike}
          iv={tipCell?.iv ?? null}
          edge={tipEdge}
          realized={realized ?? null}
        />
      )}
    </>
  )
}

// Floating cell detail panel (hover or keyboard focus). Anchored to the cell's
// screen rect and clamped to the viewport, mirroring how TradeTicket places its
// popover. aria-hidden: the same facts live in the cell's aria-label, so a screen
// reader is not told twice. Shown instantly (no fade) so reduced-motion is moot.
function CellTooltip({
  rect,
  column,
  strike,
  iv,
  edge,
  realized,
}: {
  rect: DOMRect
  column: SurfaceColumn
  strike: number
  iv: number | null
  edge: number | null
  realized: RealizedVol | null
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = rect.right + margin
    if (left + width > vw - margin) left = rect.left - width - margin
    if (left < margin) left = Math.min(Math.max(margin, rect.left), vw - width - margin)
    let top = rect.top
    if (top + height > vh - margin) top = vh - height - margin
    if (top < margin) top = margin
    setPos({ top, left })
  }, [rect])

  const moneyness = formatMoneyness(strike, column.forward)
  const modelUp = modelUpProbability(column, strike)
  const side = edgeSide(edge)
  const richCheap = iv != null ? ivVsRealized(iv, realized) : null

  return (
    <div
      ref={ref}
      data-pc-studio-cell-tip
      aria-hidden="true"
      className="fixed z-50 w-[13rem] rounded-md border border-outline-variant bg-surface-container-lowest p-sm font-data text-data-sm text-on-surface shadow-lg"
      style={{
        top: pos?.top ?? rect.top,
        left: pos?.left ?? rect.right + 8,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div className="flex items-baseline justify-between gap-sm">
        <span className="tabular-nums font-semibold">{formatStrike(strike)}</span>
        <span className="tabular-nums text-on-surface-variant">{formatExpiryHeader(column)}</span>
      </div>
      {iv == null ? (
        <div className="mt-1 text-on-surface-variant">No SVI - cell has no implied vol.</div>
      ) : (
        <dl className="mt-1 flex flex-col gap-[2px]">
          {moneyness != null && <Stat label="Moneyness" value={moneyness} />}
          <Stat label="IV" value={formatIv(iv)} />
          {modelUp != null && <Stat label="Model UP" value={fmtProb(modelUp)} />}
          {edge != null && side != null && (
            <Stat
              label="Edge"
              value={`${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}pt -> ${side}`}
              accent
            />
          )}
          {richCheap != null && realized?.value != null && (
            <Stat label={`vs RV ${formatIv(realized.value)}`} value={richCheap} />
          )}
        </dl>
      )}
      {iv != null && (
        <div className="mt-1 border-t border-outline-variant pt-1 text-[10px] uppercase tracking-wide text-primary-fixed-dim">
          Click to trade
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-sm">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={`tabular-nums ${accent ? 'font-semibold text-primary-fixed-dim' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function fmtProb(p: number | null): string {
  return p == null ? '-' : `${(p * 100).toFixed(1)}%`
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
  priceMarker,
  mintedKeys,
  onCellKeyDown,
  onCellActivate,
  onCellHover,
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
  priceMarker: { row: number; edge: 'top' | 'bottom'; forward: number } | null
  mintedKeys?: Set<string>
  onCellKeyDown: (e: KeyboardEvent<HTMLDivElement>, row: number, col: number) => void
  onCellActivate: (row: number, col: number, rect: DOMRect | null) => void
  onCellHover: (row: number, col: number, rect: DOMRect | null) => void
}) {
  if (!cellRefs.current[rowIndex]) cellRefs.current[rowIndex] = []
  // This row carries the current-price line when its index matches the marker. The
  // line sits on the cell's top or bottom edge (the boundary between the two strikes
  // that bracket the live forward), and the rowheader shows the price chip.
  const showMarker = priceMarker != null && priceMarker.row === rowIndex
  const markerEdge = priceMarker?.edge ?? 'bottom'
  return (
    <div role="row" style={{ display: 'contents' }}>
      <div
        role="rowheader"
        className="relative flex items-center justify-end bg-surface-container px-xs font-data text-data-sm tabular-nums text-on-surface-variant"
      >
        {formatStrike(strike)}
        {showMarker && (
          <span
            className={`absolute right-[2px] z-10 flex items-center gap-1 rounded-sm px-1 py-px font-label text-[10px] uppercase leading-none tracking-wide ${
              markerEdge === 'top' ? 'top-[1px]' : 'bottom-[1px]'
            }`}
            style={{ backgroundColor: PRICE_CHIP_BG, color: PRICE_MARKER }}
          >
            {formatStrike(priceMarker.forward)}
          </span>
        )}
      </div>
      {columns.map((column, colIndex) => {
        const cell = column.cells.find((c) => c.strike === strike)
        const iv = cell?.iv ?? null
        const selectedCol = column.oracleId === selectedOracleId
        const edge = selectedCol ? (edgeByStrike.get(strike) ?? null) : null
        const arb = arbKeys.has(`${column.oracleId}|${strike}`)
        const minted = mintedKeys?.has(`${column.oracleId}|${strike}`) ?? false
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
              onMouseEnter={(e) =>
                onCellHover(rowIndex, colIndex, e.currentTarget.getBoundingClientRect())
              }
              onMouseLeave={() => onCellHover(rowIndex, colIndex, null)}
              onFocus={(e) =>
                onCellHover(rowIndex, colIndex, e.currentTarget.getBoundingClientRect())
              }
              onBlur={() => onCellHover(rowIndex, colIndex, null)}
              aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: no data`}
              className={`relative flex items-center justify-center bg-surface-container-lowest font-data text-data-sm text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed-dim focus-visible:ring-inset ${
                selectedCol ? 'ring-1 ring-primary-fixed-dim/40 ring-inset' : ''
              }`}
            >
              -
              {showMarker && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 z-10 h-[2px] ${markerEdge === 'top' ? 'top-0' : 'bottom-0'}`}
                  style={{ backgroundColor: PRICE_MARKER }}
                />
              )}
            </div>
          )
        }
        const tier = edgeTier(edge)
        const side = edgeSide(edge)
        const edgeLabel =
          side != null
            ? `, model edge ${(Math.abs(edge ?? 0) * 100).toFixed(1)} points favoring ${side}`
            : ''
        const arbLabel = arb ? ', no-arbitrage violation' : ''
        const mintedLabel = minted ? ', position minted here' : ''
        // Surface the same depth the tooltip shows to a screen reader (the tooltip is
        // aria-hidden), so a keyboard user hears moneyness + model win-prob too.
        const moneyness = formatMoneyness(strike, column.forward)
        const modelUp = modelUpProbability(column, strike)
        const moneynessLabel = moneyness != null ? `, ${moneyness} vs spot` : ''
        const modelLabel = modelUp != null ? `, model UP ${(modelUp * 100).toFixed(1)} percent` : ''
        return (
          <div
            key={column.oracleId}
            ref={setRef}
            role="gridcell"
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
            onClick={(e) =>
              onCellActivate(rowIndex, colIndex, e.currentTarget.getBoundingClientRect())
            }
            onMouseEnter={(e) =>
              onCellHover(rowIndex, colIndex, e.currentTarget.getBoundingClientRect())
            }
            onMouseLeave={() => onCellHover(rowIndex, colIndex, null)}
            onFocus={(e) =>
              onCellHover(rowIndex, colIndex, e.currentTarget.getBoundingClientRect())
            }
            onBlur={() => onCellHover(rowIndex, colIndex, null)}
            aria-label={`Strike ${strike}, ${formatExpiryHeader(column)}: implied vol ${formatIv(iv)}${moneynessLabel}${modelLabel}${edgeLabel}${arbLabel}${mintedLabel}`}
            className={`relative flex items-center justify-center font-data text-data-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
              arb
                ? 'ring-2 ring-error ring-inset'
                : minted
                  ? 'ring-2 ring-inset'
                  : selectedCol
                    ? 'ring-1 ring-primary-fixed ring-inset'
                    : ''
            }`}
            style={
              {
                backgroundColor: rampColor(iv, ivRange.min, ivRange.max),
                color: cellTextColor(iv, ivRange.min, ivRange.max),
                ...(minted && !arb ? { '--tw-ring-color': MINTED_MARKER } : {}),
              } as React.CSSProperties
            }
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
            {minted && (
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-[2px] bottom-[2px] text-[12px] leading-none"
                style={{ color: MINTED_MARKER }}
              >
                check_circle
              </span>
            )}
            {tier !== 'none' && side != null && edge != null && (
              <span
                aria-hidden="true"
                className={`absolute bottom-[2px] right-[2px] z-10 flex items-center gap-[2px] rounded-sm px-[3px] py-[1px] font-data text-[11px] leading-none tabular-nums ${
                  tier === 'strong' ? 'font-semibold' : 'font-medium opacity-90'
                }`}
                style={{ backgroundColor: EDGE_SIGNAL_CHIP_BG, color: EDGE_SIGNAL_COLOR }}
              >
                <span>{side === 'UP' ? '▲' : '▼'}</span>
                <span>{(Math.abs(edge) * 100).toFixed(1)}</span>
              </span>
            )}
            {showMarker && (
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 z-10 h-[2px] ${markerEdge === 'top' ? 'top-0' : 'bottom-0'}`}
                style={{ backgroundColor: PRICE_MARKER }}
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
  onCellSelect,
  mispriceCells,
  arbReport,
  mintedKeys,
  realized,
  className = '',
}: {
  grid: SurfaceGrid
  loaded: boolean
  selectedOracleId: string | null
  onSelect: (oracleId: string) => void
  onCellSelect?: (column: SurfaceColumn, cell: SurfaceCell, anchorRect: DOMRect) => void
  mispriceCells: MispriceCell[]
  arbReport: ArbReport
  mintedKeys?: Set<string>
  realized?: RealizedVol | null
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
            onCellSelect={onCellSelect}
            edgeByStrike={edgeByStrike}
            arbKeys={arbKeys}
            mintedKeys={mintedKeys}
            realized={realized ?? null}
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
