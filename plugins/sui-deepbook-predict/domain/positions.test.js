import { describe, expect, test } from 'bun:test'
import {
  inferOverlayStatus,
  mergeOverlays,
  netOpenRanges,
  toBinaryOverlays,
  toRangeOverlays,
} from './positions.ts'
import { normalizeRange, snapStrikeRaw, usdToStrikeRaw, validateRange } from './strike.ts'
import { STRIKE_SCALE } from './constants.ts'

const binaryRow = {
  manager_id: 'm1',
  oracle_id: 'o1',
  expiry: 1,
  strike: usdToStrikeRaw(70_000),
  is_up: true,
  open_quantity: 3,
}

const mintedRange = {
  manager_id: 'm1',
  oracle_id: 'o1',
  expiry: 1,
  lower_strike: usdToStrikeRaw(69_000),
  higher_strike: usdToStrikeRaw(71_000),
  quantity: 10,
}

describe('overlay mapping', () => {
  test('maps binary positions to overlays', () => {
    const [overlay] = toBinaryOverlays([binaryRow])
    expect(overlay.kind).toBe('binary')
    expect(overlay.oracleId).toBe('o1')
    expect(overlay.strike).toBe(usdToStrikeRaw(70_000))
    expect(overlay.isUp).toBe(true)
    expect(overlay.quantity).toBe(3)
  })

  test('maps netted ranges to overlays with open quantity', () => {
    const open = netOpenRanges([mintedRange], [])
    const [overlay] = toRangeOverlays(open)
    expect(overlay.kind).toBe('range')
    expect(overlay.lowerStrike).toBe(usdToStrikeRaw(69_000))
    expect(overlay.upperStrike).toBe(usdToStrikeRaw(71_000))
    expect(overlay.quantity).toBe(10)
  })

  test('infers overlay status from row status', () => {
    expect(inferOverlayStatus({ status: 'settled' })).toBe('claimable')
    expect(inferOverlayStatus({ status: 'awaiting_settlement' })).toBe('awaiting-settlement')
    expect(inferOverlayStatus({})).toBe('open')
  })
})

describe('mergeOverlays', () => {
  test('merges binary + range overlays for the oracle', () => {
    const merged = mergeOverlays(
      { positions: [binaryRow], ranges: netOpenRanges([mintedRange], []) },
      'o1',
    )
    expect(merged).toHaveLength(2)
    expect(merged.map((o) => o.kind).sort()).toEqual(['binary', 'range'])
  })

  test('filters out positions from other oracles', () => {
    const merged = mergeOverlays({ positions: [binaryRow], ranges: [] }, 'other-oracle')
    expect(merged).toHaveLength(0)
  })

  test('drops zero-quantity (fully redeemed) ranges', () => {
    const open = netOpenRanges([mintedRange], [{ ...mintedRange, quantity: 10 }])
    const merged = mergeOverlays({ positions: [], ranges: open }, 'o1')
    expect(merged).toHaveLength(0)
  })

  test('returns empty for empty manager snapshot', () => {
    expect(mergeOverlays({ positions: [], ranges: [] }, 'o1')).toEqual([])
  })

  test('returns empty when oracle id is null', () => {
    expect(mergeOverlays({ positions: [binaryRow], ranges: [] }, null)).toEqual([])
  })
})

describe('strike helpers', () => {
  test('snaps to nearest tick relative to min strike', () => {
    const tick = 500 * STRIKE_SCALE
    expect(snapStrikeRaw(usdToStrikeRaw(70_240), tick, usdToStrikeRaw(60_000))).toBe(
      usdToStrikeRaw(70_000),
    )
    expect(snapStrikeRaw(usdToStrikeRaw(70_260), tick, usdToStrikeRaw(60_000))).toBe(
      usdToStrikeRaw(70_500),
    )
  })

  test('clamps to min strike when tick size is invalid', () => {
    expect(snapStrikeRaw(10, 0, 100)).toBe(100)
  })

  test('normalizes out-of-order range bounds', () => {
    expect(normalizeRange(71_000, 69_000)).toEqual({ lowerStrike: 69_000, higherStrike: 71_000 })
  })

  test('rejects invalid ranges', () => {
    expect(validateRange(0, 100)).toBe('Range strikes must be positive')
    expect(validateRange(100, 100)).toBe('Lower strike must be below higher strike')
    expect(validateRange(Number.NaN, 100)).toBe('Range strikes are invalid')
    expect(validateRange(100, 200)).toBeNull()
  })
})
