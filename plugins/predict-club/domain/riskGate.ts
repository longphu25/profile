import type { IndicatorSignal, RiskState, SignalBias } from './types'
import { computeConsensus } from './indicatorConsensus'
import { MIN_SAFE_EXPIRY_MINUTES, ORACLE_STALE_THRESHOLD_MS } from './policies'

export type RiskCheckCategory = 'funding' | 'market-data' | 'trade-safety'
export type RiskActionTarget = 'funding' | 'oracle' | 'prediction-room' | 'none'

export interface RiskCheck {
  id: string
  label: string
  category: RiskCheckCategory
  passed: boolean
  severity: 'blocking' | 'warning'
  message?: string
  actionLabel?: string
  actionTarget?: RiskActionTarget
  actionHint?: string
}

export interface RiskEvaluation {
  state: RiskState
  checks: RiskCheck[]
  blockingReasons: RiskCheck[]
  warningReasons: RiskCheck[]
  canConfirm: boolean
  canExecute: boolean
}

export interface RiskGateInput {
  oracleLastUpdate?: number | null
  oracleStaleThresholdMs?: number
  expiryMinutes: number
  minSafeExpiryMinutes?: number
  memberDusdc: number
  suggestedDusdc: number
  signalBias: SignalBias
  indicators: IndicatorSignal[]
  walletConnected?: boolean
  predictManagerReady?: boolean | null
  oracleActive?: boolean | null
  priceAvailable?: boolean | null
  sviAvailable?: boolean | null
  quoteAvailable?: boolean | null
  quoteReason?: string
  vaultAvailable?: boolean | null
  vaultReason?: string
}

export function evaluateRiskGate(input: RiskGateInput): RiskEvaluation {
  const now = Date.now()
  const checks: RiskCheck[] = []
  const oracleStaleThresholdMs = input.oracleStaleThresholdMs ?? ORACLE_STALE_THRESHOLD_MS
  const minSafeExpiryMinutes = input.minSafeExpiryMinutes ?? MIN_SAFE_EXPIRY_MINUTES

  // Oracle staleness
  const oracleAge = input.oracleLastUpdate ? now - input.oracleLastUpdate : null
  const oracleKnown = typeof oracleAge === 'number'
  const oracleStale = !oracleKnown || oracleAge > oracleStaleThresholdMs
  checks.push({
    id: 'oracle-health',
    label: 'Oracle health',
    category: 'market-data',
    passed: !oracleStale,
    severity: 'blocking',
    message: !oracleKnown
      ? 'Oracle status is not available yet'
      : oracleStale
        ? `Oracle stale (${Math.round(oracleAge / 1000)}s ago)`
        : undefined,
    actionLabel: 'Review oracle',
    actionTarget: 'oracle',
    actionHint: 'Wait for live oracle data before confirming or executing.',
  })

  if (input.oracleActive !== undefined && input.oracleActive !== null) {
    checks.push({
      id: 'oracle-active',
      label: 'Oracle active',
      category: 'market-data',
      passed: input.oracleActive,
      severity: 'blocking',
      message: input.oracleActive ? undefined : 'Selected oracle is not active',
      actionLabel: 'Review oracle',
      actionTarget: 'oracle',
      actionHint: 'Select an active oracle before confirming or executing.',
    })
  }

  if (input.priceAvailable !== undefined && input.priceAvailable !== null) {
    checks.push({
      id: 'forward-price',
      label: 'Forward price',
      category: 'market-data',
      passed: input.priceAvailable,
      severity: 'blocking',
      message: input.priceAvailable ? undefined : 'Forward price unavailable',
      actionLabel: 'Review oracle',
      actionTarget: 'oracle',
      actionHint: 'Wait for Predict server price data before pricing the round.',
    })
  }

  if (input.sviAvailable !== undefined && input.sviAvailable !== null) {
    checks.push({
      id: 'svi-surface',
      label: 'SVI surface',
      category: 'market-data',
      passed: input.sviAvailable,
      severity: 'blocking',
      message: input.sviAvailable ? undefined : 'SVI unavailable',
      actionLabel: 'Review oracle',
      actionTarget: 'oracle',
      actionHint: 'SVI is required for win probability and degraded pricing preview.',
    })
  }

  // Expiry safety
  const expirySafe = input.expiryMinutes >= minSafeExpiryMinutes
  checks.push({
    id: 'expiry-safe',
    label: 'Expiry safe',
    category: 'trade-safety',
    passed: expirySafe,
    severity: 'blocking',
    message: expirySafe
      ? undefined
      : `Expiry too short (${input.expiryMinutes}m < ${minSafeExpiryMinutes}m)`,
    actionLabel: 'Review round',
    actionTarget: 'prediction-room',
    actionHint: 'Choose a later expiry before confirming the round.',
  })

  // Signal bias
  const consensus = computeConsensus(input.indicators)
  const biasOk = consensus.bias !== 'no-trade'
  checks.push({
    id: 'signal-bias',
    label: 'Signal consensus',
    category: 'trade-safety',
    passed: biasOk,
    severity: 'blocking',
    message: biasOk ? undefined : 'Indicators resolve to NO-TRADE',
    actionLabel: 'Review signals',
    actionTarget: 'prediction-room',
    actionHint: 'Wait for a tradable signal before confirming or executing.',
  })

  // DUSDC balance
  const balanceOk = input.memberDusdc >= input.suggestedDusdc
  checks.push({
    id: 'dusdc-balance',
    label: 'DUSDC ready',
    category: 'funding',
    passed: balanceOk,
    severity: 'warning',
    message: balanceOk
      ? undefined
      : `Need ${input.suggestedDusdc} DUSDC, have ${input.memberDusdc}`,
    actionLabel: 'Fund to join',
    actionTarget: 'funding',
    actionHint: 'Route funds to DUSDC before executing the trade.',
  })

  if (input.walletConnected !== undefined) {
    checks.push({
      id: 'wallet-connected',
      label: 'Wallet connected',
      category: 'funding',
      passed: input.walletConnected,
      severity: 'blocking',
      message: input.walletConnected ? undefined : 'Connect a wallet before executing',
      actionLabel: 'Connect wallet',
      actionTarget: 'none',
      actionHint: 'Connect the Sui wallet that will self-sign the Predict trade.',
    })
  }

  if (input.predictManagerReady !== undefined && input.predictManagerReady !== null) {
    checks.push({
      id: 'predict-manager',
      label: 'PredictManager ready',
      category: 'funding',
      passed: input.predictManagerReady,
      severity: 'blocking',
      message: input.predictManagerReady
        ? undefined
        : 'No PredictManager found for the connected wallet',
      actionLabel: 'Review funding',
      actionTarget: 'funding',
      actionHint: 'Create or fund a PredictManager before executing.',
    })
  }

  if (input.quoteAvailable !== undefined && input.quoteAvailable !== null) {
    checks.push({
      id: 'contract-quote',
      label: 'Contract quote',
      category: 'trade-safety',
      passed: input.quoteAvailable,
      severity: 'warning',
      message: input.quoteAvailable
        ? undefined
        : (input.quoteReason ?? 'Contract quote unavailable'),
      actionLabel: 'Review round',
      actionTarget: 'prediction-room',
      actionHint: 'Use a nearer strike or active oracle if the contract rejects the quote.',
    })
  }

  if (input.vaultAvailable !== undefined && input.vaultAvailable !== null) {
    checks.push({
      id: 'vault-liquidity',
      label: 'Vault liquidity',
      category: 'trade-safety',
      passed: input.vaultAvailable,
      severity: 'warning',
      message: input.vaultAvailable ? undefined : (input.vaultReason ?? 'Vault unavailable'),
      actionLabel: 'Review oracle',
      actionTarget: 'oracle',
      actionHint: 'Vault data is needed to show available liquidity and payout capacity.',
    })
  }

  const hasBlocking = checks.some((c) => !c.passed && c.severity === 'blocking')
  const hasWarning = checks.some((c) => !c.passed && c.severity === 'warning')
  const blockingReasons = checks.filter((c) => !c.passed && c.severity === 'blocking')
  const warningReasons = checks.filter((c) => !c.passed && c.severity === 'warning')
  const unknown = blockingReasons.some((c) => c.id === 'oracle-health' && !input.oracleLastUpdate)

  let state: RiskState = 'ready'
  if (unknown) state = 'unknown'
  else if (hasBlocking) state = 'blocked'
  else if (hasWarning) state = 'warning'

  return {
    state,
    checks,
    blockingReasons,
    warningReasons,
    canConfirm: state !== 'blocked' && state !== 'unknown',
    canExecute: state !== 'blocked' && state !== 'unknown' && !hasWarning,
  }
}
