import type { SurfaceHistoryEntry } from '../../application/volSurfaceService'

/**
 * Time-travel scrubber (plan 23, S5): replay recent distinct surfaces.
 *
 * The surface service keeps a bounded ring buffer of past surfaces (one entry per
 * distinct SVI update). This control scrubs that buffer: the slider picks a past
 * snapshot, the Live button snaps back to the current surface. When no history has
 * accumulated yet it degrades to a disabled "live only" control, never a crash.
 *
 * Reduced-motion friendly: scrubbing re-renders instantly with no animated tween,
 * so users who disable motion get the same instant snap as everyone else.
 *
 * Presentational: StudioShell owns the selected index (null = live) and decides
 * which grid the heatmap, smile, and arb-free health read. This component only
 * reports the chosen index up.
 */

function formatClock(ms: number): string {
  const d = new Date(ms)
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mm = `${d.getMinutes()}`.padStart(2, '0')
  const ss = `${d.getSeconds()}`.padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function TimeTravel({
  history,
  selectedIndex,
  onSelect,
  className = '',
}: {
  history: SurfaceHistoryEntry[]
  /** Index into `history`, or null when showing the live surface. */
  selectedIndex: number | null
  /** Report the chosen index up; null means snap back to live. */
  onSelect: (index: number | null) => void
  className?: string
}) {
  const count = history.length
  // With <2 snapshots there is nothing to scrub between: degrade to live only.
  const hasHistory = count >= 2
  const isLive = selectedIndex == null
  // The slider's max position represents "live" (one past the last stored index).
  const maxPos = count
  const pos = selectedIndex == null ? maxPos : selectedIndex
  const selectedEntry = selectedIndex == null ? null : history[selectedIndex]

  return (
    <section
      data-pc-studio-timetravel
      aria-label="Time travel"
      className={`flex shrink-0 items-center gap-md bg-surface-container-lowest px-md py-sm ${className}`}
    >
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        Replay
      </span>

      {hasHistory ? (
        <>
          <input
            type="range"
            min={0}
            max={maxPos}
            step={1}
            value={pos}
            aria-label="Scrub recent surfaces"
            aria-valuetext={
              isLive ? 'Live surface' : `Snapshot at ${formatClock(selectedEntry!.capturedAtMs)}`
            }
            onChange={(e) => {
              const next = Number(e.currentTarget.value)
              onSelect(next >= maxPos ? null : next)
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-primary-fixed-dim"
          />
          <span className="w-28 shrink-0 text-right font-data text-data-sm tabular-nums text-on-surface">
            {isLive ? 'Live' : formatClock(selectedEntry!.capturedAtMs)}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={isLive}
            aria-pressed={isLive}
            className={`shrink-0 rounded-sm px-sm py-1 font-label text-label-caps uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-inset ${
              isLive
                ? 'bg-primary-fixed-dim text-on-primary-fixed'
                : 'bg-surface-container text-on-surface hover:bg-surface-bright'
            }`}
          >
            Live
          </button>
        </>
      ) : (
        <span className="font-data text-data-sm text-on-surface-variant">
          Live only - history builds as SVI updates arrive.
        </span>
      )}
    </section>
  )
}
