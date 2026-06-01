import { describe, expect, test } from 'bun:test'
import { computeFairValue, computeRangeFairValue } from './svi.ts'
import { netOpenRanges } from './positions.ts'
import { snapStrikeRaw, usdToStrikeRaw, validateRange } from './strike.ts'
import { STRIKE_SCALE } from './constants.ts'

const SVI = {
  a: 10_000,
  b: 100_000,
  rho: 100_000_000,
  rho_negative: false,
  m: 0,
  m_negative: false,
  sigma: 500_000,
  onchain_timestamp: Date.now(),
}

describe('predict domain', () => {
  test('snaps raw strikes to oracle tick size', () => {
    expect(snapStrikeRaw(usdToStrikeRaw(70_250), 500 * STRIKE_SCALE, usdToStrikeRaw(60_000))).toBe(
      usdToStrikeRaw(70_500),
    )
  })

  test('validates range strike order', () => {
    expect(validateRange(usdToStrikeRaw(70_000), usdToStrikeRaw(71_000))).toBeNull()
    expect(validateRange(usdToStrikeRaw(71_000), usdToStrikeRaw(70_000))).toBe(
      'Lower strike must be below higher strike',
    )
  })

  test('nets minted and redeemed range events', () => {
    const minted = [
      {
        manager_id: 'm1',
        oracle_id: 'o1',
        expiry: 1,
        lower_strike: 1,
        higher_strike: 2,
        quantity: 10,
      },
      {
        manager_id: 'm1',
        oracle_id: 'o1',
        expiry: 1,
        lower_strike: 1,
        higher_strike: 2,
        quantity: 5,
      },
    ]
    const redeemed = [
      {
        manager_id: 'm1',
        oracle_id: 'o1',
        expiry: 1,
        lower_strike: 1,
        higher_strike: 2,
        quantity: 4,
      },
    ]

    expect(netOpenRanges(minted, redeemed)).toEqual([{ ...minted[0], open_quantity: 11 }])
  })

  test('computes bounded binary and range fair values', () => {
    const forward = usdToStrikeRaw(70_000)
    const expiry = Date.now() + 60 * 60 * 1000
    const pUp = computeFairValue(SVI, forward, expiry, usdToStrikeRaw(70_000), 0)
    const pRange = computeRangeFairValue(
      SVI,
      forward,
      expiry,
      usdToStrikeRaw(69_000),
      usdToStrikeRaw(71_000),
    )

    expect(pUp).toBeGreaterThan(0)
    expect(pUp).toBeLessThan(1)
    expect(pRange).toBeGreaterThanOrEqual(0)
    expect(pRange).toBeLessThanOrEqual(1)
  })
})
