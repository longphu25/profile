import { describe, expect, test } from 'bun:test'
import { DEFAULT_SIGNAL_NOTIFY_CONFIG } from './signal-notify-config'
import {
  EMPTY_SIGNAL_NOTIFY_STATE,
  evaluateSignalNotifications,
  resetSignalNotifyState,
  type SignalNotifyState,
} from './signal-notify'
import type { MLResult, TradeSetup } from './types'

const baseMl: MLResult = {
  score: 0.5,
  label: 'NEUTRAL',
  color: '#888',
  features: {},
}

const baseSetup: TradeSetup = {
  dir: null,
  entry: 0,
  sl: 0,
  tp1: 0,
  tp2: 0,
  tp3: 0,
  rr: 0,
  confidence: 0,
  reasons: [],
  volRatio: 1,
  spotPrice: 100,
  entryMethod: '',
  bias: {
    dir: null,
    confidence: 0,
    reasons: [],
    mlScore: 0.5,
    bull: 0,
    bear: 0,
  },
  plan: null,
  planStatus: 'waiting',
}

function freshState(): SignalNotifyState {
  return { ...EMPTY_SIGNAL_NOTIFY_STATE, lastFiredMs: {} }
}

function enabledCfg() {
  return { ...DEFAULT_SIGNAL_NOTIFY_CONFIG, enabled: true, cooldownMs: 0 }
}

describe('evaluateSignalNotifications', () => {
  test('returns empty when master toggle is off', () => {
    const state = freshState()
    state.prevMlScore = 0.5
    const fires = evaluateSignalNotifications(
      { ...DEFAULT_SIGNAL_NOTIFY_CONFIG, enabled: false },
      {
        symbol: 'BTCUSDT',
        ml: { ...baseMl, score: 0.7 },
        setup: baseSetup,
        notificationsEnabled: true,
      },
      state,
    )
    expect(fires).toHaveLength(0)
    expect(state.prevMlScore).toBe(0.7)
  })

  test('fires ML long on rising edge above threshold', () => {
    const state = freshState()
    state.prevMlScore = 0.55
    const fires = evaluateSignalNotifications(
      enabledCfg(),
      {
        symbol: 'ETHUSDT',
        ml: { ...baseMl, score: 0.65, label: 'BUY' },
        setup: baseSetup,
        notificationsEnabled: true,
      },
      state,
    )
    expect(fires).toHaveLength(1)
    expect(fires[0]?.kind).toBe('ml-long')
    expect(fires[0]?.title).toContain('ETH/USDT')
  })

  test('does not repeat ML long without a new edge', () => {
    const state = freshState()
    state.prevMlScore = 0.65
    const fires = evaluateSignalNotifications(
      enabledCfg(),
      {
        symbol: 'BTCUSDT',
        ml: { ...baseMl, score: 0.7, label: 'BUY' },
        setup: baseSetup,
        notificationsEnabled: true,
      },
      state,
    )
    expect(fires).toHaveLength(0)
  })

  test('respects per-kind cooldown', () => {
    const state = freshState()
    const cfg = { ...enabledCfg(), cooldownMs: 60_000 }
    state.prevMlScore = 0.55
    state.lastFiredMs['ml-long'] = Date.now()
    const fires = evaluateSignalNotifications(
      cfg,
      {
        symbol: 'BTCUSDT',
        ml: { ...baseMl, score: 0.7, label: 'BUY' },
        setup: baseSetup,
        notificationsEnabled: true,
      },
      state,
    )
    expect(fires).toHaveLength(0)
  })

  test('fires bias long when direction flips', () => {
    const state = freshState()
    state.prevBiasDir = 'short'
    const setup: TradeSetup = {
      ...baseSetup,
      bias: { dir: 'long', confidence: 55, reasons: ['test'], mlScore: 0.6, bull: 2, bear: 0 },
    }
    const fires = evaluateSignalNotifications(
      enabledCfg(),
      { symbol: 'BTCUSDT', ml: baseMl, setup, notificationsEnabled: true },
      state,
    )
    expect(fires).toHaveLength(1)
    expect(fires[0]?.kind).toBe('bias-long')
  })

  test('skips bias when confidence below minimum', () => {
    const state = freshState()
    state.prevBiasDir = null
    const setup: TradeSetup = {
      ...baseSetup,
      bias: { dir: 'long', confidence: 20, reasons: [], mlScore: 0.6, bull: 1, bear: 0 },
    }
    const fires = evaluateSignalNotifications(
      enabledCfg(),
      { symbol: 'BTCUSDT', ml: baseMl, setup, notificationsEnabled: true },
      state,
    )
    expect(fires).toHaveLength(0)
  })

  test('fires plan short on new locked plan key', () => {
    const state = freshState()
    state.prevPlanKey = 'long:100'
    const setup: TradeSetup = {
      ...baseSetup,
      confidence: 50,
      plan: {
        dir: 'short',
        entry: 100,
        sl: 102,
        tp1: 96,
        tp2: 94,
        tp3: 92,
        rr: 2,
        entryMethod: 'Structure',
        lockedAt: 1,
        candleTime: 200,
      },
      planStatus: 'active',
    }
    const fires = evaluateSignalNotifications(
      enabledCfg(),
      { symbol: 'BTCUSDT', ml: baseMl, setup, notificationsEnabled: true },
      state,
    )
    expect(fires).toHaveLength(1)
    expect(fires[0]?.kind).toBe('plan-short')
  })

  test('resetSignalNotifyState clears edge memory', () => {
    const state = freshState()
    state.prevMlScore = 0.7
    state.prevBiasDir = 'long'
    state.prevPlanKey = 'long:1'
    resetSignalNotifyState(state)
    expect(state.prevMlScore).toBeNull()
    expect(state.prevBiasDir).toBeNull()
    expect(state.prevPlanKey).toBeNull()
  })
})
