import { describe, expect, test } from 'bun:test'
import {
  applyPendingViewportLock,
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

  test('applyPendingViewportLock restores then clears the lock ref', () => {
    const lockRef = { current: { from: 10, to: 50 } }
    const applied: Array<{ from: number; to: number } | null> = []
    const chart = {
      getVisibleLogicalRange: () => null,
      setVisibleLogicalRange: (range: { from: number; to: number }) => {
        applied.push(range)
      },
    }
    applyPendingViewportLock(lockRef, [chart])
    expect(applied).toEqual([{ from: 10, to: 50 }])
    expect(lockRef.current).toBeNull()
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
