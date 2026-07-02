import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_VISIBLE_BARS,
  VIEWPORT_CENTER_PAD,
  defaultLogicalRange,
} from '../../plugins/btc-chart/lib/chart-viewport'

describe('defaultLogicalRange', () => {
  test('centers the last 120 bars with symmetric padding', () => {
    const barCount = 500
    const range = defaultLogicalRange(barCount)
    const recentStart = barCount - DEFAULT_VISIBLE_BARS
    const recentEnd = barCount - 1
    const recentMid = (recentStart + recentEnd) / 2
    const viewportMid = (range.from + range.to) / 2

    expect(viewportMid).toBeCloseTo(recentMid, 5)
    expect(range.to - range.from).toBeCloseTo(DEFAULT_VISIBLE_BARS + 2 * VIEWPORT_CENTER_PAD, 5)
    expect(range.from).toBeLessThan(recentStart)
    expect(range.to).toBeGreaterThan(recentEnd)
  })

  test('clamps left edge when history is shorter than the window', () => {
    const range = defaultLogicalRange(30)
    expect(range.from).toBe(0)
    expect(range.to).toBeGreaterThan(29)
  })
})
