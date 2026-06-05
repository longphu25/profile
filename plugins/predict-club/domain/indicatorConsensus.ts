import type { IndicatorSignal, SignalBias } from './types'

export interface ConsensusResult {
  bias: SignalBias
  confidence: 'Low' | 'Medium' | 'High'
  reasons: string[]
  bullishCount: number
  bearishCount: number
  neutralCount: number
  blockedCount: number
}

export function computeConsensus(indicators: IndicatorSignal[]): ConsensusResult {
  const counts = { bullish: 0, bearish: 0, neutral: 0, blocked: 0 }
  for (const ind of indicators) {
    counts[ind.state]++
  }

  const total = indicators.length || 1
  let bias: SignalBias = 'neutral'

  if (counts.blocked > total / 2) {
    bias = 'no-trade'
  } else if (counts.bullish > counts.bearish && counts.bullish > counts.neutral) {
    bias = 'bullish'
  } else if (counts.bearish > counts.bullish && counts.bearish > counts.neutral) {
    bias = 'bearish'
  }

  const maxCount = Math.max(counts.bullish, counts.bearish, counts.neutral, counts.blocked)
  const ratio = maxCount / total
  const confidence = ratio >= 0.7 ? 'High' : ratio >= 0.5 ? 'Medium' : 'Low'
  const reasons = indicators
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((ind) => `${ind.name}: ${ind.value} (${ind.state}, ${ind.confidence}%)`)

  return {
    bias,
    confidence,
    reasons,
    bullishCount: counts.bullish,
    bearishCount: counts.bearish,
    neutralCount: counts.neutral,
    blockedCount: counts.blocked,
  }
}
