// BTC Chart — browser notifications when ML or Trade Setup flips Long/Short.

/** Which signal sources may trigger a notification for the active symbol. */
export interface SignalNotifyConfig {
  /** Master toggle (still requires browser notifications enabled in Tools). */
  enabled: boolean
  /** ML score crosses above long threshold (rising edge). */
  mlLong: boolean
  /** ML score crosses below short threshold (falling edge). */
  mlShort: boolean
  /** Trade setup bias flips to long. */
  setupBiasLong: boolean
  /** Trade setup bias flips to short. */
  setupBiasShort: boolean
  /** New locked PLAN turns long on candle close. */
  setupPlanLong: boolean
  /** New locked PLAN turns short on candle close. */
  setupPlanShort: boolean
  /** ML score threshold for long (0..1). Default matches trade-setup hysteresis. */
  mlLongThreshold: number
  /** ML score threshold for short (0..1). */
  mlShortThreshold: number
  /** Minimum setup bias/plan confidence (0..100) before notifying. */
  minSetupConfidence: number
  /** Per-signal cooldown while watching the same symbol (ms). */
  cooldownMs: number
}

export const DEFAULT_SIGNAL_NOTIFY_CONFIG: SignalNotifyConfig = {
  enabled: false,
  mlLong: true,
  mlShort: true,
  setupBiasLong: true,
  setupBiasShort: true,
  setupPlanLong: true,
  setupPlanShort: true,
  mlLongThreshold: 0.62,
  mlShortThreshold: 0.38,
  minSetupConfidence: 40,
  cooldownMs: 120_000,
}

/** Merge partial persisted config onto defaults. */
export function mergeSignalNotifyConfig(
  partial?: Partial<SignalNotifyConfig> | null,
): SignalNotifyConfig {
  if (!partial) return { ...DEFAULT_SIGNAL_NOTIFY_CONFIG }
  return { ...DEFAULT_SIGNAL_NOTIFY_CONFIG, ...partial }
}
