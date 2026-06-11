import { describe, expect, test } from 'bun:test'
import { evaluateRiskGate, type RiskGateInput } from '../../plugins/predict-club/domain/riskGate'

const baseInput: RiskGateInput = {
  oracleLastUpdate: Date.now(),
  expiryMinutes: 90,
  memberDusdc: 500,
  suggestedDusdc: 100,
  signalBias: 'bullish',
  indicators: [],
  walletConnected: true,
  predictManagerReady: true,
  oracleActive: true,
  priceAvailable: true,
  sviAvailable: true,
  quoteAvailable: true,
  vaultAvailable: true,
}

describe('Predict Club risk gate data readiness', () => {
  test('adds explicit market data checks for oracle, forward, and SVI', () => {
    const risk = evaluateRiskGate({
      ...baseInput,
      oracleActive: false,
      priceAvailable: false,
      sviAvailable: false,
    })

    expect(risk.checks.find((check) => check.id === 'oracle-active')?.message).toBe(
      'Selected oracle is not active',
    )
    expect(risk.checks.find((check) => check.id === 'forward-price')?.message).toBe(
      'Forward price unavailable',
    )
    expect(risk.checks.find((check) => check.id === 'svi-surface')?.message).toBe(
      'SVI unavailable',
    )
    expect(risk.state).toBe('blocked')
  })

  test('keeps quote and vault unavailable as warning reasons with explicit messages', () => {
    const risk = evaluateRiskGate({
      ...baseInput,
      quoteAvailable: false,
      quoteReason: 'Contract quote rejected this strike',
      vaultAvailable: false,
      vaultReason: 'Vault liquidity unavailable: Sui RPC rate limit reached',
    })

    const quote = risk.checks.find((check) => check.id === 'contract-quote')
    const vault = risk.checks.find((check) => check.id === 'vault-liquidity')

    expect(quote?.severity).toBe('warning')
    expect(quote?.message).toBe('Contract quote rejected this strike')
    expect(vault?.severity).toBe('warning')
    expect(vault?.message).toBe('Vault liquidity unavailable: Sui RPC rate limit reached')
    expect(risk.state).toBe('warning')
    expect(risk.canExecute).toBe(false)
  })
})
