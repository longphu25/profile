// BTC Chart — SMC confluence votes for Trade Setup (BOS/CHoCH, OB touch, CHoCH after sweep).

import type { Candle } from './types'
import type { LiquidityResult } from './liquidity'
import type { OrderBlock, SMCResult, StructureLine } from '../smc'

/** Default bars to treat structure / sweep events as "recent". */
export const SMC_LOOKBACK_BARS = 3

export interface SmcConfluenceVotes {
  readonly bull: number
  readonly bear: number
  readonly reasons: string[]
}

/**
 * Collect bullish/bearish votes from raw SMC overlay data.
 * Liquidity sweeps are optional but required for the "CHoCH after sweep" pattern.
 */
export function collectSmcConfluenceVotes(
  data: Candle[],
  smc: SMCResult,
  liquidity?: LiquidityResult,
  lookbackBars: number = SMC_LOOKBACK_BARS,
): SmcConfluenceVotes {
  const reasons: string[] = []
  let bull = 0
  let bear = 0

  if (data.length < 2 || (smc.structures.length === 0 && smc.orderBlocks.length === 0)) {
    return { bull, bear, reasons }
  }

  const i = data.length - 1
  const c = data[i]
  const cutoffTime = data[Math.max(0, i - lookbackBars)].time

  applyRecentStructureVotes(smc.structures, cutoffTime, (side, reason) => {
    if (side === 'bull') bull++
    else bear++
    reasons.push(reason)
  })

  applyOrderBlockTouchVote(smc.orderBlocks, c, (side, reason) => {
    if (side === 'bull') bull++
    else bear++
    reasons.push(reason)
  })

  if (liquidity) {
    applyChochAfterSweepVote(smc.structures, liquidity, cutoffTime, c.time, (side, reason) => {
      if (side === 'bull') bull++
      else bear++
      reasons.push(reason)
    })
  }

  return { bull, bear, reasons }
}

function applyRecentStructureVotes(
  structures: StructureLine[],
  cutoffTime: number,
  onVote: (side: 'bull' | 'bear', reason: string) => void,
): void {
  const recent = structures.filter((s) => s.endTime >= cutoffTime)
  const last = recent[recent.length - 1]
  if (!last) return

  const tag = last.type === 'CHoCH' ? 'CHoCH' : 'BOS'
  if (last.bias === 'bull') {
    onVote('bull', `SMC ${tag} Bull`)
  } else {
    onVote('bear', `SMC ${tag} Bear`)
  }
}

function applyOrderBlockTouchVote(
  orderBlocks: OrderBlock[],
  candle: Candle,
  onVote: (side: 'bull' | 'bear', reason: string) => void,
): void {
  for (let j = orderBlocks.length - 1; j >= 0; j--) {
    const ob = orderBlocks[j]
    if (ob.broken) continue
    if (candle.high < ob.low || candle.low > ob.high) continue

    if (ob.bias === 'bull') {
      onVote('bull', 'SMC Bull OB touch')
    } else {
      onVote('bear', 'SMC Bear OB touch')
    }
    return
  }
}

function applyChochAfterSweepVote(
  structures: StructureLine[],
  liquidity: LiquidityResult,
  cutoffTime: number,
  lastBarTime: number,
  onVote: (side: 'bull' | 'bear', reason: string) => void,
): void {
  const recentSweeps = liquidity.sweeps.filter((s) => s.time >= cutoffTime)
  const lastSweep = recentSweeps[recentSweeps.length - 1]
  if (!lastSweep) return

  const expectedBias = lastSweep.type === 'bullish' ? 'bull' : 'bear'
  const choch = structures.find(
    (s) =>
      s.type === 'CHoCH' &&
      s.bias === expectedBias &&
      s.endTime > lastSweep.time &&
      s.endTime <= lastBarTime,
  )
  if (!choch) return

  if (expectedBias === 'bull') {
    onVote('bull', 'SMC CHoCH after sweep')
  } else {
    onVote('bear', 'SMC CHoCH after sweep')
  }
}
