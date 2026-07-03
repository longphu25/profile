import { describe, expect, test } from 'bun:test'
import { isDrawableLongSetup } from '../../plugins/btc-chart/lib/trade-setup-overlay'
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
