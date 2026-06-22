// BTC Chart — market-data readouts: funding rate, 24h stats, Fear & Greed.

import type { FundingState, StatsState, FngState } from '../lib'

export function FundingPanel({ funding }: { funding: FundingState }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Funding rate (avg)</div>
      <div className={`btc-chart__fund-val ${funding.cls}`}>{funding.val}</div>
      <div className={`btc-chart__fund-sentiment ${funding.cls}`}>{funding.sub}</div>
      {funding.breakdown.length > 0 && (
        <div className="btc-chart__fund-breakdown">
          {funding.breakdown.map((b) => (
            <div key={b.name} className="btc-chart__fund-row">
              <span>{b.name}</span>
              <span className={b.rate < 0 ? 'up' : b.rate > 0.05 ? 'dn' : ''}>
                {(b.rate >= 0 ? '+' : '') + b.rate.toFixed(4) + '%'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="btc-chart__fund-rules">
        <div>
          <span>&gt; 0.10%</span>
          <span className="dn">Long heavy (bearish signal)</span>
        </div>
        <div>
          <span>0 – 0.05%</span>
          <span>Balanced</span>
        </div>
        <div>
          <span>&lt; 0%</span>
          <span className="up">Short heavy (bullish signal)</span>
        </div>
      </div>
    </div>
  )
}

export function StatsPanel({ stats }: { stats: StatsState }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">24h stats</div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">High</span>
        <span className="btc-chart__row-val">{stats.high}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Low</span>
        <span className="btc-chart__row-val">{stats.low}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Volume</span>
        <span className="btc-chart__row-val">{stats.vol}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Change</span>
        <span className={`btc-chart__row-val ${stats.up ? 'up' : 'dn'}`}>{stats.chg}</span>
      </div>
    </div>
  )
}

export function FearGreedPanel({ fng }: { fng: FngState }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Fear &amp; Greed</div>
      <div className="btc-chart__fng">
        <div className="btc-chart__fng-val" style={{ color: fng.color }}>
          {fng.val}
        </div>
        <div className="btc-chart__fng-label" style={{ color: fng.color }}>
          {fng.label}
        </div>
        <div className="btc-chart__fng-bar">
          <div className="btc-chart__fng-ptr" style={{ left: fng.pct + '%' }} />
        </div>
      </div>
    </div>
  )
}
