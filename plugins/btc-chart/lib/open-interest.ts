/** Open Interest trend helpers (Binance USD history). */

export interface OiHistoryPoint {
  readonly time: number
  readonly totalUsd: number
}

export interface OiDeltaPct {
  readonly h1: number | null
  readonly h4: number | null
  readonly h24: number | null
}

/**
 * Percent change of the latest OI vs earlier hourly snapshots.
 * Expects ascending history (oldest first).
 */
export function computeOiDeltaPct(history: readonly OiHistoryPoint[]): OiDeltaPct {
  if (history.length < 2) return { h1: null, h4: null, h24: null }

  const lastIdx = history.length - 1
  const last = history[lastIdx]?.totalUsd ?? 0

  const pctFrom = (idx: number): number | null => {
    const prev = history[idx]?.totalUsd
    if (prev == null || prev <= 0 || last <= 0) return null
    return ((last - prev) / prev) * 100
  }

  return {
    h1: pctFrom(lastIdx - 1),
    h4: lastIdx >= 4 ? pctFrom(lastIdx - 4) : null,
    h24: lastIdx >= 24 ? pctFrom(0) : null,
  }
}

/** Format signed percent for OI delta chips. */
export function formatOiDeltaPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%'
}

/** CSS class for up/down/neutral OI delta. */
export function oiDeltaClass(value: number | null): 'up' | 'dn' | '' {
  if (value == null || !Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'up' : 'dn'
}

/**
 * Build an SVG polyline `points` string from normalized USD values.
 * Returns null when fewer than two points exist.
 */
export function buildOiSparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): string | null {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
}
