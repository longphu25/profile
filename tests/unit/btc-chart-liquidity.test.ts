import { describe, expect, test } from 'bun:test'
import { computeLiquidity, HTF_MAP } from '../../plugins/btc-chart/lib/liquidity'
import type { Candle } from '../../plugins/btc-chart/lib/types'
import type { SMCResult } from '../../plugins/btc-chart/smc-wasm'

const DAY0 = 1704067200 // 2024-01-01 00:00:00 UTC
const HOUR = 3600

function candleAtHour(hourOffset: number, o: number, h: number, l: number, c: number, v = 100): Candle {
  return { time: DAY0 + hourOffset * HOUR, open: o, high: h, low: l, close: c, volume: v }
}

const EMPTY_SMC: SMCResult = { structures: [], orderBlocks: [], fvgs: [] }

/** A flat range 90-110 with 30 bars of noise inside. */
function rangeData(): Candle[] {
  const data: Candle[] = []
  for (let i = 0; i < 30; i++) {
    const h = i === 5 ? 110 : 105
    const l = i === 8 ? 90 : 95
    data.push(candleAtHour(i, 100, h, l, 100))
  }
  return data
}

describe('ICT Liquidity', () => {
  test('HTF_MAP maps one level up and 1d has none', () => {
    expect(HTF_MAP['1h']).toBe('4h')
    expect(HTF_MAP['1m']).toBe('15m')
    expect(HTF_MAP['1d']).toBeNull()
  })

  test('returns empty result on too-short data', () => {
    const r = computeLiquidity([candleAtHour(0, 100, 101, 99, 100)], null, EMPTY_SMC, '1h')
    expect(r.range).toBeNull()
    expect(r.sweeps).toEqual([])
  })

  test('builds a trading range with equilibrium at the midpoint', () => {
    const r = computeLiquidity(rangeData(), null, EMPTY_SMC, '1h')
    expect(r.range).not.toBeNull()
    expect(r.range!.high).toBe(110)
    expect(r.range!.low).toBe(90)
    expect(r.range!.equilibrium).toBe(100)
  })

  test('hasBOS reflects an SMC BOS structure', () => {
    const smc: SMCResult = {
      structures: [{ time: DAY0, price: 100, endTime: DAY0 + HOUR, type: 'BOS', bias: 'bull' }],
      orderBlocks: [],
      fvgs: [],
    }
    const r = computeLiquidity(rangeData(), null, smc, '1h')
    expect(r.range!.hasBOS).toBe(true)
    expect(r.range!.bosBias).toBe('bull')
  })

  test('detects a bearish sweep of the external high in the London killzone', () => {
    // HTF establishes the 90-110 range so the current-frame sweep bar (which
    // pierces above 110) does not pollute the range boundary itself.
    const htf: Candle[] = []
    for (let i = 0; i < 12; i++) {
      const h = i === 3 ? 110 : 105
      const l = i === 6 ? 90 : 95
      htf.push(candleAtHour(i * 4, 100, h, l, 100))
    }

    const data: Candle[] = []
    for (let i = 0; i < 20; i++) data.push(candleAtHour(i, 100, 105, 95, 100))
    // Hour 8 = inside London killzone [7,10): wick pierces 110, closes back below.
    data.push(candleAtHour(8 + 24, 108, 113, 107, 104, 300))
    for (let i = 0; i < 4; i++) data.push(candleAtHour(9 + 24 + i, 100, 102, 98, 100))

    const r = computeLiquidity(data, htf, EMPTY_SMC, '15m')
    expect(r.range!.high).toBe(110)
    const last = r.sweeps[r.sweeps.length - 1]
    expect(last.type).toBe('bearish')
    expect(last.side).toBe('high')
    expect(last.inKillzone).toBe(true)
  })

  test('flips a bull FVG into a bearish inverse-FVG when price closes below it', () => {
    const data: Candle[] = []
    for (let i = 0; i < 30; i++) data.push(candleAtHour(i, 100, 105, 95, 100))
    // A later candle closes decisively below the gap bottom (98).
    data.push(candleAtHour(30, 97, 98, 90, 92))

    const smc: SMCResult = {
      structures: [],
      orderBlocks: [],
      fvgs: [{ time: DAY0 + 5 * HOUR, top: 102, bottom: 98, bias: 'bull' }],
    }
    const r = computeLiquidity(data, null, smc, '1h')
    expect(r.inverseFvgs.length).toBeGreaterThan(0)
    expect(r.inverseFvgs[0].flippedBias).toBe('bear')
  })

  test('classifies swing extremes at the range edge as external liquidity', () => {
    const r = computeLiquidity(rangeData(), null, EMPTY_SMC, '1h')
    const external = r.levels.filter((l) => l.side === 'external')
    // The 110 high and 90 low should register as external pools.
    expect(external.some((l) => l.kind === 'swing-high')).toBe(true)
    expect(external.some((l) => l.kind === 'swing-low')).toBe(true)
  })

  test('nextTarget points at undrawn external liquidity when price is mid-range', () => {
    const r = computeLiquidity(rangeData(), null, EMPTY_SMC, '1h')
    expect(r.nextTarget).not.toBeNull()
    expect(r.nextTarget!.side).toBe('external')
  })
})
