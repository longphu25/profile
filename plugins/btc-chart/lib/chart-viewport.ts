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
