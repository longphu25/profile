// BTC Chart — Whale tracking panel component

import { useMemo } from 'react'
import type { WhaleAlert, ExchangeFlow, WhaleStats } from '../lib/whale'
import { formatWhaleValue, getWhaleSentiment } from '../lib/whale'

interface WhalePanelProps {
  whaleAlerts: WhaleAlert[]
  exchangeFlow: ExchangeFlow | null
  whaleStats: WhaleStats
  recentBuyVolume: number
  recentSellVolume: number
  onClear: () => void
}

/**
 * Panel displaying whale trade alerts and exchange flow analysis
 */
export function WhalePanel({
  whaleAlerts,
  exchangeFlow,
  whaleStats,
  recentBuyVolume,
  recentSellVolume,
  onClear,
}: WhalePanelProps) {
  const sentiment = useMemo(() => getWhaleSentiment(whaleStats.netFlow), [whaleStats.netFlow])

  const flowTone = exchangeFlow
    ? exchangeFlow.netFlow > 0
      ? { color: '#34d8a4', label: 'Net Outflow' }
      : exchangeFlow.netFlow < 0
        ? { color: '#ff7a85', label: 'Net Inflow' }
        : { color: '#888', label: 'Balanced' }
    : { color: '#888', label: 'No Data' }

  return (
    <div className="btc-whale-panel">
      <div className="btc-whale-header">
        <span className="btc-whale-title">Whale Tracker</span>
        <button type="button" className="btc-whale-clear" onClick={onClear} title="Clear alerts">
          ✕
        </button>
      </div>

      {/* Summary Stats */}
      <div className="btc-whale-stats">
        <div className="btc-whale-stat">
          <div className="btc-whale-stat-label">Buy Vol (1h)</div>
          <div className="btc-whale-stat-value" style={{ color: '#34d8a4' }}>
            {formatWhaleValue(recentBuyVolume)}
          </div>
        </div>
        <div className="btc-whale-stat">
          <div className="btc-whale-stat-label">Sell Vol (1h)</div>
          <div className="btc-whale-stat-value" style={{ color: '#ff7a85' }}>
            {formatWhaleValue(recentSellVolume)}
          </div>
        </div>
        <div className="btc-whale-stat">
          <div className="btc-whale-stat-label">Sentiment</div>
          <div className="btc-whale-stat-value" style={{ color: sentiment.color }}>
            {sentiment.label}
          </div>
        </div>
      </div>

      {/* Exchange Flow */}
      {exchangeFlow && (
        <div className="btc-whale-flow">
          <div className="btc-whale-flow-header">
            <span>Exchange Flow (1h)</span>
            <span style={{ color: flowTone.color, fontWeight: 600 }}>
              {flowTone.label}: {formatWhaleValue(Math.abs(exchangeFlow.netFlow))}
            </span>
          </div>
          <div className="btc-whale-flow-bars">
            <div className="btc-whale-flow-bar">
              <div className="btc-whale-flow-bar-label">In</div>
              <div
                className="btc-whale-flow-bar-fill"
                style={{
                  width: `${Math.min(100, (exchangeFlow.exchangeInflow / (exchangeFlow.exchangeInflow + exchangeFlow.exchangeOutflow)) * 100)}%`,
                  backgroundColor: '#ff7a85',
                }}
              />
            </div>
            <div className="btc-whale-flow-bar">
              <div className="btc-whale-flow-bar-label">Out</div>
              <div
                className="btc-whale-flow-bar-fill"
                style={{
                  width: `${Math.min(100, (exchangeFlow.exchangeOutflow / (exchangeFlow.exchangeInflow + exchangeFlow.exchangeOutflow)) * 100)}%`,
                  backgroundColor: '#34d8a4',
                }}
              />
            </div>
          </div>
          <div className="btc-whale-flow-detail">
            <span>Large trades: {exchangeFlow.largeTrades}</span>
            <span>Avg: {formatWhaleValue(whaleStats.avgTradeSize)}</span>
          </div>
        </div>
      )}

      {/* Recent Whale Alerts */}
      <div className="btc-whale-alerts">
        <div className="btc-whale-alerts-header">Recent Whale Trades</div>
        {whaleAlerts.length === 0 ? (
          <div className="btc-whale-empty">No whale trades detected</div>
        ) : (
          <div className="btc-whale-alerts-list">
            {whaleAlerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className={`btc-whale-alert btc-whale-alert-${alert.side}`}>
                <div className="btc-whale-alert-side">
                  {alert.side === 'buy' ? '🐋 BUY' : '📤 SELL'}
                </div>
                <div className="btc-whale-alert-details">
                  <div className="btc-whale-alert-value">{formatWhaleValue(alert.value)}</div>
                  <div className="btc-whale-alert-info">
                    {alert.amount.toFixed(4)} @ ${alert.price.toFixed(2)}
                  </div>
                </div>
                <div className="btc-whale-alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
