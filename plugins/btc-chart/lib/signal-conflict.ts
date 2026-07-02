// BTC Chart — detect when ML bias and Trade Setup direction disagree.

import type { MLResult, TradeSetup } from './types'

/** ML label thresholds (must match ml.ts). */
export const ML_BUY_THRESHOLD = 0.58
export const ML_SELL_THRESHOLD = 0.42

export interface SignalConflict {
  readonly hasConflict: boolean
  readonly mlBias: 'bull' | 'bear' | 'neutral'
  readonly setupDir: 'long' | 'short' | null
  readonly message: string
}

/**
 * Returns conflict info when ML directional bias opposes Trade Setup direction.
 * ML is a soft bias; Trade Setup is structure/confluence entry planning.
 */
export function detectSignalConflict(ml: MLResult, setup: TradeSetup): SignalConflict {
  const mlBias: SignalConflict['mlBias'] =
    ml.score > ML_BUY_THRESHOLD ? 'bull' : ml.score < ML_SELL_THRESHOLD ? 'bear' : 'neutral'

  const setupDir = setup.dir

  if (!setupDir || mlBias === 'neutral') {
    return {
      hasConflict: false,
      mlBias,
      setupDir,
      message: '',
    }
  }

  const opposed =
    (mlBias === 'bull' && setupDir === 'short') || (mlBias === 'bear' && setupDir === 'long')

  if (!opposed) {
    return { hasConflict: false, mlBias, setupDir, message: '' }
  }

  const message =
    mlBias === 'bull' && setupDir === 'short'
      ? `ML ${ml.label} nhưng Setup SHORT: bias tăng vs confluence giảm. Ưu tiên quản lý rủi ro.`
      : `ML ${ml.label} nhưng Setup LONG: bias giảm vs confluence tăng. Ưu tiên quản lý rủi ro.`

  return { hasConflict: true, mlBias, setupDir, message }
}
