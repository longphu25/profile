// BTC Chart — ML signal gauge and its feature-weight breakdown.

import { FEATURE_LABEL, type MLResult } from '../lib'

export function SignalPanel({ ml }: { ml: MLResult }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Signal</div>
      <div
        className={`btc-chart__ml ${ml.score > 0.55 ? 'is-buy' : ml.score < 0.45 ? 'is-sell' : ''}`}
      >
        <div className="btc-chart__ml-head">
          <span className="btc-chart__ml-label" style={{ color: ml.color }}>
            {ml.label}
          </span>
          <span className="btc-chart__ml-pct">{Math.round(ml.score * 100)}%</span>
        </div>
        <div className="btc-chart__ml-bar-wrap">
          <div
            className="btc-chart__ml-bar"
            style={{ width: Math.round(ml.score * 100) + '%', background: ml.color }}
          />
        </div>
        <div className="btc-chart__ml-foot">Confidence · MH Band + MA + RSI + MACD</div>
      </div>
    </div>
  )
}

export function FeatureWeightsPanel({ ml }: { ml: MLResult }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Feature weights</div>
      <div className="btc-chart__features">
        {Object.entries(ml.features).map(([k, v]) => (
          <div key={k} className="btc-chart__feat">
            <div className="btc-chart__feat-name">{FEATURE_LABEL[k] ?? k}</div>
            <div className={`btc-chart__feat-val ${v >= 0 ? 'up' : 'dn'}`}>
              {v >= 0 ? '+' : ''}
              {v.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
