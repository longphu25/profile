/** Pure numeric helpers for market snapshot aggregation. */

/** Median of finite numbers; returns 0 when empty. */
export function median(values: readonly number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** Average of finite numbers; null when empty. */
export function average(values: readonly number[]): number | null {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return null
  return finite.reduce((s, v) => s + v, 0) / finite.length
}

/** max - min for finite values; 0 when fewer than two values. */
export function spread(values: readonly number[]): number {
  const finite = values.filter(Number.isFinite)
  if (finite.length < 2) return 0
  return Math.max(...finite) - Math.min(...finite)
}

/** (max - min) / median as percent; 0 when median is 0. */
export function spreadPctFromPrices(prices: readonly number[]): number {
  const med = median(prices)
  if (med <= 0) return 0
  return (spread(prices) / med) * 100
}

/** Parse JSON fetch body; null on failure. */
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
