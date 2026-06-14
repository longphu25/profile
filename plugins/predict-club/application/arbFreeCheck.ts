import { computeFairValue, totalVarianceAtLogMoneyness } from '../domain/payoutPreview'
import type { SurfaceColumn, SurfaceGrid } from '../domain/volSurface'

/**
 * Arb-free checker (plan 23, S4): flag when the sampled surface is internally
 * inconsistent. Two classic static no-arbitrage conditions, both computed from the
 * SVI math we already have - never fabricated from missing data.
 *
 *   Butterfly (per expiry column): the digital up-probability P(S > K) must be
 *   non-increasing in strike. Since P_up(K) = -dC/dK, a rising P_up means a
 *   negative implied density (d2C/dK2 < 0) - a butterfly arbitrage.
 *
 *   Calendar (across columns at matched log-moneyness): total implied variance
 *   w(k, T) must be non-decreasing in expiry T at a fixed moneyness k. A later
 *   expiry with strictly less total variance at the same k is a calendar spread
 *   arbitrage.
 *
 * Degraded columns (no SVI) are skipped, not guessed: a missing curve is reported
 * as "not checked", never as a violation.
 */

export type ArbRule = 'butterfly' | 'calendar'

export interface ArbViolation {
  rule: ArbRule
  /** The column the violation is localized to (the later expiry for calendar). */
  oracleId: string
  /** Strike to flag on the heatmap (the upper strike of a butterfly pair, or the
   * nearest strike to the matched moneyness for a calendar break). */
  strike: number
  /** Matched log-moneyness for a calendar break (undefined for butterfly). */
  logMoneyness?: number
  /** Human-readable explanation (sign + location), never color alone. */
  detail: string
}

export interface ArbReport {
  violations: ArbViolation[]
  /** Columns that carried usable SVI (the ones actually checked). */
  checkedColumns: number
  butterflyChecked: boolean
  calendarChecked: boolean
}

// Tolerances absorb the erf-approximation noise in normalCDF (~1.5e-7) and tiny
// float wiggle, so a flat or numerically-equal region never false-positives.
const BUTTERFLY_EPS = 1e-5
// Calendar compares very small total-variance values (sub-hour T), so the breach
// must clear both a relative and an absolute floor to count.
const CALENDAR_REL_TOL = 1e-3
const CALENDAR_ABS_TOL = 1e-9
// Matched moneyness levels for the calendar check: ATM plus modest wings.
const CALENDAR_MONEYNESS = [-0.02, -0.01, 0, 0.01, 0.02]

function hasUsableSvi(column: SurfaceColumn): boolean {
  return !column.degraded && column.svi != null && column.forward > 0
}

/** Butterfly check for one column: digital up-prob must not rise with strike. */
export function checkButterfly(column: SurfaceColumn): ArbViolation[] {
  if (!hasUsableSvi(column) || column.svi == null) return []
  const svi = column.svi
  const forward = column.forward
  const strikes = column.cells
    .map((c) => c.strike)
    .filter((k) => k > 0)
    .sort((a, b) => a - b)
  if (strikes.length < 2) return []

  const violations: ArbViolation[] = []
  let prevStrike = strikes[0]
  let prevProb = computeFairValue(svi, forward, 0, prevStrike, 0)
  for (let i = 1; i < strikes.length; i += 1) {
    const strike = strikes[i]
    const prob = computeFairValue(svi, forward, 0, strike, 0)
    if (prob - prevProb > BUTTERFLY_EPS) {
      violations.push({
        rule: 'butterfly',
        oracleId: column.oracleId,
        strike,
        detail: `Up-probability rises from ${(prevProb * 100).toFixed(2)}% to ${(prob * 100).toFixed(2)}% between strikes ${prevStrike} and ${strike} (negative implied density).`,
      })
    }
    prevStrike = strike
    prevProb = prob
  }
  return violations
}

/** Nearest sampled strike to a target price, for heatmap localization. */
function nearestStrike(strikes: number[], target: number): number {
  return strikes.reduce((best, k) => (Math.abs(k - target) < Math.abs(best - target) ? k : best))
}

/** Calendar check across columns: total variance must not fall as expiry grows. */
export function checkCalendar(columns: SurfaceColumn[], sharedStrikes: number[]): ArbViolation[] {
  const usable = columns
    .filter(hasUsableSvi)
    .slice()
    .sort((a, b) => a.expiryMs - b.expiryMs)
  if (usable.length < 2) return []

  const violations: ArbViolation[] = []
  for (const k of CALENDAR_MONEYNESS) {
    let prev = usable[0]
    let prevW = totalVarianceAtLogMoneyness(prev.svi!, k)
    for (let i = 1; i < usable.length; i += 1) {
      const col = usable[i]
      const w = totalVarianceAtLogMoneyness(col.svi!, k)
      const floor = Math.max(CALENDAR_ABS_TOL, prevW * CALENDAR_REL_TOL)
      if (w < prevW - floor) {
        const target = col.forward * Math.exp(k)
        const strike =
          sharedStrikes.length > 0 ? nearestStrike(sharedStrikes, target) : Math.round(target)
        violations.push({
          rule: 'calendar',
          oracleId: col.oracleId,
          strike,
          logMoneyness: k,
          detail: `Total variance falls from ${prevW.toExponential(2)} to ${w.toExponential(2)} at log-moneyness ${k.toFixed(3)} as expiry grows (calendar arbitrage).`,
        })
      }
      prev = col
      prevW = w
    }
  }
  return violations
}

/** Run both no-arb checks over the assembled surface grid. */
export function checkArbFree(grid: SurfaceGrid): ArbReport {
  const usableColumns = grid.columns.filter(hasUsableSvi)
  const butterflyChecked = usableColumns.length > 0
  const calendarChecked = usableColumns.length >= 2

  const violations: ArbViolation[] = []
  for (const column of grid.columns) {
    violations.push(...checkButterfly(column))
  }
  violations.push(...checkCalendar(grid.columns, grid.strikes))

  return {
    violations,
    checkedColumns: usableColumns.length,
    butterflyChecked,
    calendarChecked,
  }
}
