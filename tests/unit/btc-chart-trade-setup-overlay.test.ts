import { describe, expect, test } from 'bun:test'
import {
  findNearestCuttingCandleIndex,
  isDrawableLongSetup,
  isDrawableShortSetup,
  isDrawableTradeSetup,
  layoutSetupZones,
  resolveOverlayAdjacentTickSpan,
  resolveSetupBoxLeft,
  resolveSetupBoxLeftForViewport,
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
    tp3: 130,
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
  test('accepts valid LONG with sl < entry < tp1 <= tp2 <= tp3', () => {
    expect(isDrawableLongSetup(baseSetup())).toBe(true)
    expect(isDrawableLongSetup(baseSetup({ tp1: 120, tp2: 120, tp3: 120 }))).toBe(true)
  })

  test('rejects short, null direction, or misordered levels', () => {
    expect(isDrawableLongSetup(baseSetup({ dir: 'short' }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ dir: null }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ sl: 101 }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ entry: 100, tp1: 99 }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ tp1: 125, tp2: 120, tp3: 130 }))).toBe(false)
    expect(isDrawableLongSetup(baseSetup({ tp1: 110, tp2: 130, tp3: 120 }))).toBe(false)
  })
})

describe('isDrawableShortSetup', () => {
  test('accepts valid SHORT with tp3 <= tp2 <= tp1 < entry < sl', () => {
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 80, tp3: 70 }),
      ),
    ).toBe(true)
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 80, tp2: 80, tp3: 80 }),
      ),
    ).toBe(true)
  })

  test('rejects long, null direction, or misordered levels', () => {
    expect(isDrawableShortSetup(baseSetup())).toBe(false)
    expect(isDrawableShortSetup(baseSetup({ dir: null }))).toBe(false)
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 99, tp1: 90, tp2: 80, tp3: 70 }),
      ),
    ).toBe(false)
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 101, tp2: 80, tp3: 70 }),
      ),
    ).toBe(false)
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 95, tp3: 70 }),
      ),
    ).toBe(false)
    expect(
      isDrawableShortSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 80, tp3: 85 }),
      ),
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

describe('resolveOverlayAdjacentTickSpan', () => {
  test('always hugs overlay left edge with a short fixed width', () => {
    expect(resolveOverlayAdjacentTickSpan(400)).toEqual({ x0: 346, x1: 386 })
    expect(resolveOverlayAdjacentTickSpan(14)).toBeNull()
  })
})

describe('resolveSetupBoxLeftForViewport', () => {
  test('docks to plot edge when the last candle is off-screen', () => {
    expect(resolveSetupBoxLeftForViewport(900, 10, 600)).toBe(524)
    expect(resolveSetupBoxLeftForViewport(-80, 10, 600)).toBe(524)
  })

  test('follows the last candle while it remains visible', () => {
    expect(resolveSetupBoxLeftForViewport(400, 10, 600)).toBeCloseTo(414.5, 0)
  })
})

describe('layoutSetupZones', () => {
  test('expands compressed long zones instead of collapsing them', () => {
    const layout = layoutSetupZones(
      210,
      200,
      198,
      195,
      190,
      {
        sl: 0.075,
        entry: 0.077,
        tp1: 0.081,
        tp2: 0.096,
        tp3: 0.11,
      },
      true,
    )
    expect(layout.compressed).toBe(true)
    expect(layout.riskH + layout.rewardH).toBeGreaterThanOrEqual(96)
  })

  test('keeps natural layout when there is enough pixel separation', () => {
    const layout = layoutSetupZones(
      300,
      200,
      120,
      80,
      50,
      {
        sl: 0.075,
        entry: 0.077,
        tp1: 0.081,
        tp2: 0.096,
        tp3: 0.12,
      },
      true,
    )
    expect(layout.compressed).toBe(false)
    expect(layout.riskH).toBe(100)
    expect(layout.rewardH).toBe(150)
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
      isDrawableTradeSetup(
        baseSetup({ dir: 'short', entry: 100, sl: 105, tp1: 90, tp2: 80, tp3: 70 }),
      ),
    ).toBe(true)
    expect(isDrawableTradeSetup(baseSetup({ dir: null }))).toBe(false)
  })
})
