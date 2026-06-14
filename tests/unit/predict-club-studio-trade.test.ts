import { describe, expect, test } from 'bun:test'
import type { Transaction } from '@mysten/sui/transactions'
import {
  buildStudioRiskInput,
  recommendDirection,
  submitStudioTrade,
  type StudioTradeParams,
} from '../../plugins/predict-club/application/submitStudioTrade'

const MINUTE_MS = 60_000
const NOW = 1_700_000_000_000

// A live, tradable risk context: fresh oracle, active, SVI + forward present,
// ample balance, far-enough expiry. Individual tests override one field to drive
// a specific gate to fail. The oracle-staleness check inside evaluateRiskGate reads
// the real Date.now() (it takes no injected clock), so the freshness fields anchor
// on Date.now() rather than the fixed NOW used for deterministic expiry math.
function liveRiskParams(overrides: Partial<Parameters<typeof buildStudioRiskInput>[0]> = {}) {
  const realNow = Date.now()
  return buildStudioRiskInput({
    expiryMs: realNow + 60 * MINUTE_MS,
    nowMs: realNow,
    oracleStatus: 'active',
    oracleLastUpdateMs: realNow,
    hasSvi: true,
    hasForward: true,
    memberDusdc: 100,
    amountDusdc: 10,
    walletConnected: true,
    managerReady: true,
    ...overrides,
  })
}

const TRADE: StudioTradeParams = {
  direction: 'UP',
  strike: 65_000,
  amountDusdc: 10,
  oracleId: '0xoracle',
  expiryMs: NOW + 60 * MINUTE_MS,
  walletAddress: '0xwallet',
  managerId: '0xmanager',
  tickSize: 1_000_000_000,
  minStrike: 50_000_000_000_000,
}

// A stub gateway that records what buildMintTx was called with, so the test can
// assert the strike unit reaches the gateway unscaled (USD), not pre-multiplied.
function stubGateway() {
  const calls: Array<Record<string, unknown>> = []
  return {
    calls,
    buildMintTx: async (params: Record<string, unknown>) => {
      calls.push(params)
      return { __tx: true } as unknown as Transaction
    },
  }
}

describe('recommendDirection', () => {
  test('fair above contract recommends UP (UP underpriced = value)', () => {
    expect(recommendDirection(0.62, 0.55)).toBe('UP')
  })

  test('fair below contract recommends DOWN', () => {
    expect(recommendDirection(0.5, 0.6)).toBe('DOWN')
  })

  test('a gap within noise gives no hint', () => {
    expect(recommendDirection(0.6, 0.598)).toBeNull()
  })

  test('a missing side gives no hint (never guesses)', () => {
    expect(recommendDirection(0.6, null)).toBeNull()
    expect(recommendDirection(null, 0.6)).toBeNull()
  })
})

describe('buildStudioRiskInput', () => {
  test('derives expiry minutes from the expiry timestamp and clock', () => {
    const input = buildStudioRiskInput({
      expiryMs: NOW + 42 * MINUTE_MS,
      nowMs: NOW,
      oracleStatus: 'active',
      oracleLastUpdateMs: NOW,
      hasSvi: true,
      hasForward: true,
      memberDusdc: 50,
      amountDusdc: 10,
      walletConnected: true,
      managerReady: true,
    })
    expect(input.expiryMinutes).toBe(42)
    expect(input.signalBias).toBe('neutral')
    expect(input.indicators).toEqual([])
    // Quote / vault are warning-severity and left undefined so they never block
    // a cell outside the quoted band; the contract is the final gate at mint.
    expect(input.quoteAvailable).toBeUndefined()
    expect(input.vaultAvailable).toBeUndefined()
  })

  test('maps oracle status to the active flag', () => {
    expect(buildStudioRiskInput({ ...baseParams(), oracleStatus: 'active' }).oracleActive).toBe(true)
    expect(buildStudioRiskInput({ ...baseParams(), oracleStatus: 'settled' }).oracleActive).toBe(
      false,
    )
    expect(buildStudioRiskInput({ ...baseParams(), oracleStatus: null }).oracleActive).toBeNull()
  })
})

function baseParams() {
  return {
    expiryMs: NOW + 60 * MINUTE_MS,
    nowMs: NOW,
    oracleStatus: 'active' as string | null,
    oracleLastUpdateMs: NOW,
    hasSvi: true,
    hasForward: true,
    memberDusdc: 100,
    amountDusdc: 10,
    walletConnected: true,
    managerReady: true,
  }
}

describe('submitStudioTrade', () => {
  test('a live path builds the mint and returns the signed digest', async () => {
    const gateway = stubGateway()
    let signed = false
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      signAndExecute: async () => {
        signed = true
        return { digest: '0xdigest' }
      },
    })
    expect(result.ok).toBe(true)
    expect(result.digest).toBe('0xdigest')
    expect(signed).toBe(true)
  })

  test('passes the strike to the gateway as USD, unscaled', async () => {
    const gateway = stubGateway()
    await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      signAndExecute: async () => ({ digest: '0xok' }),
    })
    expect(gateway.calls).toHaveLength(1)
    // 65_000 USD must reach the gateway as-is; snapStrike applies the 1e9 scale.
    expect(gateway.calls[0].strike).toBe(65_000)
    expect(gateway.calls[0].direction).toBe('UP')
  })

  test('a too-short expiry is blocked before any signing', async () => {
    const gateway = stubGateway()
    let signed = false
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams({ expiryMs: NOW + MINUTE_MS }),
      gateway,
      signAndExecute: async () => {
        signed = true
        return { digest: 'x' }
      },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/expiry/i)
    expect(signed).toBe(false)
    expect(gateway.calls).toHaveLength(0)
  })

  test('an insufficient balance is blocked', async () => {
    const gateway = stubGateway()
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams({ memberDusdc: 1, amountDusdc: 10 }),
      gateway,
      signAndExecute: async () => ({ digest: 'x' }),
    })
    expect(result.ok).toBe(false)
    expect(gateway.calls).toHaveLength(0)
  })

  test('a stale oracle is blocked', async () => {
    const gateway = stubGateway()
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams({ oracleLastUpdateMs: NOW - 10 * MINUTE_MS }),
      gateway,
      signAndExecute: async () => ({ digest: 'x' }),
    })
    expect(result.ok).toBe(false)
    expect(gateway.calls).toHaveLength(0)
  })

  test('a signer failure surfaces as an error result, not a throw', async () => {
    const gateway = stubGateway()
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      signAndExecute: async () => {
        throw new Error('user rejected')
      },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('user rejected')
  })

  test('a strike the contract will not price is blocked before any signing', async () => {
    const gateway = stubGateway()
    let signed = false
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      preflightQuote: async () => ({ ok: false, reason: 'strike outside pricing bounds' }),
      signAndExecute: async () => {
        signed = true
        return { digest: 'x' }
      },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('strike outside pricing bounds')
    // Caught read-only: never built the PTB, never asked the wallet to sign.
    expect(gateway.calls).toHaveLength(0)
    expect(signed).toBe(false)
  })

  test('a passing pre-flight lets the trade through to signing', async () => {
    const gateway = stubGateway()
    let preflighted = false
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      preflightQuote: async () => {
        preflighted = true
        return { ok: true }
      },
      signAndExecute: async () => ({ digest: '0xpassed' }),
    })
    expect(preflighted).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.digest).toBe('0xpassed')
    expect(gateway.calls).toHaveLength(1)
  })

  test('a pre-flight throw surfaces as an error result, not a throw', async () => {
    const gateway = stubGateway()
    const result = await submitStudioTrade(TRADE, {
      riskInput: liveRiskParams(),
      gateway,
      preflightQuote: async () => {
        throw new Error('devInspect unreachable')
      },
      signAndExecute: async () => ({ digest: 'x' }),
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('devInspect unreachable')
    expect(gateway.calls).toHaveLength(0)
  })
})
