// BTC Chart — layer keys that paint canvas overlays (need immediate redraw on toggle).

import type { VisFlags } from '../storage'

/** Vis flags that draw on chart canvases (not just lightweight-charts series). */
export const CANVAS_OVERLAY_KEYS = [
  'smc',
  'supplyDemand',
  'ict',
  'liquidity',
  'boxFlip',
  'of',
  'vp',
  'tradeSetupOverlay',
] as const satisfies ReadonlyArray<keyof VisFlags>

/** True when any canvas overlay was just turned on (needs sync full pipeline). */
export function visOverlayTurnedOn(prev: VisFlags, next: VisFlags): boolean {
  return CANVAS_OVERLAY_KEYS.some((k) => next[k] && !prev[k])
}
