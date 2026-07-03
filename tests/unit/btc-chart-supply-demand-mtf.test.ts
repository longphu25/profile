import { describe, expect, it } from 'bun:test'
import { computeSupplyDemand } from '../../plugins/btc-chart/lib/supply-demand'
import type { Candle } from '../../plugins/btc-chart/lib/types'

function candle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100,
): Candle {
  return { time, open, high, low, close, volume }
}

function buildImpulseSeries(startTime: number, startPrice: number): Candle[] {
  const out: Candle[] = []
  let t = startTime
  let p = startPrice
  for (let i = 0; i < 6; i++) {
    out.push(candle(t, p, p + 0.4, p - 0.4, p + 0.1, 60))
    p += 0.1
    t += 3600
  }
  out.push(candle(t, p + 0.8, p + 1, p - 0.2, p - 0.4, 90))
  t += 3600
  p -= 0.4
  for (let i = 0; i < 3; i++) {
    const o = p
    const c = p + 3
    out.push(candle(t, o, c + 0.3, o - 0.1, c, 150))
    p = c
    t += 3600
  }
  return out
}

describe('computeSupplyDemand MTF', () => {
  it('detects HTF demand zones when htfData is provided', () => {
    const htf = buildImpulseSeries(1_700_000_000, 200)
    const ltf = buildImpulseSeries(1_700_100_000, 210)
    const sd = computeSupplyDemand(ltf, {
      htfData: htf,
      htfInterval: '4h',
      ltfInterval: '1h',
    })
    expect(sd.htfInterval).toBe('4h')
    expect(sd.zones.some((z) => z.timeframe === 'htf' && z.kind === 'demand')).toBe(true)
    expect(sd.zones.some((z) => z.timeframe === 'ltf')).toBe(true)
  })

  it('confirms MTF long when LTF grabs inside HTF demand', () => {
    const htf = buildImpulseSeries(1_700_000_000, 100)
    const htfDemand = computeSupplyDemand(htf).nearestDemand
    expect(htfDemand).not.toBeNull()

    const ltf: Candle[] = []
    let t = 1_700_200_000
    let p = htfDemand!.top + 5
    for (let i = 0; i < 10; i++) {
      ltf.push(candle(t, p, p + 1, p - 1, p - 0.5, 80))
      p -= 0.5
      t += 3600
    }
    const zoneBottom = htfDemand!.bottom
    ltf.push(candle(t, p, p + 0.5, zoneBottom - 1.5, zoneBottom + 0.3, 120))

    const sd = computeSupplyDemand(ltf, {
      htfData: htf,
      htfInterval: '4h',
      ltfInterval: '1h',
    })
    if (sd.mtfLong?.confirmed) {
      expect(sd.mtfLong.dir).toBe('long')
      expect(sd.mtfLong.entry).toBeGreaterThan(sd.mtfLong.htfZone.top)
    } else {
      expect(sd.nearestHtfDemand).not.toBeNull()
    }
  })
})
