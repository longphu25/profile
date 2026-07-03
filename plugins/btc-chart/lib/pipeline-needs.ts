// BTC Chart — decide which pipeline stages run from visibility + trade setup.

import type { VisFlags } from '../storage'

/** Per-stage compute/draw flags derived from layer toggles. */
export interface PipelineNeeds {
  readonly luxNwe: boolean
  readonly ict: boolean
  readonly liquidity: boolean
  readonly smc: boolean
  readonly supplyDemand: boolean
  readonly boucher: boolean
  readonly lien: boolean
  readonly boxFlip: boolean
  readonly orderFlow: boolean
  readonly vp: boolean
  readonly rsiDiv: boolean
  readonly oscillators: boolean
  readonly tradeSetup: boolean
}

/**
 * Map layer visibility to pipeline work. Trade Setup ON keeps confluence sources
 * even when overlays are hidden.
 */
export function resolvePipelineNeeds(vis: VisFlags, oscOpen: boolean): PipelineNeeds {
  const ts = vis.tradeSetup
  return {
    luxNwe: vis.luxNwe || ts,
    ict: vis.ict || ts,
    liquidity: vis.liquidity || ts,
    smc: vis.smc || vis.supplyDemand || vis.liquidity || ts,
    supplyDemand: vis.supplyDemand || ts,
    boucher: vis.scalping || ts,
    lien: vis.reversal || ts,
    boxFlip: vis.boxFlip,
    orderFlow: vis.of,
    vp: vis.vp,
    rsiDiv: vis.rsiDiv,
    oscillators: oscOpen,
    tradeSetup: ts,
  }
}

/** HTF klines for liquidity range and Supply & Demand MTF zones. */
export function needsHtfKlines(vis: VisFlags): boolean {
  return vis.liquidity || vis.supplyDemand || vis.tradeSetup
}
