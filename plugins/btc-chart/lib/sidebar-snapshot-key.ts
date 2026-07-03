// BTC Chart — cheap key to skip redundant sidebar React updates.

import type { SidebarSnapshot } from './build-sidebar-snapshot'

/**
 * Stable string key for sidebar snapshot equality. Omits formatted strings that
 * flicker every tick; keeps trade setup, ML score, and rounded oscillator values.
 */
export function sidebarSnapshotKey(s: SidebarSnapshot): string {
  const ts = s.tradeSetup
  const plan = ts.plan
  return [
    ts.planStatus,
    plan?.dir ?? ts.dir,
    (plan?.entry ?? ts.entry).toFixed(6),
    (plan?.sl ?? ts.sl).toFixed(6),
    (plan?.tp1 ?? ts.tp1).toFixed(6),
    ts.bias.dir,
    ts.bias.confidence,
    ts.bias.reasons.join('|'),
    s.ml.score.toFixed(3),
    s.rsiNow?.toFixed(1) ?? '',
    s.adxNow?.toFixed(0) ?? '',
    s.stochKNow?.toFixed(0) ?? '',
    s.boxFlip.count,
    s.boxFlip.last,
  ].join(':')
}
