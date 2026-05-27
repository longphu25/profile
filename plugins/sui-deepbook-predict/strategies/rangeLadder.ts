/**
 * Range-Ladder Vault Strategy Simulation
 *
 * Automatically mints multiple vertical range positions evenly distributed
 * around the current spot price. Simulates expected PnL under various scenarios.
 *
 * Strategy: Divide capital into N range positions covering [spot-X%, spot+X%]
 * Each range has equal width and equal capital allocation.
 */

import { PRICE_SCALE, STRIKE_SCALE } from '../types'

export interface RangeLadderConfig {
  /** Total capital in DUSDC */
  capital: number
  /** Number of range rungs */
  numRungs: number
  /** Total width as % of spot (e.g. 10 = ±5% around spot) */
  widthPct: number
  /** Current spot price (raw from API) */
  spotRaw: number
  /** Min strike from oracle (raw) */
  minStrike: number
  /** Tick size (raw) */
  tickSize: number
}

export interface RangeLadderRung {
  lower: number
  upper: number
  capital: number
  /** Probability of settlement in this range (simplified uniform assumption) */
  probability: number
  /** Expected payout if settlement in range */
  expectedPayout: number
}

export interface RangeLadderResult {
  rungs: RangeLadderRung[]
  totalCapital: number
  expectedPnL: number
  maxLoss: number
  maxGain: number
  breakEvenProb: number
  /** PnL at different settlement prices */
  scenarios: { settlement: number; pnl: number }[]
}

/**
 * Simulate a range-ladder vault strategy.
 * Assumes uniform distribution of settlement prices (simplified model).
 * In reality, pricing depends on SVI surface — this is a first-order approximation.
 */
export function simulateRangeLadder(config: RangeLadderConfig): RangeLadderResult {
  const spot = config.spotRaw / PRICE_SCALE
  const halfWidth = ((config.widthPct / 100) * spot) / 2
  const rungWidth = (halfWidth * 2) / config.numRungs
  const capitalPerRung = config.capital / config.numRungs
  const tick = config.tickSize / STRIKE_SCALE

  // Build rungs
  const rungs: RangeLadderRung[] = []
  const ladderLow = spot - halfWidth
  for (let i = 0; i < config.numRungs; i++) {
    const lower = Math.max(ladderLow + i * rungWidth, config.minStrike / STRIKE_SCALE)
    const upper = lower + rungWidth
    // Snap to tick
    const lowerSnapped = Math.round(lower / tick) * tick
    const upperSnapped = Math.round(upper / tick) * tick

    // Simplified probability: uniform distribution over [spot-2*halfWidth, spot+2*halfWidth]
    const totalRange = halfWidth * 4
    const rungRange = upperSnapped - lowerSnapped
    const probability = rungRange / totalRange

    // Expected payout: if settlement in range, payout = capital / cost
    // Simplified: assume cost = capital × (1 - probability) [market maker spread]
    const costMultiplier = 0.85 // ~15% spread assumption
    const expectedPayout = capitalPerRung / costMultiplier

    rungs.push({
      lower: lowerSnapped,
      upper: upperSnapped,
      capital: capitalPerRung,
      probability,
      expectedPayout,
    })
  }

  // Simulate scenarios
  const scenarios: { settlement: number; pnl: number }[] = []
  const scenarioRange = spot * 0.3 // ±30%
  for (let pct = -30; pct <= 30; pct += 2) {
    const settlement = spot * (1 + pct / 100)
    let pnl = -config.capital // Start with total cost
    for (const rung of rungs) {
      if (settlement > rung.lower && settlement <= rung.upper) {
        pnl += rung.expectedPayout
      }
    }
    scenarios.push({ settlement, pnl })
  }

  const pnls = scenarios.map((s) => s.pnl)
  const maxLoss = Math.min(...pnls)
  const maxGain = Math.max(...pnls)
  const expectedPnL =
    rungs.reduce((sum, r) => sum + r.probability * r.expectedPayout, 0) - config.capital
  const breakEvenProb = rungs.reduce((sum, r) => sum + r.probability, 0)

  return {
    rungs,
    totalCapital: config.capital,
    expectedPnL,
    maxLoss,
    maxGain,
    breakEvenProb,
    scenarios,
  }
}
