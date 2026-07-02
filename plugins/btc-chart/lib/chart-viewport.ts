// BTC Chart — default time-scale viewport when loading or switching pairs.

/** Bars visible after a pair/timeframe change (trading-style, not full history). */
export const DEFAULT_VISIBLE_BARS = 120

/** Right-edge padding in logical bar units. */
export const VIEWPORT_RIGHT_PAD = 6

export interface LogicalRange {
  from: number
  to: number
}

/** Logical range anchored on the latest candle. */
export function defaultLogicalRange(
  barCount: number,
  visibleBars = DEFAULT_VISIBLE_BARS,
): LogicalRange {
  if (barCount <= 0) return { from: 0, to: 1 }
  const to = barCount - 1 + VIEWPORT_RIGHT_PAD
  const from = Math.max(0, barCount - visibleBars)
  return { from, to }
}

type TimeScaleLike = {
  setVisibleLogicalRange: (range: LogicalRange) => void
  getVisibleLogicalRange: () => LogicalRange | null
}

/** Apply the default recent-window viewport on a lightweight-charts time scale. */
export function applyDefaultViewport(chart: TimeScaleLike, barCount: number): LogicalRange {
  const range = defaultLogicalRange(barCount)
  chart.setVisibleLogicalRange(range)
  return range
}
