import { describe, expect, test } from 'bun:test'
import { detectSignalConflict } from './signal-conflict'
import type { MLResult, TradeSetup } from './types'

const baseSetup: TradeSetup = {
  dir: 'short',
  entry: 100,
  sl: 102,
  tp1: 96,
  tp2: 94,
  tp3: 92,
  rr: 2,
  confidence: 60,
  reasons: ['NWE Cross Sell', 'Lien Bearish Rev'],
  volRatio: 1,
  spotPrice: 100,
  entryMethod: 'Structure',
}

const baseMl: MLResult = {
  score: 0.62,
  label: 'BUY',
  color: '#3dd68c',
  features: {},
}

describe('detectSignalConflict', () => {
  test('flags conflict when ML is bullish and setup is short', () => {
    const result = detectSignalConflict(baseMl, baseSetup)
    expect(result.hasConflict).toBe(true)
    expect(result.mlBias).toBe('bull')
    expect(result.setupDir).toBe('short')
  })

  test('no conflict when ML is neutral', () => {
    const result = detectSignalConflict({ ...baseMl, score: 0.5, label: 'NEUTRAL' }, baseSetup)
    expect(result.hasConflict).toBe(false)
  })

  test('no conflict when directions align', () => {
    const result = detectSignalConflict(baseMl, { ...baseSetup, dir: 'long' })
    expect(result.hasConflict).toBe(false)
  })
})
