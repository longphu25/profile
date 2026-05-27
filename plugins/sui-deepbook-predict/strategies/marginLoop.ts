/**
 * Three-Protocol Margin Loop Strategy Simulation
 *
 * Flow:
 * 1. Deposit collateral into iron_bank → receive USDsui share token
 * 2. Use USDsui as collateral on deepbook_margin → borrow dUSDC
 * 3. Deploy borrowed dUSDC into Predict ranges via predict::mint_range
 * 4. On settlement, payouts repay the margin loan
 *
 * Product: "This is what Sui DeFi composability actually looks like"
 * One PTB, three protocol logos.
 *
 * Hooks:
 * - Design liquidation path (margin call → close predict → repay)
 * - Bound LTV against worst-case Predict outcomes
 * - Single PTB that opens the whole stack atomically
 */

import { PRICE_SCALE } from '../types'

export interface MarginLoopConfig {
  /** Initial collateral in USDC equivalent */
  collateral: number
  /** iron_bank deposit APY (%) */
  ironBankAPY: number
  /** deepbook_margin borrow rate (%) */
  marginBorrowRate: number
  /** LTV ratio for margin borrow (e.g. 0.7 = 70%) */
  ltv: number
  /** Number of Predict range positions to open */
  numRanges: number
  /** Range width as % of spot */
  rangeWidthPct: number
  /** Current spot price (raw) */
  spotRaw: number
  /** Time to expiry in hours */
  expiryHours: number
  /** Predict range expected return (% of capital if ITM) */
  predictReturnPct: number
}

export interface MarginLoopStep {
  protocol: 'iron_bank' | 'deepbook_margin' | 'predict'
  action: string
  amount: number
  result: string
}

export interface MarginLoopResult {
  steps: MarginLoopStep[]
  /** Total leveraged exposure */
  totalExposure: number
  /** Effective leverage */
  leverage: number
  /** Net APY if ranges settle ITM */
  bestCaseAPY: number
  /** Net APY if ranges expire OTM */
  worstCaseAPY: number
  /** Liquidation price (where LTV breaches limit) */
  liquidationPrice: number
  /** Max LTV under worst-case Predict outcome */
  worstCaseLTV: number
  /** Scenarios */
  scenarios: { move: number; pnl: number; ltv: number; liquidated: boolean }[]
}

export function simulateMarginLoop(config: MarginLoopConfig): MarginLoopResult {
  const spot = config.spotRaw / PRICE_SCALE
  const T = config.expiryHours / (365.25 * 24)

  // Step 1: iron_bank deposit
  const ironBankDeposit = config.collateral
  const usdSuiShares = ironBankDeposit // 1:1 simplified
  const ironBankYield = ironBankDeposit * (config.ironBankAPY / 100) * T

  // Step 2: deepbook_margin borrow
  const borrowAmount = ironBankDeposit * config.ltv
  const marginInterest = borrowAmount * (config.marginBorrowRate / 100) * T

  // Step 3: Deploy into Predict ranges
  const predictCapital = borrowAmount
  const capitalPerRange = predictCapital / config.numRanges
  const halfWidth = ((config.rangeWidthPct / 100) * spot) / 2

  // Build steps
  const steps: MarginLoopStep[] = [
    {
      protocol: 'iron_bank',
      action: 'Deposit USDC → USDsui shares',
      amount: ironBankDeposit,
      result: `${usdSuiShares.toFixed(2)} USDsui (earning ${config.ironBankAPY}% APY)`,
    },
    {
      protocol: 'deepbook_margin',
      action: 'Collateralize USDsui → Borrow dUSDC',
      amount: borrowAmount,
      result: `${borrowAmount.toFixed(2)} dUSDC at ${config.ltv * 100}% LTV (${config.marginBorrowRate}% rate)`,
    },
    {
      protocol: 'predict',
      action: `Mint ${config.numRanges} range positions`,
      amount: predictCapital,
      result: `${config.numRanges} ranges × $${capitalPerRange.toFixed(0)} around $${spot.toFixed(0)} (±${config.rangeWidthPct / 2}%)`,
    },
  ]

  // Calculate returns
  const totalExposure = predictCapital
  const leverage = totalExposure / config.collateral

  // Best case: all ranges ITM
  const predictPayoutBest = predictCapital * (1 + config.predictReturnPct / 100)
  const bestCaseProfit = predictPayoutBest - predictCapital + ironBankYield - marginInterest
  const bestCaseAPY = (bestCaseProfit / config.collateral / T) * 100

  // Worst case: all ranges OTM (lose predict capital, still owe margin)
  const worstCaseProfit = -predictCapital + ironBankYield - marginInterest
  const worstCaseAPY = (worstCaseProfit / config.collateral / T) * 100

  // Liquidation analysis
  // LTV = debt / collateral_value
  // If predict positions go to 0, remaining collateral = ironBankDeposit + ironBankYield
  // Debt = borrowAmount + marginInterest
  const debtAtExpiry = borrowAmount + marginInterest
  const worstCaseLTV = debtAtExpiry / (ironBankDeposit + ironBankYield)

  // Liquidation price: where collateral value drops below debt / max_ltv
  // Simplified: if spot drops X%, USDsui value drops proportionally (correlated)
  const maxLTV = 0.85 // liquidation threshold
  const liquidationDropPct = (1 - debtAtExpiry / (ironBankDeposit * maxLTV)) * 100
  const liquidationPrice = spot * (1 + liquidationDropPct / 100)

  // Scenarios
  const scenarios: MarginLoopResult['scenarios'] = []
  for (let move = -40; move <= 40; move += 5) {
    const newPrice = spot * (1 + move / 100)

    // How many ranges are ITM?
    let rangesITM = 0
    for (let i = 0; i < config.numRanges; i++) {
      const rungCenter = spot + (i - config.numRanges / 2) * ((halfWidth * 2) / config.numRanges)
      const lower = rungCenter - halfWidth / config.numRanges
      const upper = rungCenter + halfWidth / config.numRanges
      if (newPrice > lower && newPrice <= upper) rangesITM++
    }

    const predictPnl =
      rangesITM > 0
        ? rangesITM * capitalPerRange * (config.predictReturnPct / 100) -
          (config.numRanges - rangesITM) * capitalPerRange
        : -predictCapital

    const totalPnl = predictPnl + ironBankYield - marginInterest
    const currentCollateralValue = ironBankDeposit * (1 + move / 200) // partial correlation
    const currentLTV = debtAtExpiry / Math.max(currentCollateralValue, 1)
    const liquidated = currentLTV > maxLTV

    scenarios.push({ move, pnl: totalPnl, ltv: currentLTV, liquidated })
  }

  return {
    steps,
    totalExposure,
    leverage,
    bestCaseAPY,
    worstCaseAPY,
    liquidationPrice,
    worstCaseLTV,
    scenarios,
  }
}
