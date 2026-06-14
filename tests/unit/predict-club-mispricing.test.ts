import { afterEach, describe, expect, mock, test } from 'bun:test'

// Mock the one network-costly call before importing the module under test, so the
// cache/TTL/in-flight behavior can be exercised without touching testnet RPC.
let quoteCalls = 0
let nextImpliedProbability: number | null = 0.6
let nextReason: string | undefined

// Preserve every real export and override only the network call, so this mock
// does not wipe sibling exports (sanitizeContractQuoteReason, etc.) for other
// test files sharing this bun process.
const realPricingService = await import(
  '../../plugins/predict-club/infrastructure/deepbookPredictPricingService'
)
mock.module(
  '../../plugins/predict-club/infrastructure/deepbookPredictPricingService',
  () => ({
    ...realPricingService,
    quoteBinaryStrike: async () => {
      quoteCalls += 1
      return {
        impliedProbability: nextImpliedProbability,
        estimatedCost: nextImpliedProbability == null ? null : nextImpliedProbability * 10,
        reason: nextReason,
      }
    },
  }),
)

const {
  _clearMispriceCache,
  atmBandStrikes,
  buildMispriceCell,
  getMispriceBand,
  getMispriceCell,
  mispriceCacheKey,
} = await import('../../plugins/predict-club/application/mispricing')

afterEach(() => {
  _clearMispriceCache()
  quoteCalls = 0
  nextImpliedProbability = 0.6
  nextReason = undefined
})

describe('Predict Club mispricing math', () => {
  test('edge is contract minus fair when both sides are present', () => {
    const cell = buildMispriceCell('orc', 100, 0.5, 0.62)
    expect(cell.edge).toBeCloseTo(0.12, 12)
    expect(cell.fairProbability).toBe(0.5)
    expect(cell.contractProbability).toBe(0.62)
  })

  test('a cheaper contract yields a negative (buy-side) edge', () => {
    const cell = buildMispriceCell('orc', 100, 0.7, 0.55)
    expect(cell.edge).toBeCloseTo(-0.15, 12)
  })

  test('edge is null (not a fake zero) when either side is missing', () => {
    expect(buildMispriceCell('orc', 100, null, 0.6).edge).toBeNull()
    expect(buildMispriceCell('orc', 100, 0.6, null).edge).toBeNull()
    expect(buildMispriceCell('orc', 100, null, null).edge).toBeNull()
  })

  test('carries a defined reason through when the contract side is degraded', () => {
    const cell = buildMispriceCell('orc', 100, 0.5, null, 'out of bounds')
    expect(cell.reason).toBe('out of bounds')
    expect(cell.edge).toBeNull()
  })
})

describe('Predict Club mispricing cache key', () => {
  test('is stable per (oracle, strike) and distinct across either', () => {
    expect(mispriceCacheKey('a', 100)).toBe(mispriceCacheKey('a', 100))
    expect(mispriceCacheKey('a', 100)).not.toBe(mispriceCacheKey('b', 100))
    expect(mispriceCacheKey('a', 100)).not.toBe(mispriceCacheKey('a', 101))
  })
})

describe('Predict Club ATM band selection', () => {
  test('picks the 2*radius+1 strikes nearest the forward, sorted descending', () => {
    const strikes = [120, 115, 110, 105, 100, 95, 90]
    expect(atmBandStrikes(strikes, 104, 1)).toEqual([110, 105, 100])
  })

  test('clamps to the available strikes when the band is wider than the axis', () => {
    expect(atmBandStrikes([100, 95], 97, 3)).toEqual([100, 95])
  })
})

describe('Predict Club mispricing cache + in-flight coalescing', () => {
  const base = {
    oracleId: 'orc',
    expiryMs: 1_900_000_000_000,
    forward: 100,
    svi: null,
    walletAddress: null,
  }

  test('serves a fresh cache entry without re-quoting within the TTL', async () => {
    await getMispriceCell({ ...base, strike: 100, nowMs: 1_000 })
    expect(quoteCalls).toBe(1)
    await getMispriceCell({ ...base, strike: 100, nowMs: 5_000 })
    expect(quoteCalls).toBe(1)
  })

  test('re-quotes once the TTL has elapsed', async () => {
    await getMispriceCell({ ...base, strike: 100, nowMs: 1_000 })
    expect(quoteCalls).toBe(1)
    await getMispriceCell({ ...base, strike: 100, nowMs: 1_000 + 20_001 })
    expect(quoteCalls).toBe(2)
  })

  test('coalesces concurrent callers for the same key into one quote', async () => {
    const [a, b] = await Promise.all([
      getMispriceCell({ ...base, strike: 100, nowMs: 1_000 }),
      getMispriceCell({ ...base, strike: 100, nowMs: 1_000 }),
    ])
    expect(quoteCalls).toBe(1)
    expect(a.contractProbability).toBe(b.contractProbability)
  })

  test('a band returns one cell per strike and caches each key', async () => {
    const cells = await getMispriceBand({ ...base, strikes: [105, 100, 95] })
    expect(cells).toHaveLength(3)
    expect(cells.map((c) => c.strike)).toEqual([105, 100, 95])
    expect(quoteCalls).toBe(3)
  })

  test('a degraded contract quote yields a null edge with a reason', async () => {
    nextImpliedProbability = null
    nextReason = 'outside pricing bounds'
    const cell = await getMispriceCell({ ...base, strike: 100, nowMs: 1_000 })
    expect(cell.contractProbability).toBeNull()
    expect(cell.edge).toBeNull()
    expect(cell.reason).toBe('outside pricing bounds')
  })
})
