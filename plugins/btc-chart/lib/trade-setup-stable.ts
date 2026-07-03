// BTC Chart — stabilize trade setup: bias (live) vs plan (locked entry/SL/TP).

import type { TradeSetup, TradeSetupBias, TradeSetupPlan } from './types'

/** ML score must exceed this to count as a bullish vote (hysteresis). */
export const ML_HYSTERESIS_LONG = 0.62

/** ML score must fall below this to count as a bearish vote (hysteresis). */
export const ML_HYSTERESIS_SHORT = 0.38

/** Minimum time to hold a plan on the same bar before replacement (ms). */
export const PLAN_MIN_HOLD_MS = 45_000

/** Mutable lock state persisted across pipeline ticks. */
export interface TradeSetupLockState {
  plan: TradeSetupPlan | null
  lockedBarTime: number
  lockedAtMs: number
}

export const EMPTY_TRADE_SETUP_LOCK: TradeSetupLockState = {
  plan: null,
  lockedBarTime: 0,
  lockedAtMs: 0,
}

/**
 * Build live bias from raw vote counts.
 * Bias direction uses a lighter threshold (≥1 vote lead) than plan (≥2 votes).
 */
export function buildTradeSetupBias(
  bull: number,
  bear: number,
  reasons: string[],
  mlScore: number,
): TradeSetupBias {
  let dir: 'long' | 'short' | null = null
  if (bull > bear && bull >= 1) dir = 'long'
  else if (bear > bull && bear >= 1) dir = 'short'
  const confidence = Math.min(100, Math.max(bull, bear) * 20 + Math.abs(bull - bear) * 10)
  return { dir, confidence, reasons: [...reasons], mlScore, bull, bear }
}

function planFromLive(live: TradeSetup, candleTime: number, nowMs: number): TradeSetupPlan {
  return {
    dir: live.dir!,
    entry: live.entry,
    sl: live.sl,
    tp1: live.tp1,
    tp2: live.tp2,
    tp3: live.tp3,
    rr: live.rr,
    entryMethod: live.entryMethod,
    lockedAt: nowMs,
    candleTime,
  }
}

/** Plan is invalidated when spot breaches the stop loss. */
export function isPlanInvalidated(plan: TradeSetupPlan, spot: number): boolean {
  if (plan.dir === 'long') return spot <= plan.sl
  return spot >= plan.sl
}

function biasOpposesPlan(bias: TradeSetupBias, plan: TradeSetupPlan): boolean {
  return bias.dir != null && bias.dir !== plan.dir
}

function mergeOutput(live: TradeSetup, plan: TradeSetupPlan | null): TradeSetup {
  if (!plan) {
    return {
      ...live,
      dir: null,
      entry: live.spotPrice,
      sl: live.spotPrice,
      tp1: live.spotPrice,
      tp2: live.spotPrice,
      tp3: live.spotPrice,
      rr: 0,
      entryMethod: '',
      confidence: live.bias.confidence,
      reasons: live.bias.reasons,
      plan: null,
      planStatus: 'waiting',
    }
  }
  return {
    dir: plan.dir,
    entry: plan.entry,
    sl: plan.sl,
    tp1: plan.tp1,
    tp2: plan.tp2,
    tp3: plan.tp3,
    rr: plan.rr,
    entryMethod: plan.entryMethod,
    confidence: live.bias.confidence,
    reasons: live.bias.reasons,
    volRatio: live.volRatio,
    spotPrice: live.spotPrice,
    bias: live.bias,
    plan,
    planStatus: 'active',
  }
}

function adoptPlan(
  lock: TradeSetupLockState,
  live: TradeSetup,
  candleTime: number,
  nowMs: number,
): void {
  lock.plan = planFromLive(live, candleTime, nowMs)
  lock.lockedBarTime = candleTime
  lock.lockedAtMs = nowMs
}

function clearPlan(lock: TradeSetupLockState): void {
  lock.plan = null
  lock.lockedBarTime = 0
  lock.lockedAtMs = 0
}

/**
 * Merge a live `calcTradeSetup` result with lock state:
 * - Bias always reflects the latest live votes.
 * - Plan direction is locked until the candle closes (new bar time).
 * - Plan levels stay frozen on the same bar (min hold 45s guard on rapid replace).
 * - Plan clears on SL breach or opposing bias on a new bar.
 */
export function stabilizeTradeSetup(
  live: TradeSetup,
  lock: TradeSetupLockState,
  opts: { candleTime: number; spot: number; nowMs?: number },
): TradeSetup {
  const nowMs = opts.nowMs ?? Date.now()
  const { candleTime, spot } = opts
  let slInvalidated = false

  if (lock.plan && isPlanInvalidated(lock.plan, spot)) {
    clearPlan(lock)
    slInvalidated = true
  }

  const newBar = lock.plan != null && candleTime !== lock.lockedBarTime

  if (lock.plan && newBar && biasOpposesPlan(live.bias, lock.plan)) {
    clearPlan(lock)
  }

  if (!lock.plan) {
    if (live.dir && !slInvalidated) {
      adoptPlan(lock, live, candleTime, nowMs)
    }
    return mergeOutput(live, lock.plan)
  }

  if (newBar) {
    if (live.dir) {
      adoptPlan(lock, live, candleTime, nowMs)
    }
    return mergeOutput(live, lock.plan)
  }

  // Same bar: direction and levels stay locked until candle closes.
  const heldMs = nowMs - lock.lockedAtMs
  if (heldMs < PLAN_MIN_HOLD_MS) {
    return mergeOutput(live, lock.plan)
  }

  return mergeOutput(live, lock.plan)
}
