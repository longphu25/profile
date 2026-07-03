import { describe, expect, test } from 'bun:test'
import {
  isDrawableLongSetup,
  isDrawableShortSetup,
  isDrawableTradeSetup,
} from '../../plugins/btc-chart/lib/trade-setup-overlay'
import type { TradeSetup } from '../../plugins/btc-chart/lib/types'

function baseSetup(overrides: Partial<TradeSetup> = {}): TradeSetup {
  return {
    dir: 'long',
    entry: 100,
    sl: 95,
    tp1: 110,
    tp2: 120,
    rr: 2,
    confidence: 60,
    reasons: [],
    volRatio: 1,
    spotPrice: 101,
    entryMethod: 'test',
    ...overrides,
  }
}

describe('isDrawableLongSetup', () => {
  test('accepts valid LONG with sl < entry < tp1 <= tp2', () => {
    expect(isDrawableLongSetup(baseSetup())).toBe(true)
    expect(isDrawableLongSetup(baseSetup({ tp1: 120, tp2: 120 }))).toBe(true)
  })

  test('rejects short, null direction, or misordered levels', () => {
    expect(isDrawableLongSetup(baseSetup({ dir: 'short' }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ dir: null }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ sl: 101 }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ entry: 100, tp1: 99 }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ tp1: 125, tp2: 120 }))).toBe(false)
  })
})

describe('isDrawableShortSetup', () => {
  test('accepts valid SHORT with tp2 <= tp1 < entry < sl', () => {
    expect(
      isDrawableShortSetup(baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 80 })),
    ).toBe(true)
    expect(
      isDrawableShortSetup(baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 80, tp2: 80 })),
    ).toBe(true)
  })

  test('rejects long, null direction, or misordered levels', () => {
    expect(isDrawableShortSetup(baseSetup())).toBe(false)
    expect(isDrawableShortSetup(baseSetup({ dir: null }))).toBe(false)
    expect(
      isDrawableShortSetup(baseSetup({ dir: 'short', entry: 100, sl: 99, tp1: 90, tp2: 80 })),
    ).toBe(false)
    expect(
      isDrawableShortSetup(baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 101, tp2: 80 })),
    ).toBe(false)
    expect(
      isDrawableShortSetup(baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 95 })),
    ).toBe(false)
  })
})

describe('isDrawableTradeSetup', () => {
  test('accepts either valid LONG or SHORT', () => {
    expect(isDrawableTradeSetup(baseSetup())).toBe(true)
    expect(
      isDrawableTradeSetup(baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 80 })),
    ).toBe(true)
    expect(isDrawableTradeSetup(baseSetup({ dir: null }))).toBe(false)
  })
})
