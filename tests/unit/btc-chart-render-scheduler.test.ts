import { describe, expect, test } from 'bun:test'
import { bumpRenderGeneration } from '../../plugins/btc-chart/lib/chart-render-scheduler'

describe('chart-render-scheduler', () => {
  test('bumpRenderGeneration increments monotonically', () => {
    const gen = { current: 0 }
    expect(bumpRenderGeneration(gen)).toBe(1)
    expect(bumpRenderGeneration(gen)).toBe(2)
    expect(gen.current).toBe(2)
  })
})
