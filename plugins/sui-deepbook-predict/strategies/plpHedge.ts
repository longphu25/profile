/**
 * PLP + Hedge Vault Strategy Simulation
 *
 * Supply quote into predict::supply to earn PLP returns, simultaneously buy
 * out-of-the-money (OTM) binary DOWN positions to cap left-tail drawdown.
 *
 * Product: "PLP yield minus crash insurance" — easier sell to outside LPs.
 *
 * Hooks:
 * - Tune hedge ratio dynamically based on vault utilization
 * - Sell hedges back near expiry if not needed
 * - Expose clean APY net of insurance cost
 */

import { PRICE_SCALE } from '../types'

export interface PLPHedgeConfig {
  /** Total capital in DUSDC */
  capital: number
  /** % of capital allocated to PLP supply (rest goes to hedges) */
  plpAllocationPct: number
  /** OTM distance for hedge strikes (% below spot) */
  hedgeOTMPct: number
  /** Number of hedge positions (different strikes/expiries) */
  numHedges: number
  /** Current vault utilization (0-1) */
  vaultUtilization: number
  /** Current PLP share price */
  plpSharePrice: number
  /** Estimated PLP APY (annualized %) */
  plpAPY: number
  /** Current spot price (raw) */
  spotRaw: number
  /** Time to expiry in hours */
  expiryHours: number
}

export interface HedgePosition {
  strike: number
  cost: number
  maxPayout: number
  /** Probability of being ITM (simplified) */
  itmProb: number
}

export interface PLPHedgeResult {
  plpAmount: number
  hedgeAmount: number
  hedgePositions: HedgePosition[]
  /** Net APY after insurance cost */
  netAPY: number
  /** Raw PLP APY before hedging */
  grossAPY: number
  /** Annual cost of insurance as % */
  insuranceCostPct: number
  /** Max drawdown with hedge (capped) */
  maxDrawdownPct: number
  /** Max drawdown without hedge (uncapped) */
  unhedgedMaxDrawdownPct: number
  /** Dynamic hedge ratio based on utilization */
  dynamicHedgeRatio: number
  /** Scenarios: PnL at different price moves */
  scenarios: { move: number; plpPnl: number; hedgePnl: number; netPnl: number }[]
}

export function simulatePLPHedge(config: PLPHedgeConfig): PLPHedgeResult {
  const spot = config.spotRaw / PRICE_SCALE

  // Dynamic hedge ratio: increase hedge when utilization is high
  // Base: config allocation. Adjust: +20% hedge if util > 50%, +40% if > 75%
  let dynamicHedgeRatio = (100 - config.plpAllocationPct) / 100
  if (config.vaultUtilization > 0.75) dynamicHedgeRatio = Math.min(0.5, dynamicHedgeRatio * 1.4)
  else if (config.vaultUtilization > 0.5) dynamicHedgeRatio = Math.min(0.4, dynamicHedgeRatio * 1.2)

  const plpAmount = config.capital * (1 - dynamicHedgeRatio)
  const hedgeAmount = config.capital * dynamicHedgeRatio

  // Build hedge positions: OTM DOWN binaries at different strikes
  const hedgePositions: HedgePosition[] = []
  const costPerHedge = hedgeAmount / config.numHedges
  const T = config.expiryHours / (365.25 * 24) // time to expiry in years

  for (let i = 0; i < config.numHedges; i++) {
    // Stagger strikes: first hedge closest to spot, last furthest OTM
    const otmDistance = (config.hedgeOTMPct * (1 + i * 0.5)) / 100
    const strike = spot * (1 - otmDistance)

    // Simplified pricing: cost ≈ probability of being ITM × payout
    // Using normal approximation: P(S < K) ≈ Φ((ln(K/F) - 0.5σ²T) / (σ√T))
    // Simplified: P ≈ otmDistance / (2 * expectedVol)
    const expectedVol = 0.6 // ~60% annualized vol assumption for BTC
    const itmProb = Math.max(0.01, Math.min(0.4, otmDistance / (2 * expectedVol * Math.sqrt(T))))

    // Max payout: cost / itmProb (binary pays fixed amount)
    const maxPayout = costPerHedge / Math.max(itmProb, 0.05)

    hedgePositions.push({ strike, cost: costPerHedge, maxPayout, itmProb })
  }

  // Calculate APY
  const grossAPY = config.plpAPY
  const totalHedgeCost = hedgePositions.reduce((s, h) => s + h.cost, 0)
  const annualizedInsuranceCost =
    (totalHedgeCost / config.capital) * ((365.25 * 24) / config.expiryHours)
  const insuranceCostPct = annualizedInsuranceCost * 100
  const netAPY = grossAPY - insuranceCostPct

  // Max drawdown analysis
  // Without hedge: PLP can lose up to utilization% of vault value
  const unhedgedMaxDrawdownPct = config.vaultUtilization * 100

  // With hedge: capped at (spot - lowest_strike) / spot as % of PLP portion
  // Plus hedge cost
  const lowestStrike =
    hedgePositions.length > 0 ? Math.min(...hedgePositions.map((h) => h.strike)) : spot * 0.8
  const hedgedMaxDrawdownPct = Math.min(
    unhedgedMaxDrawdownPct,
    ((spot - lowestStrike) / spot) * 100 * (plpAmount / config.capital) +
      insuranceCostPct / ((365.25 * 24) / config.expiryHours),
  )

  // Scenarios
  const scenarios: PLPHedgeResult['scenarios'] = []
  for (let move = -50; move <= 20; move += 5) {
    const newPrice = spot * (1 + move / 100)

    // PLP PnL: proportional to vault MTM change
    // Simplified: PLP loses when price moves against positions
    const plpPnl =
      move < 0
        ? plpAmount * (move / 100) * config.vaultUtilization * 2 // amplified by utilization
        : ((plpAmount * config.plpAPY) / 100) * (config.expiryHours / (365.25 * 24)) // earn yield

    // Hedge PnL: binary DOWN pays if settlement < strike
    let hedgePnl = -totalHedgeCost // start with cost
    for (const h of hedgePositions) {
      if (newPrice < h.strike) {
        hedgePnl += h.maxPayout
      }
    }

    scenarios.push({ move, plpPnl, hedgePnl, netPnl: plpPnl + hedgePnl })
  }

  return {
    plpAmount,
    hedgeAmount,
    hedgePositions,
    netAPY,
    grossAPY,
    insuranceCostPct,
    maxDrawdownPct: hedgedMaxDrawdownPct,
    unhedgedMaxDrawdownPct,
    dynamicHedgeRatio,
    scenarios,
  }
}
