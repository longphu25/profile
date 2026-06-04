import type { IndicatorSignal, RiskState, SignalBias } from './types'
import { computeConsensus } from './indicatorConsensus'

export interface RiskCheck {
  id: string
  label: string
  passed: boolean
  severity: 'blocking' | 'warning'
  message?: string
}

export interface RiskEvaluation {
  state: RiskState
  checks: RiskCheck[]
  canExecute: boolean
}

export interface RiskGateInput {
  oracleLastUpdate: number
  oracleStaleThresholdMs: number
  expiryMinutes: number
  minSafeExpiryMinutes: number
  memberDusdc: number
  suggestedDusdc: number
  signalBias: SignalBias
  indicators: IndicatorSignal[]
}

export function evaluateRiskGate(input: RiskGateInput): RiskEvaluation {
  const now = Date.now()
  const checks: RiskCheck[] = []

  // Oracle staleness
  const oracleAge = now - input.oracleLastUpdate
  const oracleStale = oracleAge > input.oracleStaleThresholdMs
  checks.push({
    id: 'oracle-health',
    label: 'Oracle Health',
    passed: !oracleStale,
    severity: 'blocking',
    message: oracleStale ? `Oracle stale (${Math.round(oracleAge / 1000)}s ago)` : undefined,
  })

  // Expiry safety
  const expirySafe = input.expiryMinutes >= input.minSafeExpiryMinutes
  checks.push({
    id: 'expiry-safe',
    label: 'Expiry Safe',
    passed: expirySafe,
    severity: 'blocking',
    message: expirySafe
      ? undefined
      : `Expiry too short (${input.expiryMinutes}m < ${input.minSafeExpiryMinutes}m)`,
  })

  // Signal bias
  const consensus = computeConsensus(input.indicators)
  const biasOk = consensus.bias !== 'no-trade'
  checks.push({
    id: 'signal-bias',
    label: 'Signal Consensus',
    passed: biasOk,
    severity: 'blocking',
    message: biasOk ? undefined : 'Indicators resolve to NO-TRADE',
  })

  // DUSDC balance
  const balanceOk = input.memberDusdc >= input.suggestedDusdc
  checks.push({
    id: 'dusdc-balance',
    label: 'DUSDC Ready',
    passed: balanceOk,
    severity: 'warning',
    message: balanceOk
      ? undefined
      : `Need ${input.suggestedDusdc} DUSDC, have ${input.memberDusdc}`,
  })

  const hasBlocking = checks.some((c) => !c.passed && c.severity === 'blocking')
  const hasWarning = checks.some((c) => !c.passed && c.severity === 'warning')

  let state: RiskState = 'ready'
  if (hasBlocking) state = 'blocked'
  else if (hasWarning) state = 'warning'

  return { state, checks, canExecute: !hasBlocking }
}
