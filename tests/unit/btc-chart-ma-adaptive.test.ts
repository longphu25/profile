import { describe, expect, test } from 'bun:test'
import {
  computeAdaptiveMaSeries,
  getAdaptiveMaPeriods,
  isMaContextBlockReason,
  maContextBlockHint,
  maContextBlockReason,
  maContextPassReason,
  passesMaContextFilter,
  snapshotAdaptiveMa,
} from '../../plugins/btc-chart/lib/ma-adaptive'
import type { Candle } from '../../plugins/btc-chart/lib/types'

function candles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }))
}

describe('getAdaptiveMaPeriods', () => {
  test('uses 9/21 on 1m through 15m', () => {
    for (const interval of ['1m', '5m', '15m'] as const) {
      expect(getAdaptiveMaPeriods(interval)).toEqual({ fast: 9, slow: 21, label: '9/21' })
    }
  })

  test('uses 20/50 on 1h', () => {
    expect(getAdaptiveMaPeriods('1h')).toEqual({ fast: 20, slow: 50, label: '20/50' })
  })

  test('uses 50/200 on 4h and 1d', () => {
    for (const interval of ['4h', '1d'] as const) {
      expect(getAdaptiveMaPeriods(interval)).toEqual({ fast: 50, slow: 200, label: '50/200' })
    }
  })
})

describe('passesMaContextFilter', () => {
  const ma = { fast: 100, slow: 98, fastPeriod: 9, slowPeriod: 21, label: '9/21' }

  test('long requires close above fast EMA', () => {
    expect(passesMaContextFilter('long', 101, ma)).toBe(true)
    expect(passesMaContextFilter('long', 100, ma)).toBe(false)
  })

  test('short requires close below fast EMA', () => {
    expect(passesMaContextFilter('short', 99, ma)).toBe(true)
    expect(passesMaContextFilter('short', 100, ma)).toBe(false)
  })

  test('passes when fast EMA is unavailable', () => {
    expect(passesMaContextFilter('long', 50, { ...ma, fast: null })).toBe(true)
  })
})

describe('MA context reason strings', () => {
  test('block and pass reasons are distinguishable', () => {
    expect(maContextBlockReason('long', 9)).toBe('MA blocked: close below fast EMA(9)')
    expect(maContextPassReason('long', 9)).toBe('MA context: close above fast EMA(9)')
    expect(isMaContextBlockReason(maContextBlockReason('short', 21))).toBe(true)
    expect(isMaContextBlockReason(maContextPassReason('short', 21))).toBe(false)
  })

  test('maContextBlockHint maps to Vietnamese wait copy', () => {
    expect(maContextBlockHint(['ML Bullish', 'MA blocked: close below fast EMA(9)'])).toBe(
      'Chờ close > EMA(9) để khóa Long',
    )
    expect(maContextBlockHint(['MA blocked: close above fast EMA(20)'])).toBe(
      'Chờ close < EMA(20) để khóa Short',
    )
  })
})

describe('computeAdaptiveMaSeries', () => {
  test('snapshot returns finite values for enough bars', () => {
    const data = candles(Array.from({ length: 30 }, (_, i) => 100 + i * 0.1))
    const series = computeAdaptiveMaSeries(data, '5m')
    const snap = snapshotAdaptiveMa(series, data.length - 1)
    expect(snap.fastPeriod).toBe(9)
    expect(snap.slowPeriod).toBe(21)
    expect(snap.fast).not.toBeNull()
    expect(snap.slow).not.toBeNull()
  })
})
