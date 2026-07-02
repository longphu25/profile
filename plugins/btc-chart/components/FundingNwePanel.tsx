// BTC Chart — Funding Rate + NWE bias combined panel.

import { useMemo, useState } from 'react'
import type { FundingState } from '../lib/types'
import React from 'react'
import type { NadarayaWatsonResult } from '../lib/nadaraya-watson'
import type { Candle } from '../lib/types'
import { calcRSI } from '../lib/indicators'
import {
  SideBlock,
  SideBody,
  SideHead,
  SideRow,
  SideBadge,
  SideNote,
  StatGrid,
  StatCell,
} from './sidebar'

export interface FundingNwePanelProps {
  funding: FundingState
  nwe: NadarayaWatsonResult
  candles: Candle[]
  symbol: string
}

interface SignalAnalysis {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  strength: number
  reasons: string[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

function analyzeSignals(
  funding: FundingState,
  nwe: NadarayaWatsonResult,
  candles: Candle[],
): SignalAnalysis {
  const reasons: string[] = []
  let score = 0

  const avgRate =
    funding.breakdown.length > 0
      ? funding.breakdown.reduce((sum, b) => sum + b.rate, 0) / funding.breakdown.length
      : 0

  if (avgRate < -0.01) {
    score += 2
    reasons.push(`Funding âm sâu (${avgRate.toFixed(4)}%)`)
  } else if (avgRate > 0.01) {
    score -= 2
    reasons.push(`Funding dương cao (${avgRate.toFixed(4)}%)`)
  } else if (avgRate < 0) {
    score += 1
    reasons.push(`Funding âm nhẹ (${avgRate.toFixed(4)}%)`)
  } else if (avgRate > 0) {
    score -= 1
    reasons.push(`Funding dương nhẹ (${avgRate.toFixed(4)}%)`)
  }

  const lastSignal = nwe.signals[nwe.signals.length - 1]
  if (lastSignal) {
    const barsAgo = candles.length - 1 - lastSignal.index
    if (barsAgo <= 3) {
      if (lastSignal.type === 'buy') {
        score += 2
        reasons.push(`NWE BUY (${barsAgo} bars ago)`)
      } else {
        score -= 2
        reasons.push(`NWE SELL (${barsAgo} bars ago)`)
      }
    }
  }

  if (candles.length >= 14) {
    const rsi = calcRSI(candles, 14)
    const lastRsi = rsi[rsi.length - 1]
    if (lastRsi !== null) {
      if (lastRsi < 30) {
        score += 2
        reasons.push(`RSI oversold (${lastRsi.toFixed(1)})`)
      } else if (lastRsi > 70) {
        score -= 2
        reasons.push(`RSI overbought (${lastRsi.toFixed(1)})`)
      }
    }
  }

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'

  if (score >= 3) {
    direction = 'LONG'
    riskLevel = score >= 5 ? 'LOW' : 'MEDIUM'
  } else if (score <= -3) {
    direction = 'SHORT'
    riskLevel = score <= -5 ? 'LOW' : 'MEDIUM'
  } else {
    direction = 'NEUTRAL'
    riskLevel = 'HIGH'
  }

  return { direction, strength: Math.min(Math.abs(score) / 5, 1), reasons, riskLevel }
}

export const FundingNwePanel = React.memo(function FundingNwePanel({
  funding,
  nwe,
  candles,
  symbol,
}: FundingNwePanelProps) {
  const [open, setOpen] = useState(false)
  const analysis = useMemo(() => analyzeSignals(funding, nwe, candles), [funding, nwe, candles])

  const dirTone = analysis.direction === 'LONG' ? 'up' : analysis.direction === 'SHORT' ? 'dn' : ''
  const riskTone =
    analysis.riskLevel === 'LOW' ? 'up' : analysis.riskLevel === 'MEDIUM' ? 'hi' : 'dn'

  const fundTone = funding.cls
  const strengthPct = `${Math.round(analysis.strength * 100)}%`
  const biasBadgeTone =
    analysis.direction === 'LONG' ? 'up' : analysis.direction === 'SHORT' ? 'dn' : 'muted'

  return (
    <SideBlock variant="market" className="sb-block--funding">
      <SideHead
        title="Funding Rate"
        subtitle={symbol}
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open ? <SideBadge tone={biasBadgeTone}>{analysis.direction}</SideBadge> : undefined
        }
      />

      {!open && (
        <div className="sb-funding-compact">
          <div className={`sb-funding-compact__rate ${fundTone}`}>{funding.val}</div>
          <p className={`sb-funding-compact__sentiment ${fundTone}`}>{funding.sub}</p>
        </div>
      )}

      {open && (
        <SideBody className="sb-funding-body">
          <div className={`sb-funding-compact__rate sb-funding-compact__rate--inline ${fundTone}`}>
            {funding.val}
          </div>
          <p
            className={`sb-funding-compact__sentiment sb-funding-compact__sentiment--inline ${fundTone}`}
          >
            {funding.sub}
          </p>

          {funding.breakdown.length > 0 && (
            <div className="sb-kv-list sb-kv-list--funding">
              {funding.breakdown.map((b) => (
                <SideRow
                  key={b.name}
                  label={b.name}
                  value={`${b.rate >= 0 ? '+' : ''}${b.rate.toFixed(4)}%`}
                  tone={b.rate < 0 ? 'up' : b.rate > 0.05 ? 'dn' : ''}
                  className="sb-row--funding"
                />
              ))}
            </div>
          )}

          <StatGrid cols={3}>
            <StatCell label="Bias" value={analysis.direction} tone={dirTone} />
            <StatCell label="Risk" value={analysis.riskLevel} tone={riskTone} />
            <StatCell
              label="Strength"
              value={strengthPct}
              tone={analysis.strength >= 0.6 ? 'hi' : ''}
            />
          </StatGrid>

          {analysis.reasons[0] && <SideNote>{analysis.reasons[0]}</SideNote>}

          <SideNote>
            FR &lt; -0.01% lean <span className="up">LONG</span> · FR &gt; +0.01% lean{' '}
            <span className="dn">SHORT</span>
          </SideNote>
        </SideBody>
      )}
    </SideBlock>
  )
})
