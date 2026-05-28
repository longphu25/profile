/**
 * Arb Tab — Vol-Arb: Predict ↔ External Markets
 * Compares Predict's implied vol vs external BTC prices/vol.
 */

import { useState, useEffect, useCallback } from 'react'
import { computeVolSpread } from '../strategies'
import { computeSVISurface } from '../strategies'
import { fetchJSON, fetchExternalBTCPrice } from '../sdk'
import { PRICE_SCALE } from '../types'
import type { VolSpreadResult } from '../strategies/volArb'
import { CollapsibleNotes } from './shared'

interface Props {
  oracleState: any
  oracles: any[]
  selectedOracle: string | null
}

export function ArbTab({ oracleState, oracles, selectedOracle }: Props) {
  const [externalPrices, setExternalPrices] = useState<{ source: string; price: number }[]>([])
  const [spreadResult, setSpreadResult] = useState<VolSpreadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [threshold, setThreshold] = useState('5')
  const [historicalPrices, setHistoricalPrices] = useState<number[]>([])

  const activeOracle = oracles.find((o: any) => o.oracle_id === selectedOracle)

  const refresh = useCallback(async () => {
    setLoading(true)
    const ext = await fetchExternalBTCPrice()
    setExternalPrices(ext)
    if (selectedOracle) {
      const priceData = await fetchJSON<any[]>(`/oracles/${selectedOracle}/prices`)
      if (priceData && Array.isArray(priceData)) {
        setHistoricalPrices(priceData.slice(-60).map((p: any) => p.spot / PRICE_SCALE))
      }
    }
    setLoading(false)
  }, [selectedOracle])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!oracleState?.latest_svi || !oracleState?.latest_price || !activeOracle) return
    const surface = computeSVISurface(
      oracleState.latest_svi,
      oracleState.latest_price.forward,
      activeOracle.expiry,
      activeOracle.min_strike,
      activeOracle.tick_size,
    )
    const result = computeVolSpread(
      surface,
      externalPrices,
      historicalPrices,
      Number(threshold) || 5,
    )
    setSpreadResult(result)
  }, [oracleState, externalPrices, historicalPrices, threshold, activeOracle])

  const predictSpot = oracleState?.latest_price?.spot
    ? (oracleState.latest_price.spot / PRICE_SCALE).toFixed(2)
    : '—'

  return (
    <div className="sui-predict__grid">
      {/* Config — TOP */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Vol-Arb Configuration</h3>
          <button
            className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
        <div
          className="sui-predict__form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}
        >
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Spread Threshold (IV %)</label>
            <input
              className="sui-predict__input"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Predict Spot</label>
            <div
              className="sui-predict__input"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#80ffd5',
                fontWeight: 650,
              }}
            >
              ${predictSpot}
            </div>
          </div>
        </div>
      </div>

      {/* Spread result — main interactive data */}
      {spreadResult && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Vol Spread Analysis</h3>
            <span
              className={`sui-predict__badge ${spreadResult.signal === 'neutral' ? 'sui-predict__badge--gray' : spreadResult.signal === 'buy_predict' ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
            >
              {spreadResult.signal === 'neutral'
                ? 'NEUTRAL'
                : spreadResult.signal === 'buy_predict'
                  ? 'BUY PREDICT'
                  : 'SELL PREDICT'}
            </span>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Predict ATM IV</span>
              <span className="sui-predict__stat-value">
                {spreadResult.predictATMVol.toFixed(2)}%
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Max Spread</span>
              <span
                className={`sui-predict__stat-value ${spreadResult.maxSpread > Number(threshold) ? 'sui-predict__stat-value--green' : ''}`}
              >
                {spreadResult.maxSpread.toFixed(2)}%
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Kelly Fraction</span>
              <span className="sui-predict__stat-value">
                {(spreadResult.kellyFraction * 100).toFixed(1)}%
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Threshold</span>
              <span className="sui-predict__stat-value">{spreadResult.spreadThreshold}%</span>
            </div>
          </div>

          {spreadResult.externalVols.length > 0 && (
            <div className="sui-predict__table" style={{ marginTop: '12px' }}>
              <div className="sui-predict__table-header sui-predict__table-header--4col">
                <span>Source</span>
                <span>Vol</span>
                <span>Spread</span>
                <span>Direction</span>
              </div>
              {spreadResult.externalVols.map((v, i) => (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>{v.source}</span>
                  <span>{v.vol.toFixed(2)}%</span>
                  <span
                    className={v.spread > 0 ? 'sui-predict__text--red' : 'sui-predict__text--green'}
                  >
                    {v.spread > 0 ? '+' : ''}
                    {v.spread.toFixed(2)}%
                  </span>
                  <span>
                    {v.spread > Number(threshold)
                      ? 'SELL'
                      : v.spread < -Number(threshold)
                        ? 'BUY'
                        : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* External prices */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">External BTC Prices</h3>
        </div>
        {externalPrices.length === 0 ? (
          <div className="sui-predict__empty">Fetching external prices…</div>
        ) : (
          <div className="sui-predict__stats">
            {externalPrices.map((p, i) => (
              <div key={i} className="sui-predict__stat">
                <span className="sui-predict__stat-label">{p.source}</span>
                <span className="sui-predict__stat-value">${p.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Predict Oracle</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                ${predictSpot}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Oracle health */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Oracle Feed Health</h3>
        </div>
        {oracleState?.latest_price ? (
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Last Update</span>
              <span className="sui-predict__stat-value">
                {new Date(oracleState.latest_price.onchain_timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Lag</span>
              {(() => {
                const lag = (Date.now() - oracleState.latest_price.onchain_timestamp) / 1000
                return (
                  <span
                    className={`sui-predict__stat-value ${lag > 5 ? 'sui-predict__stat-value--red' : 'sui-predict__stat-value--green'}`}
                  >
                    {lag.toFixed(1)}s
                  </span>
                )
              })()}
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">SVI Age</span>
              {(() => {
                const age = oracleState.latest_svi
                  ? (Date.now() - oracleState.latest_svi.onchain_timestamp) / 1000
                  : 999
                return (
                  <span
                    className={`sui-predict__stat-value ${age > 10 ? 'sui-predict__stat-value--red' : 'sui-predict__stat-value--green'}`}
                  >
                    {age.toFixed(1)}s
                  </span>
                )
              })()}
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Kill Switch</span>
              {(() => {
                const lag = (Date.now() - oracleState.latest_price.onchain_timestamp) / 1000
                return (
                  <span
                    className={`sui-predict__badge ${lag > 30 ? 'sui-predict__badge--red' : 'sui-predict__badge--green'}`}
                  >
                    {lag > 30 ? 'TRIGGERED' : 'OK'}
                  </span>
                )
              })()}
            </div>
          </div>
        ) : (
          <div className="sui-predict__empty">No oracle data</div>
        )}
      </div>

      {/* Notes — BOTTOM, collapsible */}
      <CollapsibleNotes title="Strategy Documentation">
        <h4>Strategy</h4>
        <p>
          Back-solves Predict's implied vol from <code>OracleSVI</code>, compares against external
          BTC prices and realized volatility. Trades the spread when it exceeds threshold.
        </p>
        <h4>Signal Logic</h4>
        <p className="sui-predict__formula">spread = Predict_ATM_IV − External_IV</p>
        <p className="sui-predict__formula">if |spread| &gt; threshold → trade signal</p>
        <p className="sui-predict__formula">Kelly fraction f* = edge / σ_predict</p>
        <h4>Hooks</h4>
        <ul>
          <li>Handle stale SVI updates gracefully (flag if lag &gt; 5s)</li>
          <li>Size by Kelly fraction for optimal bankroll growth</li>
          <li>Kill switch on feeder lag</li>
        </ul>
      </CollapsibleNotes>
    </div>
  )
}
