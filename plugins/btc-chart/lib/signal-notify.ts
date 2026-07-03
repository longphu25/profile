// BTC Chart — detect Long/Short signal edges and fire notifications.

import type { SignalNotifyConfig } from './signal-notify-config'
import type { MLResult, TradeSetup } from './types'

export type SignalNotifyKind =
  | 'ml-long'
  | 'ml-short'
  | 'bias-long'
  | 'bias-short'
  | 'plan-long'
  | 'plan-short'

/** Mutable edge-detection state (per chart session, reset on symbol change). */
export interface SignalNotifyState {
  prevMlScore: number | null
  prevBiasDir: 'long' | 'short' | null
  prevPlanKey: string | null
  lastFiredMs: Partial<Record<SignalNotifyKind, number>>
}

export const EMPTY_SIGNAL_NOTIFY_STATE: SignalNotifyState = {
  prevMlScore: null,
  prevBiasDir: null,
  prevPlanKey: null,
  lastFiredMs: {},
}

export interface SignalNotification {
  readonly kind: SignalNotifyKind
  readonly title: string
  readonly body: string
  readonly toast: string
}

export interface SignalNotifyInput {
  readonly symbol: string
  readonly ml: MLResult
  readonly setup: TradeSetup
  readonly notificationsEnabled: boolean
}

function formatSymbolLabel(symbol: string): string {
  return symbol.endsWith('USDT') ? `${symbol.replace(/USDT$/, '')}/USDT` : symbol
}

function planKey(setup: TradeSetup): string | null {
  if (!setup.plan?.dir) return null
  return `${setup.plan.dir}:${setup.plan.candleTime}`
}

function canFire(
  cfg: SignalNotifyConfig,
  state: SignalNotifyState,
  kind: SignalNotifyKind,
  now: number,
): boolean {
  const last = state.lastFiredMs[kind] ?? 0
  return now - last >= cfg.cooldownMs
}

function recordFire(state: SignalNotifyState, kind: SignalNotifyKind, now: number): void {
  state.lastFiredMs[kind] = now
}

/**
 * Evaluate ML + Trade Setup for rising/falling Long/Short edges.
 * Mutates `state` (prev snapshots + cooldown timestamps).
 */
export function evaluateSignalNotifications(
  cfg: SignalNotifyConfig,
  input: SignalNotifyInput,
  state: SignalNotifyState,
): SignalNotification[] {
  if (!cfg.enabled || !input.notificationsEnabled) {
    state.prevMlScore = input.ml.score
    state.prevBiasDir = input.setup.bias?.dir ?? null
    state.prevPlanKey = planKey(input.setup)
    return []
  }

  const out: SignalNotification[] = []
  const now = Date.now()
  const pair = formatSymbolLabel(input.symbol)
  const score = input.ml.score
  const bias = input.setup.bias
  const plan = input.setup.plan
  const minConf = cfg.minSetupConfidence

  if (
    cfg.mlLong &&
    state.prevMlScore != null &&
    state.prevMlScore < cfg.mlLongThreshold &&
    score >= cfg.mlLongThreshold &&
    canFire(cfg, state, 'ml-long', now)
  ) {
    const pct = Math.round(score * 100)
    out.push({
      kind: 'ml-long',
      title: `BTC Chart: ${pair} Long`,
      body: `ML signal bullish (${input.ml.label}, ${pct}%)`,
      toast: `${pair} ML Long · ${input.ml.label}`,
    })
    recordFire(state, 'ml-long', now)
  }

  if (
    cfg.mlShort &&
    state.prevMlScore != null &&
    state.prevMlScore > cfg.mlShortThreshold &&
    score <= cfg.mlShortThreshold &&
    canFire(cfg, state, 'ml-short', now)
  ) {
    const pct = Math.round(score * 100)
    out.push({
      kind: 'ml-short',
      title: `BTC Chart: ${pair} Short`,
      body: `ML signal bearish (${input.ml.label}, ${pct}%)`,
      toast: `${pair} ML Short · ${input.ml.label}`,
    })
    recordFire(state, 'ml-short', now)
  }

  const biasDir = bias?.dir ?? null
  if (
    cfg.setupBiasLong &&
    state.prevBiasDir !== 'long' &&
    biasDir === 'long' &&
    (bias?.confidence ?? 0) >= minConf &&
    canFire(cfg, state, 'bias-long', now)
  ) {
    out.push({
      kind: 'bias-long',
      title: `BTC Chart: ${pair} Bias Long`,
      body: `Trade setup bias long (${bias?.confidence ?? 0}% conf)`,
      toast: `${pair} Bias Long`,
    })
    recordFire(state, 'bias-long', now)
  }

  if (
    cfg.setupBiasShort &&
    state.prevBiasDir !== 'short' &&
    biasDir === 'short' &&
    (bias?.confidence ?? 0) >= minConf &&
    canFire(cfg, state, 'bias-short', now)
  ) {
    out.push({
      kind: 'bias-short',
      title: `BTC Chart: ${pair} Bias Short`,
      body: `Trade setup bias short (${bias?.confidence ?? 0}% conf)`,
      toast: `${pair} Bias Short`,
    })
    recordFire(state, 'bias-short', now)
  }

  const pk = planKey(input.setup)
  if (
    cfg.setupPlanLong &&
    pk != null &&
    pk !== state.prevPlanKey &&
    plan?.dir === 'long' &&
    input.setup.confidence >= minConf &&
    canFire(cfg, state, 'plan-long', now)
  ) {
    out.push({
      kind: 'plan-long',
      title: `BTC Chart: ${pair} Plan Long`,
      body: `Entry plan locked long (RR ${input.setup.rr.toFixed(1)})`,
      toast: `${pair} Plan Long`,
    })
    recordFire(state, 'plan-long', now)
  }

  if (
    cfg.setupPlanShort &&
    pk != null &&
    pk !== state.prevPlanKey &&
    plan?.dir === 'short' &&
    input.setup.confidence >= minConf &&
    canFire(cfg, state, 'plan-short', now)
  ) {
    out.push({
      kind: 'plan-short',
      title: `BTC Chart: ${pair} Plan Short`,
      body: `Entry plan locked short (RR ${input.setup.rr.toFixed(1)})`,
      toast: `${pair} Plan Short`,
    })
    recordFire(state, 'plan-short', now)
  }

  state.prevMlScore = score
  state.prevBiasDir = biasDir
  state.prevPlanKey = pk

  return out
}

/** Reset edge memory when switching symbol or interval. */
export function resetSignalNotifyState(state: SignalNotifyState): void {
  state.prevMlScore = null
  state.prevBiasDir = null
  state.prevPlanKey = null
}
