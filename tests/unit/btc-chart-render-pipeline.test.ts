import { describe, expect, test } from 'bun:test'
import { buildSidebarSnapshot } from '../../plugins/btc-chart/lib/build-sidebar-snapshot'
import type { Candle } from '../../plugins/btc-chart/lib/types'

const BASE_CANDLE: Candle = {
  time: 1_700_000_000,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
}

function minimalSnapshotParams(overrides: {
  rsi?: (number | null)[]
  sma50?: (number | null)[]
  sma200?: (number | null)[]
}) {
  const data = [BASE_CANDLE]
  const nulls = [null]
  return {
    data,
    nwe: { mid: nulls, upper: nulls, lower: nulls },
    sma50: overrides.sma50 ?? nulls,
    sma200: overrides.sma200 ?? nulls,
    rsi: overrides.rsi ?? nulls,
    macd: { hist: nulls },
    adxR: { adx: nulls, plusDI: nulls, minusDI: nulls },
    stoch: { k: nulls, d: nulls },
    obv: [0],
    vwapR: { vwap: nulls, upper: nulls, lower: nulls },
    divs: [],
    ofLog: [],
    boxFlip: { boxes: [], signals: [] },
    ml: { score: 0.5, label: 'Neutral', color: '#9fb9b1', features: {} },
    bScalp: {
      atr: 0,
      boxSize: 0,
      currentBox: null,
      boxes: [],
      ladder: [],
      threeBar: [],
      entries: [],
      envelope: 0,
      target: 0,
      speed: 'normal' as const,
      stats: { signals: 0, wins: 0, rr: 0 },
    },
    lienR: {
      dbb: null,
      zone: 'neutral' as const,
      prevZone: 'neutral' as const,
      regime: 'range' as const,
      squeeze: { active: false, bars: 0, breakout: null },
      reversals: [],
      latestSignal: null,
      exhaustion: false,
      bandTouch: null,
      adrSpent: 0,
    },
    luxNwe: { mid: [], upper: [], lower: [], signals: [] },
    ict: { sessions: [], judas: [], killzones: [], activeSession: null, adrPct: 0 },
    liq: { range: null, levels: [], inverseFvgs: [], sweeps: [], nextTarget: null },
    smcResult: { structures: [], orderBlocks: [], fvgs: [] },
    supplyDemand: {
      zones: [],
      grabs: [],
      nearestDemand: null,
      nearestSupply: null,
      nearestHtfDemand: null,
      nearestHtfSupply: null,
      longEntry: null,
      longSl: null,
      shortEntry: null,
      shortSl: null,
      mtfLong: null,
      mtfShort: null,
      htfInterval: null,
    },
    mhEnabled: false,
  }
}

describe('buildSidebarSnapshot', () => {
  test('flags RSI oversold with OS label and up class', () => {
    const snapshot = buildSidebarSnapshot(minimalSnapshotParams({ rsi: [28.4] }))
    expect(snapshot.sigRsi.text).toContain('(OS)')
    expect(snapshot.sigRsi.cls).toBe('up')
    expect(snapshot.rsiNow).toBe(28.4)
  })

  test('flags golden cross when SMA50 is above SMA200', () => {
    const snapshot = buildSidebarSnapshot(minimalSnapshotParams({ sma50: [105], sma200: [95] }))
    expect(snapshot.sigMa.text).toBe('▲ Golden Cross')
    expect(snapshot.sigMa.cls).toBe('up')
  })
})
