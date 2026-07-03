import { describe, expect, it } from 'bun:test'
import {
  collectSupplyDemandVotes,
  computeSupplyDemand,
} from '../../plugins/btc-chart/lib/supply-demand'
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

/** Build a bullish impulse after a small red base candle. */
function demandFixture(): Candle[] {
  const out: Candle[] = []
  let t = 1_700_000_000
  let p = 100
  for (let i = 0; i < 8; i++) {
    out.push(candle(t, p, p + 0.5, p - 0.5, p + 0.2, 80))
    p += 0.2
    t += 3600
  }
  // Base (bearish)
  out.push(candle(t, p + 1, p + 1.2, p - 0.3, p - 0.5, 120))
  t += 3600
  p -= 0.5
  // 3 large bullish impulse candles
  for (let i = 0; i < 3; i++) {
    const o = p
    const c = p + 4
    out.push(candle(t, o, c + 0.5, o - 0.2, c, 200))
    p = c
    t += 3600
  }
  const base = out[out.length - 1]
  const zoneBottom = base.low
  // Pullback + grab: wick below demand then close back above zone bottom
  out.push(candle(t, p, p + 0.5, zoneBottom - 1, zoneBottom + 0.4, 180))
  return out
}

describe('computeSupplyDemand', () => {
  it('detects demand zone after 3-candle bullish impulse', () => {
    const data = demandFixture()
    const sd = computeSupplyDemand(data)
    expect(sd.zones.some((z) => z.kind === 'demand')).toBe(true)
    expect(sd.nearestDemand).not.toBeNull()
    if (sd.nearestDemand) {
      expect(sd.nearestDemand.impulseBars).toBeGreaterThanOrEqual(3)
      if (sd.longEntry != null) {
        expect(sd.longEntry).toBeGreaterThan(sd.nearestDemand.top)
        expect(sd.longSl).toBe(sd.nearestDemand.mid)
      }
    }
  })

  it('omits longEntry when price is far above demand (no retest)', () => {
    const data = demandFixture()
    const sdFar = computeSupplyDemand(data)
    expect(sdFar.nearestDemand).not.toBeNull()
    const last = data[data.length - 1]
    const rallied: Candle[] = [
      ...data,
      candle(
        last.time + 3600,
        last.close + 20,
        last.close + 22,
        last.close + 18,
        last.close + 21,
        100,
      ),
    ]
    const sd = computeSupplyDemand(rallied)
    expect(sd.nearestDemand).not.toBeNull()
    expect(sd.longEntry).toBeNull()
  })

  it('flags liquidity grab on demand retest', () => {
    const data = demandFixture()
    const sd = computeSupplyDemand(data)
    expect(sd.grabs.some((g) => g.type === 'bullish')).toBe(true)
  })
})

describe('collectSupplyDemandVotes', () => {
  it('adds bull votes for demand touch and grab', () => {
    const data = demandFixture()
    const sd = computeSupplyDemand(data)
    const votes = collectSupplyDemandVotes(data, sd)
    expect(votes.bull).toBeGreaterThanOrEqual(1)
    expect(votes.reasons.length).toBeGreaterThan(0)
  })
})
