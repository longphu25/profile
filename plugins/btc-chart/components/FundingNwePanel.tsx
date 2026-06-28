// BTC Chart — Unified Funding Rate + NWE Signal Panel
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
  sentiment: string
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
  let sentiment: string

  if (score >= 3) {
    direction = 'LONG'
    strength = Math.min(score / 5, 1)
    riskLevel = score >= 5 ? 'LOW' : 'MEDIUM'
    sentiment = 'Bullish'
  } else if (score <= -3) {
    direction = 'SHORT'
    strength = Math.min(Math.abs(score) / 5, 1)
    riskLevel = score <= -5 ? 'LOW' : 'MEDIUM'
    sentiment = 'Bearish'
  } else {
    direction = 'NEUTRAL'
    strength = Math.abs(score) / 3
    riskLevel = 'HIGH'
    sentiment = 'Neutral'
  }

  return { direction, strength, reasons, riskLevel, sentiment }
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
        return '#22c55e'
      case 'SHORT':
        return '#ef4444'
      default:
        return '#9ca3af'
    }
  }

  const getDirectionIcon = () => {
    switch (analysis.direction) {
      case 'LONG':
        return '↗'
      case 'SHORT':
        return '↘'
      default:
        return '→'
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
        return '#22c55e'
      case 'MEDIUM':
        return '#f59e0b'
      default:
        return '#ef4444'
    }
  }

  const getRiskIcon = () => {
    switch (analysis.riskLevel) {
      case 'LOW':
        return '✓'
      case 'MEDIUM':
        return '⚠'
      default:
        return '⚠'
    }
  }

  return (
    <div className="btc-funding-nwe-unified">
      {/* Header with Symbol and Direction */}
      <div className="btc-fnwe-header">
        <div className="btc-fnwe-symbol-section">
          <span className="btc-fnwe-symbol">{symbol}</span>
          <span className="btc-fnwe-sentiment">{analysis.sentiment}</span>
        </div>
        <div
          className="btc-fnwe-direction-badge"
          style={{
            background: `${getDirectionColor()}15`,
            borderColor: getDirectionColor(),
            color: getDirectionColor(),
          }}
        >
          <span className="btc-fnwe-direction-icon">{getDirectionIcon()}</span>
          <span className="btc-fnwe-direction-text">{analysis.direction}</span>
        </div>
      </div>

      {/* Funding Rate Section */}
      <div className="btc-fnwe-section">
        <div className="btc-fnwe-section-title">
          <span className="btc-fnwe-icon">💰</span>
          Funding Rate
        </div>
        <div className="btc-fnwe-rate-display">
          <div className={`btc-fnwe-rate-value ${funding.cls}`}>
            {(avgRate >= 0 ? '+' : '') + avgRate.toFixed(4)}%
          </div>
          <div className={`btc-fnwe-rate-sentiment ${funding.cls}`}>{funding.sub}</div>
        </div>
        {funding.breakdown.length > 0 && (
          <div className="btc-fnwe-breakdown">
            {funding.breakdown.map((b) => (
              <div key={b.name} className="btc-fnwe-breakdown-item">
                <span className="btc-fnwe-exchange-name">{b.name}</span>
                <span
                  className={`btc-fnwe-exchange-rate ${b.rate < 0 ? 'positive' : b.rate > 0.05 ? 'negative' : ''}`}
                >
                  {(b.rate >= 0 ? '+' : '') + b.rate.toFixed(4)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signal Analysis Section */}
      <div className="btc-fnwe-section">
        <div className="btc-fnwe-section-title">
          <span className="btc-fnwe-icon">📊</span>
          Phân tích tín hiệu
        </div>
        <div className="btc-fnwe-analysis-grid">
          <div className="btc-fnwe-analysis-item">
            <span className="btc-fnwe-analysis-label">Hướng</span>
            <span className="btc-fnwe-analysis-value" style={{ color: getDirectionColor() }}>
              {analysis.direction}
            </span>
          </div>
          <div className="btc-fnwe-analysis-item">
            <span className="btc-fnwe-analysis-label">Độ mạnh</span>
            <span className="btc-fnwe-analysis-value">{getStrengthLabel()}</span>
          </div>
          <div className="btc-fnwe-analysis-item">
            <span className="btc-fnwe-analysis-label">Rủi ro</span>
            <span className="btc-fnwe-analysis-value" style={{ color: getRiskColor() }}>
              {getRiskIcon()} {analysis.riskLevel}
            </span>
          </div>
        </div>
        {analysis.reasons.length > 0 && (
          <div className="btc-fnwe-reasons">
            {analysis.reasons.map((reason, idx) => (
              <div key={idx} className="btc-fnwe-reason-item">
                <span className="btc-fnwe-reason-bullet">•</span>
                <span className="btc-fnwe-reason-text">{reason}</span>
              </div>
            ))}
          </div>
        )}
        {analysis.reasons.length === 0 && (
          <div className="btc-fnwe-no-signal">Chưa có tín hiệu rõ ràng</div>
        )}
      </div>

      {/* Trading Rules */}
      <div className="btc-fnwe-rules">
        <div className="btc-fnwe-rule-item">
          <span className="btc-fnwe-rule-icon positive">↓</span>
          <span className="btc-fnwe-rule-text">
            FR &lt; -0.01% → <strong>LONG</strong>
          </span>
        </div>
        <div className="btc-fnwe-rule-item">
          <span className="btc-fnwe-rule-icon negative">↑</span>
          <span className="btc-fnwe-rule-text">
            FR &gt; +0.01% → <strong>SHORT</strong>
          </span>
        </div>
        <div className="btc-fnwe-rule-item">
          <span className="btc-fnwe-rule-icon neutral">⚡</span>
          <span className="btc-fnwe-rule-text">Kết hợp NWE + RSI để xác nhận</span>
        </div>
      </div>
    </div>
  )
}
