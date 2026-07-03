import { describe, expect, test } from 'bun:test'
import {
  EMPTY_TRADE_SETUP_LOCK,
  ML_HYSTERESIS_LONG,
  ML_HYSTERESIS_SHORT,
  PLAN_MIN_HOLD_MS,
  buildTradeSetupBias,
  isPlanInvalidated,
  stabilizeTradeSetup,
  type TradeSetupLockState,
} from '../../plugins/btc-chart/lib/trade-setup-stable'
import type { TradeSetup } from '../../plugins/btc-chart/lib/types'

function liveLong(overrides: Partial<TradeSetup> = {}): TradeSetup {
  return {
    dir: 'long',
    entry: 100,
    sl: 98,
    tp1: 104,
    tp2: 106,
    tp3: 108,
    rr: 2,
    confidence: 70,
    reasons: ['ML Bullish', 'RSI 30 (oversold)'],
    volRatio: 1.2,
    spotPrice: 101,
    entryMethod: 'Structure',
    bias: buildTradeSetupBias(3, 0, ['ML Bullish', 'RSI 30 (oversold)'], 0.65),
    plan: null,
    planStatus: 'waiting',
    ...overrides,
  }
}

function liveShort(overrides: Partial<TradeSetup> = {}): TradeSetup {
  return {
    dir: 'short',
    entry: 100,
    sl: 102,
    tp1: 96,
    tp2: 94,
    tp3: 92,
    rr: 2,
    confidence: 70,
    reasons: ['ML Bearish', 'RSI 70 (overbought)'],
    volRatio: 1.2,
    spotPrice: 99,
    entryMethod: 'Structure',
    bias: buildTradeSetupBias(0, 3, ['ML Bearish', 'RSI 70 (overbought)'], 0.35),
    plan: null,
    planStatus: 'waiting',
    ...overrides,
  }
}

function freshLock(): TradeSetupLockState {
  return { ...EMPTY_TRADE_SETUP_LOCK }
}

describe('ML hysteresis constants', () => {
  test('long threshold is 0.62 and short is 0.38', () => {
    expect(ML_HYSTERESIS_LONG).toBe(0.62)
    expect(ML_HYSTERESIS_SHORT).toBe(0.38)
  })
})

describe('buildTradeSetupBias', () => {
  test('bias dir uses lighter threshold than plan', () => {
    const bias = buildTradeSetupBias(1, 0, ['ML Bullish'], 0.65)
    expect(bias.dir).toBe('long')
  })
})

describe('isPlanInvalidated', () => {
  test('long plan invalidates when spot crosses SL', () => {
    const plan = liveLong().plan ?? {
      dir: 'long' as const,
      entry: 100,
      sl: 98,
      tp1: 104,
      tp2: 106,
      tp3: 108,
      rr: 2,
      entryMethod: 'x',
      lockedAt: 0,
      candleTime: 100,
    }
    expect(isPlanInvalidated({ ...plan, dir: 'long', sl: 98 }, 97.5)).toBe(true)
    expect(isPlanInvalidated({ ...plan, dir: 'long', sl: 98 }, 98.5)).toBe(false)
  })
})

describe('stabilizeTradeSetup', () => {
  test('adopts plan when live setup qualifies', () => {
    const lock = freshLock()
    const out = stabilizeTradeSetup(liveLong(), lock, {
      candleTime: 1000,
      spot: 101,
      nowMs: 10_000,
    })
    expect(out.dir).toBe('long')
    expect(out.plan?.entry).toBe(100)
    expect(out.planStatus).toBe('active')
    expect(lock.plan?.candleTime).toBe(1000)
  })

  test('keeps plan direction on same bar when live flips', () => {
    const lock = freshLock()
    stabilizeTradeSetup(liveLong(), lock, { candleTime: 1000, spot: 101, nowMs: 10_000 })
    const out = stabilizeTradeSetup(liveShort(), lock, {
      candleTime: 1000,
      spot: 99,
      nowMs: 10_000 + PLAN_MIN_HOLD_MS + 1,
    })
    expect(out.dir).toBe('long')
    expect(out.plan?.entry).toBe(100)
  })

  test('refreshes plan on new bar when live qualifies', () => {
    const lock = freshLock()
    stabilizeTradeSetup(liveLong({ entry: 100 }), lock, {
      candleTime: 1000,
      spot: 101,
      nowMs: 10_000,
    })
    const out = stabilizeTradeSetup(liveLong({ entry: 105 }), lock, {
      candleTime: 2000,
      spot: 104,
      nowMs: 20_000,
    })
    expect(out.plan?.entry).toBe(105)
    expect(lock.lockedBarTime).toBe(2000)
  })

  test('clears plan on SL invalidation', () => {
    const lock = freshLock()
    stabilizeTradeSetup(liveLong(), lock, { candleTime: 1000, spot: 101, nowMs: 10_000 })
    const out = stabilizeTradeSetup(liveLong(), lock, {
      candleTime: 1000,
      spot: 97,
      nowMs: 11_000,
    })
    expect(out.dir).toBeNull()
    expect(out.plan).toBeNull()
    expect(lock.plan).toBeNull()
  })

  test('clears opposing plan on new bar when bias flips', () => {
    const lock = freshLock()
    stabilizeTradeSetup(liveLong(), lock, { candleTime: 1000, spot: 101, nowMs: 10_000 })
    const flippedBias = liveShort({ dir: null })
    const out = stabilizeTradeSetup(flippedBias, lock, {
      candleTime: 2000,
      spot: 99,
      nowMs: 20_000,
    })
    expect(out.dir).toBeNull()
    expect(lock.plan).toBeNull()
  })

  test('bias always reflects latest live votes', () => {
    const lock = freshLock()
    stabilizeTradeSetup(liveLong(), lock, { candleTime: 1000, spot: 101, nowMs: 10_000 })
    const out = stabilizeTradeSetup(
      liveShort({
        bias: buildTradeSetupBias(0, 4, ['ML Bearish'], 0.3),
      }),
      lock,
      { candleTime: 1000, spot: 99, nowMs: 11_000 },
    )
    expect(out.bias.dir).toBe('short')
    expect(out.bias.bear).toBe(4)
    expect(out.dir).toBe('long')
  })
})
