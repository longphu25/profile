import type { Direction } from './types'

const YEAR_MS = 365.25 * 24 * 3600 * 1000
const MIN_TIME_TO_EXPIRY_YEARS = 1 / 365
const MIN_DISPLAY_PROBABILITY = 0.001
const MAX_REWARD_MULTIPLE = 1 / MIN_DISPLAY_PROBABILITY

export interface SVIParams {
  a: number
  b: number
  rho: number
  rho_negative: boolean
  m: number
  m_negative: boolean
  sigma: number
  onchain_timestamp?: number
}

export interface PayoutPreviewInput {
  direction: Direction
  strike: number
  lowerStrike?: number
  upperStrike?: number
  amountDusdc: number
  forward?: number | null
  expiry?: number | null
  svi?: SVIParams | null
}

export interface PayoutPreview {
  probability: number | null
  indicativePayout: number | null
  rewardMultiple: number | null
  degraded: boolean
  reason?: string
}

function unavailable(reason: string): PayoutPreview {
  return {
    probability: null,
    indicativePayout: null,
    rewardMultiple: null,
    degraded: true,
    reason,
  }
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasValidSVI(svi: SVIParams | null | undefined): svi is SVIParams {
  return Boolean(
    svi &&
      Number.isFinite(svi.a) &&
      Number.isFinite(svi.b) &&
      Number.isFinite(svi.rho) &&
      Number.isFinite(svi.m) &&
      Number.isFinite(svi.sigma) &&
      svi.b > 0 &&
      svi.sigma > 0,
  )
}

function yearsToExpiry(expiryMs: number, nowMs = Date.now()): number {
  return Math.max((expiryMs - nowMs) / YEAR_MS, MIN_TIME_TO_EXPIRY_YEARS)
}

function normalizeSVIParams(svi: SVIParams) {
  return {
    a: svi.a / 1e6,
    b: svi.b / 1e6,
    rho: ((svi.rho_negative ? -1 : 1) * svi.rho) / 1e9,
    m: ((svi.m_negative ? -1 : 1) * svi.m) / 1e6,
    sigma: svi.sigma / 1e6,
  }
}

function totalVarianceAtLogMoneyness(svi: SVIParams, logMoneyness: number): number {
  const params = normalizeSVIParams(svi)
  const diff = logMoneyness - params.m
  return (
    params.a + params.b * (params.rho * diff + Math.sqrt(diff * diff + params.sigma * params.sigma))
  )
}

function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + p * abs)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs)
  return 0.5 * (1 + sign * y)
}

export function computeFairValue(
  svi: SVIParams,
  forwardUsd: number,
  expiry: number,
  strikeUsd: number,
  direction: 0 | 1,
  nowMs = Date.now(),
): number {
  const F = forwardUsd
  const K = strikeUsd
  if (K <= 0 || F <= 0) return 0

  const T = yearsToExpiry(expiry, nowMs)
  const k = Math.log(K / F)
  const w = totalVarianceAtLogMoneyness(svi, k)
  if (w <= 0) return 0

  const sqrtW = Math.sqrt(w / T)
  const d2 = -k / sqrtW - sqrtW / 2
  const pUp = normalCDF(d2)
  return direction === 0 ? pUp : 1 - pUp
}

export function computeRangeFairValue(
  svi: SVIParams,
  forwardUsd: number,
  expiry: number,
  lowerUsd: number,
  higherUsd: number,
  nowMs = Date.now(),
): number {
  if (lowerUsd <= 0 || higherUsd <= 0 || lowerUsd >= higherUsd) return 0
  const pLower = computeFairValue(svi, forwardUsd, expiry, lowerUsd, 0, nowMs)
  const pHigher = computeFairValue(svi, forwardUsd, expiry, higherUsd, 0, nowMs)
  const result = pLower - pHigher
  return Number.isFinite(result) ? result : 0
}

export function computePayoutPreview(input: PayoutPreviewInput): PayoutPreview {
  if (!hasValidSVI(input.svi)) {
    return unavailable('SVI unavailable')
  }
  if (!isPositiveFinite(input.forward) || !isPositiveFinite(input.expiry)) {
    return unavailable('Forward or expiry unavailable')
  }
  if (!isPositiveFinite(input.amountDusdc)) {
    return unavailable('Stake amount unavailable')
  }
  if (input.direction === 'RANGE') {
    if (!isPositiveFinite(input.lowerStrike) || !isPositiveFinite(input.upperStrike)) {
      return unavailable('Range strikes unavailable')
    }
  } else if (!isPositiveFinite(input.strike)) {
    return unavailable('Strike unavailable')
  }

  const probability =
    input.direction === 'RANGE'
      ? computeRangeFairValue(
          input.svi,
          input.forward,
          input.expiry,
          input.lowerStrike ?? 0,
          input.upperStrike ?? 0,
        )
      : computeFairValue(
          input.svi,
          input.forward,
          input.expiry,
          input.strike,
          input.direction === 'UP' ? 0 : 1,
        )

  if (!Number.isFinite(probability) || probability <= 0) {
    const rewardMultiple = MAX_REWARD_MULTIPLE
    return {
      probability: MIN_DISPLAY_PROBABILITY,
      indicativePayout: input.amountDusdc * rewardMultiple,
      rewardMultiple,
      degraded: false,
      reason: 'Probability floored for display',
    }
  }

  const displayProbability = Math.max(probability, MIN_DISPLAY_PROBABILITY)
  const rewardMultiple = Math.min(1 / displayProbability, MAX_REWARD_MULTIPLE)
  return {
    probability: displayProbability,
    indicativePayout: input.amountDusdc * rewardMultiple,
    rewardMultiple,
    degraded: false,
    reason: probability < MIN_DISPLAY_PROBABILITY ? 'Probability floored for display' : undefined,
  }
}
