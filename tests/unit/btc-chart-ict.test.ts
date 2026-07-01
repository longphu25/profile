import { describe, expect, test } from 'bun:test'
import { computeICT } from '../../plugins/btc-chart/lib/ict-sessions'
import type { Candle } from '../../plugins/btc-chart/lib/types'

// Base UTC midnight (2024-01-01 00:00:00 UTC = 1704067200).
const DAY0 = 1704067200
const HOUR = 3600

/** Build a candle at a given UTC hour offset from DAY0. */
function candleAtHour(hourOffset: number, o: number, h: number, l: number, c: number, v = 100): Candle {
  return { time: DAY0 + hourOffset * HOUR, open: o, high: h, low: l, close: c, volume: v }
}

describe('ICT sessions', () => {
  test('returns empty result on non-intraday timeframes', () => {
    const data = [candleAtHour(0, 100, 101, 99, 100)]
    const r = computeICT(data, '1d')
    expect(r.sessions).toEqual([])
    expect(r.judas).toEqual([])
  })

  test('returns empty result on too-short data', () => {
    const data = [candleAtHour(0, 100, 101, 99, 100)]
    expect(computeICT(data, '15m').sessions).toEqual([])
  })

  test('buckets candles into Asia / London / NY sessions by UTC hour', () => {
    const data: Candle[] = []
    // Asia hours 0-7
    for (let hr = 0; hr < 8; hr++) data.push(candleAtHour(hr, 100, 105, 95, 100))
    // London hours 7-9 (7 overlaps Asia end boundary — Asia is [0,8))
    for (let hr = 8; hr < 10; hr++) data.push(candleAtHour(hr, 100, 102, 98, 100))
    // NY hours 12-14
    for (let hr = 12; hr < 15; hr++) data.push(candleAtHour(hr, 100, 103, 97, 100))

    const r = computeICT(data, '1h')
    const names = r.sessions.map((s) => s.name)
    expect(names).toContain('asia')
    expect(names).toContain('london')
    expect(names).toContain('ny')

    const asia = r.sessions.find((s) => s.name === 'asia')!
    expect(asia.high).toBe(105)
    expect(asia.low).toBe(95)
  })

  test('detects a bearish Judas swing: London bar sweeps Asia high then rejects', () => {
    const data: Candle[] = []
    // Asia session (hours 0-7): establishes high = 110, low = 90.
    for (let hr = 0; hr < 8; hr++) {
      const h = hr === 3 ? 110 : 105
      const l = hr === 5 ? 90 : 95
      data.push(candleAtHour(hr, 100, h, l, 100))
    }
    // London killzone (hour 8): wick pierces Asia high (110) but closes back
    // below it — classic stop-hunt. Volume spike to trigger volConfirm.
    data.push(candleAtHour(8, 108, 113, 107, 104, 500))
    // A few more bars so length >= 10.
    for (let hr = 9; hr < 13; hr++) data.push(candleAtHour(hr, 100, 102, 98, 100))

    const r = computeICT(data, '15m')
    expect(r.judas.length).toBeGreaterThan(0)
    const j = r.judas[r.judas.length - 1]
    expect(j.type).toBe('bearish')
    expect(j.sweptSide).toBe('high')
    expect(j.sweptLevel).toBe(110)
    expect(j.volConfirm).toBe(true)
  })

  test('detects a bullish Judas swing: London bar sweeps Asia low then rejects', () => {
    const data: Candle[] = []
    for (let hr = 0; hr < 8; hr++) data.push(candleAtHour(hr, 100, 110, 90, 100))
    // London hour 8: wick below Asia low (90) but closes back above.
    data.push(candleAtHour(8, 92, 95, 85, 96, 400))
    for (let hr = 9; hr < 13; hr++) data.push(candleAtHour(hr, 100, 102, 98, 100))

    const r = computeICT(data, '5m')
    const j = r.judas[r.judas.length - 1]
    expect(j.type).toBe('bullish')
    expect(j.sweptSide).toBe('low')
    expect(j.sweptLevel).toBe(90)
  })

  test('no Judas when London bar stays inside the Asian range', () => {
    const data: Candle[] = []
    for (let hr = 0; hr < 8; hr++) data.push(candleAtHour(hr, 100, 110, 90, 100))
    // London bars fully inside 90-110 range.
    for (let hr = 8; hr < 13; hr++) data.push(candleAtHour(hr, 100, 105, 95, 100))
    const r = computeICT(data, '15m')
    expect(r.judas).toEqual([])
  })
})
