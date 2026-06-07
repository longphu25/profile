import type { Direction, IndicatorSignal, MemberRoundState, PredictionRound } from './types'

export const ORACLE_STALE_THRESHOLD_MS = 60_000
export const MIN_SAFE_EXPIRY_MINUTES = 5

export interface CreateRoundParams {
  oracle: string
  market: string
  expiryMinutes: number
  direction: Direction
  strike: number
  lowerStrike?: number
  upperStrike?: number
  suggestedDusdc: number
  thesis: string
  indicators: IndicatorSignal[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateRoundParams(params: CreateRoundParams): ValidationResult {
  const errors: string[] = []

  if (!params.oracle) errors.push('Oracle is required')
  if (!params.market) errors.push('Market is required')
  if (params.expiryMinutes <= 0) errors.push('Expiry must be positive')
  if (!params.direction) errors.push('Direction is required')
  if (params.strike <= 0 && params.direction !== 'RANGE') errors.push('Strike must be positive')
  if (params.suggestedDusdc <= 0) errors.push('Suggested DUSDC must be positive')

  if (params.direction === 'RANGE') {
    if (!params.lowerStrike || params.lowerStrike <= 0)
      errors.push('Lower strike required for RANGE')
    if (!params.upperStrike || params.upperStrike <= 0)
      errors.push('Upper strike required for RANGE')
    if (params.lowerStrike && params.upperStrike && params.lowerStrike >= params.upperStrike) {
      errors.push('Lower strike must be less than upper strike')
    }
  }

  return { valid: errors.length === 0, errors }
}

export function canMemberPledge(round: PredictionRound, memberState: MemberRoundState): boolean {
  return (
    (round.status === 'open' || round.status === 'confirmed' || round.status === 'funding') &&
    (memberState === 'watching' || memberState === 'pledged')
  )
}

export function canMemberAccept(round: PredictionRound, memberState: MemberRoundState): boolean {
  return (round.status === 'confirmed' || round.status === 'funding') && memberState === 'pledged'
}

export function isOracleStale(lastUpdateMs: number, thresholdMs: number): boolean {
  return Date.now() - lastUpdateMs > thresholdMs
}

export function isExpirySafe(expiryMinutes: number, minSafe: number): boolean {
  return expiryMinutes >= minSafe
}
