import { describe, expect, test } from 'bun:test'
import {
  computeFairValue,
  computePayoutPreview,
  computeRangeFairValue,
  type SVIParams,
} from '../../plugins/predict-club/domain/payoutPreview'

const SVI_FROM_TESTNET: SVIParams = {
  a: 257_891,
  b: 22_081_730,
  rho: 318_962_000,
  rho_negative: true,
  m: 7_193_000,
  m_negative: false,
  sigma: 49_538_110,
}

describe('Predict Club payout preview', () => {
  test('uses 1e9 SVI scale and returns bounded binary probabilities', () => {
    const above = computeFairValue(
      SVI_FROM_TESTNET,
      60_000,
      Date.now() + 60 * 60_000,
      59_000,
      0,
    )
    const below = computeFairValue(
      SVI_FROM_TESTNET,
      60_000,
      Date.now() + 60 * 60_000,
      59_000,
      1,
    )

    expect(above).toBeGreaterThan(0.6)
    expect(above).toBeLessThan(0.7)
    expect(below).toBeGreaterThan(0.3)
    expect(below).toBeLessThan(0.4)
    expect(above + below).toBeCloseTo(1, 8)
  })

  test('computes bounded range fair value from two binary fair values', () => {
    const range = computeRangeFairValue(
      SVI_FROM_TESTNET,
      60_000,
      Date.now() + 60 * 60_000,
      59_000,
      61_000,
    )

    expect(range).toBeGreaterThan(0.3)
    expect(range).toBeLessThan(0.4)
  })

  test('returns explicit preview unavailable state when SVI is missing', () => {
    const preview = computePayoutPreview({
      direction: 'UP',
      strike: 59_000,
      amountDusdc: 100,
      forward: 60_000,
      expiry: Date.now() + 60 * 60_000,
      svi: null,
    })

    expect(preview.degraded).toBe(true)
    expect(preview.reason).toBe('SVI unavailable')
    expect(preview.indicativePayout).toBeNull()
  })
})
