import { describe, expect, test } from 'bun:test'
import { calcNadarayaWatson } from './nadaraya-watson'
import type { Candle } from './types'

function candle(i: number, close: number): Candle {
  return { time: i, open: close, high: close + 1, low: close - 1, close, volume: 1 }
}

describe('calcNadarayaWatson', () => {
  test('emits buy when close recovers above lower band', () => {
    const data: Candle[] = []
    for (let i = 0; i < 40; i++) data.push(candle(i, 100))
    data.push(candle(40, 92))
    data.push(candle(41, 98))

    const result = calcNadarayaWatson(data, {
      repaint: false,
      bandwidth: 4,
      multiplier: 1.5,
      maxBarsBack: 20,
    })

    const buyAt41 = result.signals.some((s) => s.index === 41 && s.type === 'buy')
    expect(buyAt41).toBe(true)
  })

  test('emits sell when close rejects below upper band', () => {
    const data: Candle[] = []
    for (let i = 0; i < 40; i++) data.push(candle(i, 100))
    data.push(candle(40, 108))
    data.push(candle(41, 102))

    const result = calcNadarayaWatson(data, {
      repaint: false,
      bandwidth: 4,
      multiplier: 1.5,
      maxBarsBack: 20,
    })

    const sellAt41 = result.signals.some((s) => s.index === 41 && s.type === 'sell')
    expect(sellAt41).toBe(true)
  })

  test('repaint mode fills the lookback window', () => {
    const data = Array.from({ length: 80 }, (_, i) => candle(i, 100 + Math.sin(i / 4)))
    const result = calcNadarayaWatson(data, { repaint: true, maxBarsBack: 40 })
    const filled = result.mid.filter((v) => v != null).length
    expect(filled).toBe(40)
  })
})
