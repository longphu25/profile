import type { ManagerPosition } from '../infrastructure/deepbookPredictPricingService'

/**
 * Pure view helpers for the Surface Studio positions/history drawer (plan 23, S9).
 *
 * The drawer reads real binary positions from the trader's PredictManager (the
 * chain is the source of truth, not the localStorage minted hint) and groups them
 * into live and settled. These helpers keep the live/expired split, the strike and
 * side framing, and the moneyness read out of the view so they stay unit-testable
 * and the component is just layout.
 *
 * A position's `expiry` is the oracle expiry in ms (carried straight through from
 * `oracle.expiry`, compared against `Date.now()` everywhere upstream), so the
 * live/expired split compares it against the same ms clock.
 */

export type PositionLifecycle = 'live' | 'expired'

/**
 * Live while the oracle expiry is still in the future, expired once it has passed.
 * A position settles (and may become claimable) only after it expires, so the
 * drawer offers a claim pre-flight only on the expired group.
 */
export function classifyPosition(position: ManagerPosition, nowMs: number): PositionLifecycle {
  return position.expiry > nowMs ? 'live' : 'expired'
}

/**
 * The UP/DOWN label for a binary position. The chain stores the bet side as
 * ABOVE/BELOW (price above or below the strike at expiry); the Studio speaks
 * UP/DOWN everywhere else, so map to that. Null for a range position (no side).
 */
export function positionSideLabel(position: ManagerPosition): 'UP' | 'DOWN' | null {
  if (position.side === 'ABOVE') return 'UP'
  if (position.side === 'BELOW') return 'DOWN'
  return null
}

/** The position strike in USD (already descaled at read time), or null if absent. */
export function positionStrikeUsd(position: ManagerPosition): number | null {
  return position.strike != null && Number.isFinite(position.strike) ? position.strike : null
}

/**
 * How far the strike sits above/below the current forward, in percent, signed. The
 * sign tells a trader which way the bet leans at a glance (a strike above the
 * forward needs a rise to pay UP). Null when the forward or strike is missing.
 */
export function positionMoneyness(
  position: ManagerPosition,
  forward: number | null,
): string | null {
  const strike = positionStrikeUsd(position)
  if (strike == null || forward == null || !Number.isFinite(forward) || forward <= 0) return null
  const pct = (strike / forward - 1) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * A stable identity for a position across refetches: oracle, expiry, side, strike.
 * Used as the React key and to key the per-position claim pre-flight state, so a
 * re-fetched list does not lose a row's resolved claim status or remount it.
 */
export function positionKey(position: ManagerPosition): string {
  return `${position.oracleId}|${position.expiry}|${position.side ?? 'NONE'}|${position.strike ?? 0}`
}
