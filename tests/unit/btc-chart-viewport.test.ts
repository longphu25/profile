import { describe, expect, test } from 'bun:test'
import {
  getVisibleLogicalRangeSafe,
  setVisibleLogicalRangeSafe,
} from '../../plugins/btc-chart/lib/chart-viewport'

describe('chart viewport helpers', () => {
  test('getVisibleLogicalRangeSafe returns null for missing chart', () => {
    expect(getVisibleLogicalRangeSafe(null)).toBeNull()
  })

  test('setVisibleLogicalRangeSafe is a no-op for missing chart', () => {
    expect(() => setVisibleLogicalRangeSafe(null, { from: 0, to: 10 })).not.toThrow()
  })

  test('getVisibleLogicalRangeSafe swallows teardown errors', () => {
    const chart = {
      getVisibleLogicalRange: () => {
        throw new Error('removed')
      },
      setVisibleLogicalRange: () => undefined,
    }
    expect(getVisibleLogicalRangeSafe(chart)).toBeNull()
  })
})
