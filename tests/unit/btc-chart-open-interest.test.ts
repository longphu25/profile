import { describe, expect, test } from 'bun:test'
import {
  buildOiSparklinePoints,
  computeOiDeltaPct,
  formatOiDeltaPct,
  oiDeltaClass,
} from '../../plugins/btc-chart/lib/open-interest'

function hist(usd: number[], startTs = 1_700_000_000_000): { time: number; totalUsd: number }[] {
  return usd.map((totalUsd, i) => ({ time: startTs + i * 3_600_000, totalUsd }))
}

describe('open-interest', () => {
  test('computeOiDeltaPct returns nulls when history is too short', () => {
    expect(computeOiDeltaPct([])).toEqual({ h1: null, h4: null, h24: null })
    expect(computeOiDeltaPct(hist([100]))).toEqual({ h1: null, h4: null, h24: null })
  })

  test('computeOiDeltaPct computes 1h / 4h / 24h deltas', () => {
    const values = Array.from({ length: 25 }, (_, i) => 1_000_000 + i * 10_000)
    const delta = computeOiDeltaPct(hist(values))
    expect(delta.h1).toBeCloseTo(0.813, 2)
    expect(delta.h4).toBeCloseTo(3.333, 2)
    expect(delta.h24).toBeCloseTo(24.0, 1)
  })

  test('formatOiDeltaPct and oiDeltaClass', () => {
    expect(formatOiDeltaPct(1.25)).toBe('+1.25%')
    expect(formatOiDeltaPct(-2)).toBe('-2.00%')
    expect(formatOiDeltaPct(null)).toBe('—')
    expect(oiDeltaClass(1)).toBe('up')
    expect(oiDeltaClass(-1)).toBe('dn')
    expect(oiDeltaClass(0)).toBe('')
  })

  test('buildOiSparklinePoints returns polyline for two or more values', () => {
    expect(buildOiSparklinePoints([100], 100, 20)).toBeNull()
    const pts = buildOiSparklinePoints([100, 200, 150], 100, 20)
    expect(pts).toBe('0,20 50,0 100,10')
  })
})