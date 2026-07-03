import { describe, expect, test } from 'bun:test'
import {
  findNearestCuttingCandleIndex,
  isDrawableLongSetup,
  isDrawableShortSetup,
  isDrawableTradeSetup,
  resolveSetupBoxLeft,
} from '../../plugins/btc-chart/lib/trade-setup-overlay'
import type { Candle } from '../../plugins/btc-chart/lib/types'
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

const sampleCandles: Candle[] = [
  { time: 1, open: 98, high: 102, low: 97, close: 100, volume: 1 },
  { time: 2, open: 100, high: 105, low: 99, close: 104, volume: 1 },
  { time: 3, open: 104, high: 108, low: 103, close: 106, volume: 1 },
]

describe('findNearestCuttingCandleIndex', () => {
  test('returns the latest candle that intersects the price', () => {
    expect(findNearestCuttingCandleIndex(sampleCandles, 100)).toBe(1)
    expect(findNearestCuttingCandleIndex(sampleCandles, 107)).toBe(2)
    expect(findNearestCuttingCandleIndex(sampleCandles, 120)).toBe(-1)
  })
})

describe('resolveSetupBoxLeft', () => {
  test('anchors beside last candle with gap, clamped before price scale', () => {
    // last candle center x=400, barSpacing=10 -> halfW=4.5, gap=10 => 414.5 ~ 415
    expect(resolveSetupBoxLeft(400, 10, 600, 76)).toBeCloseTo(414.5, 0)
    // clamp when candle is near right edge
    expect(resolveSetupBoxLeft(550, 10, 600, 76)).toBe(524)
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
