// BTC Chart — default time-scale viewport when loading or switching pairs.

/** Bars in the focused recent window (zoom level). */
export const DEFAULT_VISIBLE_BARS = 120

/** Extra logical bars on each side so the recent window sits mid-view. */
export const VIEWPORT_CENTER_PAD = 40

export interface LogicalRange {
  from: number
  to: number
}

/**
 * Logical range that keeps the last `visibleBars` candles centered in the pane.
 * Symmetric padding on left (older bars) and right (empty future space).
 */
export function defaultLogicalRange(
  barCount: number,
  visibleBars = DEFAULT_VISIBLE_BARS,
): LogicalRange {
  if (barCount <= 0) return { from: 0, to: 1 }

  const recentStart = Math.max(0, barCount - visibleBars)
  const recentEnd = barCount - 1
  const recentMid = (recentStart + recentEnd) / 2
  const halfSpan = (visibleBars + 2 * VIEWPORT_CENTER_PAD) / 2

  let from = recentMid - halfSpan
  let to = recentMid + halfSpan

  if (from < 0) {
    to -= from
    from = 0
  }

  return { from, to }
}

type TimeScaleLike = {
  setVisibleLogicalRange: (range: LogicalRange) => void
  getVisibleLogicalRange: () => LogicalRange | null
}

/** Apply the centered recent-window viewport on a lightweight-charts time scale. */
export function applyDefaultViewport(chart: TimeScaleLike, barCount: number): LogicalRange {
  const range = defaultLogicalRange(barCount)
  chart.setVisibleLogicalRange(range)
  return range
}

/** Read the current logical range without throwing when the chart is mid-teardown. */
export function getVisibleLogicalRangeSafe(
  chart: TimeScaleLike | null | undefined,
): LogicalRange | null {
  if (!chart) return null
  try {
    return chart.getVisibleLogicalRange()
  } catch {
    return null
  }
}

/** Restore a logical range without throwing when the chart is mid-teardown. */
export function setVisibleLogicalRangeSafe(
  chart: TimeScaleLike | null | undefined,
  range: LogicalRange | null,
): void {
  if (!chart || !range) return
  try {
    chart.setVisibleLogicalRange(range)
  } catch {
    /* chart removed or not ready */
  }
}

/**
 * Re-apply a saved range on the next frame(s) after layout or pane toggles.
 * lightweight-charts can shift the viewport when height or time-scale visibility changes.
 */
export function scheduleViewportRestore(
  getCharts: () => Array<TimeScaleLike | null | undefined>,
  range: LogicalRange | null,
): void {
  if (!range) return
  const restore = () => {
    for (const chart of getCharts()) {
      setVisibleLogicalRangeSafe(chart, range)
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(restore))
}

/** Apply a one-shot viewport lock after osc data paint (clears the ref). */
export function applyPendingViewportLock(
  lockRef: { current: LogicalRange | null },
  charts: Array<TimeScaleLike | null | undefined>,
): void {
  const range = lockRef.current
  if (!range) return
  for (const chart of charts) {
    setVisibleLogicalRangeSafe(chart, range)
  }
  lockRef.current = null
}
