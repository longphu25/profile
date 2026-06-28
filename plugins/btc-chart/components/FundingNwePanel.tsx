// BTC Chart — Funding Rate + NWE Signal Panel
// Combines funding rate sentiment with Nadaraya-Watson Envelope signals
// to provide actionable trading recommendations.

import { useMemo } from 'react'
import type { FundingState } from '../lib/types'
import type { NadarayaWatsonResult } from '../lib/nadaraya-watson'
import type { Candle } from '../lib/types'
import { calcRSI } from '../lib/indicators'

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

  // Extract funding rate from breakdown
  const avgRate =
    funding.breakdown.length > 0
      ? funding.breakdown.reduce((sum, b) => sum + b.rate, 0) / funding.breakdown.length
      : 0

  // Funding rate analysis
  if (avgRate < -0.01) {
    score += 2
    reasons.push(`Funding rate âm sâu (${avgRate.toFixed(4)}%) → Short overcrowded`)
  } else if (avgRate > 0.01) {
    score -= 2
    reasons.push(`Funding rate dương cao (${avgRate.toFixed(4)}%) → Long overcrowded`)
  } else if (avgRate < 0) {
    score += 1
    reasons.push(`Funding rate âm nhẹ (${avgRate.toFixed(4)}%) → Short bias`)
  } else if (avgRate > 0) {
    score -= 1
    reasons.push(`Funding rate dương nhẹ (${avgRate.toFixed(4)}%) → Long bias`)
  }

  // NWE signal analysis
  const lastSignal = nwe.signals[nwe.signals.length - 1]
  if (lastSignal) {
    const barsAgo = candles.length - 1 - lastSignal.index
    if (barsAgo <= 3) {
      if (lastSignal.type === 'buy') {
        score += 2
        reasons.push(`NWE tín hiệu BUY gần đây (${barsAgo} nến trước)`)
      } else {
        score -= 2
        reasons.push(`NWE tín hiệu SELL gần đây (${barsAgo} nến trước)`)
      }
    }
  }

  // Price position relative to NWE bands
  if (candles.length > 0) {
    const lastCandle = candles[candles.length - 1]
    const lastUpper = nwe.upper[nwe.upper.length - 1]
    const lastLower = nwe.lower[nwe.lower.length - 1]
    const lastMid = nwe.mid[nwe.mid.length - 1]

    if (lastUpper && lastLower && lastMid) {
      const price = lastCandle.close
      const bandWidth = lastUpper - lastLower

      if (price <= lastLower) {
        score += 2
        reasons.push('Giá ở dải NWE dưới → Quá bán')
      } else if (price >= lastUpper) {
        score -= 2
        reasons.push('Giá ở dải NWE trên → Quá mua')
      } else if (price < lastMid - bandWidth * 0.2) {
        score += 1
        reasons.push('Giá gần dải NWE dưới')
      } else if (price > lastMid + bandWidth * 0.2) {
        score -= 1
        reasons.push('Giá gần dải NWE trên')
      }
    }
  }

  // RSI analysis
  if (candles.length >= 14) {
    const rsi = calcRSI(candles, 14)
    const lastRsi = rsi[rsi.length - 1]
    if (lastRsi !== null) {
      if (lastRsi < 30) {
        score += 2
        reasons.push(`RSI quá bán (${lastRsi.toFixed(1)})`)
      } else if (lastRsi > 70) {
        score -= 2
        reasons.push(`RSI quá mua (${lastRsi.toFixed(1)})`)
      } else if (lastRsi < 40) {
        score += 1
        reasons.push(`RSI thấp (${lastRsi.toFixed(1)})`)
      } else if (lastRsi > 60) {
        score -= 1
        reasons.push(`RSI cao (${lastRsi.toFixed(1)})`)
      }
    }
  }

  // Determine direction and strength
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  let strength: number
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'

  if (score >= 3) {
    direction = 'LONG'
    strength = Math.min(score / 5, 1)
    riskLevel = score >= 5 ? 'LOW' : 'MEDIUM'
  } else if (score <= -3) {
    direction = 'SHORT'
    strength = Math.min(Math.abs(score) / 5, 1)
    riskLevel = score <= -5 ? 'LOW' : 'MEDIUM'
  } else {
    direction = 'NEUTRAL'
    strength = Math.abs(score) / 3
    riskLevel = 'HIGH'
  }

  return { direction, strength, reasons, riskLevel }
}

export function FundingNwePanel({ funding, nwe, candles, symbol }: FundingNwePanelProps) {
  const analysis = useMemo(() => analyzeSignals(funding, nwe, candles), [funding, nwe, candles])

  const avgRate =
    funding.breakdown.length > 0
      ? funding.breakdown.reduce((sum, b) => sum + b.rate, 0) / funding.breakdown.length
      : 0

  const getDirectionColor = () => {
    switch (analysis.direction) {
      case 'LONG':
        return 'var(--color-up, #22c55e)'
      case 'SHORT':
        return 'var(--color-dn, #ef4444)'
      default:
        return 'var(--color-text-muted, #9ca3af)'
    }
  }

  const getStrengthLabel = () => {
    if (analysis.strength >= 0.8) return 'Rất mạnh'
    if (analysis.strength >= 0.6) return 'Mạnh'
    if (analysis.strength >= 0.4) return 'Trung bình'
    return 'Yếu'
  }

  const getRiskColor = () => {
    switch (analysis.riskLevel) {
      case 'LOW':
        return 'var(--color-up, #22c55e)'
      case 'MEDIUM':
        return 'var(--color-warn, #f59e0b)'
      default:
        return 'var(--color-dn, #ef4444)'
    }
  }

  return (
    <div className="btc-funding-nwe-panel">
      <div className="btc-funding-nwe-header">
        <span className="btc-funding-nwe-symbol">{symbol}</span>
        <span
          className="btc-funding-nwe-direction"
          style={{ color: getDirectionColor(), borderColor: getDirectionColor() }}
        >
          {analysis.direction}
        </span>
      </div>

      <div className="btc-funding-nwe-section">
        <div className="btc-funding-nwe-row">
          <span className="btc-funding-nwe-label">Funding Rate</span>
          <span className={`btc-funding-nwe-value ${funding.cls}`}>
            {(avgRate >= 0 ? '+' : '') + avgRate.toFixed(4) + '%'}
          </span>
        </div>
        <div className="btc-funding-nwe-row">
          <span className="btc-funding-nwe-label">Tâm lý</span>
          <span className={`btc-funding-nwe-value ${funding.cls}`}>{funding.sub}</span>
        </div>
      </div>

      <div className="btc-funding-nwe-section">
        <div className="btc-funding-nwe-row">
          <span className="btc-funding-nwe-label">Hướng giao dịch</span>
          <span className="btc-funding-nwe-direction-text" style={{ color: getDirectionColor() }}>
            {analysis.direction} ({getStrengthLabel()})
          </span>
        </div>
        <div className="btc-funding-nwe-row">
          <span className="btc-funding-nwe-label">Rủi ro</span>
          <span className="btc-funding-nwe-risk" style={{ color: getRiskColor() }}>
            {analysis.riskLevel}
          </span>
        </div>
      </div>

      <div className="btc-funding-nwe-reasons">
        <div className="btc-funding-nwe-reasons-title">Phân tích:</div>
        {analysis.reasons.length > 0 ? (
          <ul className="btc-funding-nwe-reasons-list">
            {analysis.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        ) : (
          <div className="btc-funding-nwe-no-signal">Chưa có tín hiệu rõ ràng</div>
        )}
      </div>

      {funding.breakdown.length > 0 && (
        <div className="btc-funding-nwe-breakdown">
          <div className="btc-funding-nwe-breakdown-title">Chi tiết theo sàn:</div>
          {funding.breakdown.map((b) => (
            <div key={b.name} className="btc-funding-nwe-breakdown-row">
              <span>{b.name}</span>
              <span className={b.rate < 0 ? 'up' : b.rate > 0.05 ? 'dn' : ''}>
                {(b.rate >= 0 ? '+' : '') + b.rate.toFixed(4) + '%'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="btc-funding-nwe-rules">
        <div className="btc-funding-nwe-rules-title">Quy tắc:</div>
        <div className="btc-funding-nwe-rule">
          <span className="up">FR &lt; -0.01%</span> → Ưu tiên LONG
        </div>
        <div className="btc-funding-nwe-rule">
          <span className="dn">FR &gt; +0.01%</span> → Ưu tiên SHORT
        </div>
        <div className="btc-funding-nwe-rule">Kết hợp NWE + RSI để xác nhận</div>
      </div>
    </div>
  )
}
