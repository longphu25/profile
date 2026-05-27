/**
 * Strategy Tab — Range-Ladder Vault Simulation
 * Simulates auto-minting multiple range positions around spot price.
 */

import { useState, useMemo } from 'react'
import { simulateRangeLadder } from '../strategies'
import { PRICE_SCALE } from '../types'

interface Props {
  oracleState: any
  oracles: any[]
  selectedOracle: string | null
}

export function StrategyTab({ oracleState, oracles, selectedOracle }: Props) {
  const [capital, setCapital] = useState('1000')
  const [numRungs, setNumRungs] = useState('5')
  const [widthPct, setWidthPct] = useState('10')

  const activeOracle = oracles.find((o: any) => o.oracle_id === selectedOracle)
  const spotRaw = oracleState?.latest_price?.spot || 0

  const result = useMemo(() => {
    if (!spotRaw || !activeOracle) return null
    return simulateRangeLadder({
      capital: Number(capital) || 1000,
      numRungs: Number(numRungs) || 5,
      widthPct: Number(widthPct) || 10,
      spotRaw,
      minStrike: activeOracle.min_strike,
      tickSize: activeOracle.tick_size,
    })
  }, [capital, numRungs, widthPct, spotRaw, activeOracle])

  const spot = spotRaw / PRICE_SCALE

  return (
    <div className="sui-predict__grid">
      {/* Description */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Range-Ladder Vault Strategy</h3>
        </div>
        <div className="sui-predict__info-text">
          <h4>How it works</h4>
          <p>
            Automatically mints N vertical range positions evenly distributed around the current
            spot price. Each rung covers an equal price band with equal capital allocation.
          </p>
          <h4>Strategy Logic</h4>
          <p className="sui-predict__formula">ladder_range = [spot − width/2, spot + width/2]</p>
          <p className="sui-predict__formula">rung_width = total_width / num_rungs</p>
          <p className="sui-predict__formula">capital_per_rung = total_capital / num_rungs</p>
          <h4>PnL Model</h4>
          <p>
            If settlement lands in a rung → that rung pays out. All other rungs expire worthless.
            Expected PnL depends on the probability distribution of settlement prices.
          </p>
          <p className="sui-predict__formula">
            PnL = Σ(payout_i × P(settlement ∈ rung_i)) − total_capital
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Configuration</h3>
          {spot > 0 && (
            <span className="sui-predict__stat-value--mono">Spot: ${spot.toFixed(0)}</span>
          )}
        </div>
        <div
          className="sui-predict__form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}
        >
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Capital (DUSDC)</label>
            <input
              className="sui-predict__input"
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Num Rungs</label>
            <input
              className="sui-predict__input"
              type="number"
              min="2"
              max="20"
              value={numRungs}
              onChange={(e) => setNumRungs(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Width (%)</label>
            <input
              className="sui-predict__input"
              type="number"
              min="2"
              max="50"
              value={widthPct}
              onChange={(e) => setWidthPct(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Simulation Results</h3>
            </div>
            <div className="sui-predict__stats">
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Expected PnL</span>
                <span
                  className={`sui-predict__stat-value ${result.expectedPnL >= 0 ? 'sui-predict__stat-value--green' : 'sui-predict__stat-value--red'}`}
                >
                  ${result.expectedPnL.toFixed(2)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Max Loss</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--red">
                  ${result.maxLoss.toFixed(2)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Max Gain</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--green">
                  ${result.maxGain.toFixed(2)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Coverage Prob</span>
                <span className="sui-predict__stat-value">
                  {(result.breakEvenProb * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Rungs */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Range Rungs ({result.rungs.length})</h3>
            </div>
            <div className="sui-predict__table">
              <div className="sui-predict__table-header sui-predict__table-header--4col">
                <span>Lower</span>
                <span>Upper</span>
                <span>Capital</span>
                <span>Prob</span>
              </div>
              {result.rungs.map((r, i) => (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>${r.lower.toFixed(0)}</span>
                  <span>${r.upper.toFixed(0)}</span>
                  <span>${r.capital.toFixed(0)}</span>
                  <span>{(r.probability * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* PnL scenarios chart */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">PnL by Settlement Price</h3>
            </div>
            <div className="sui-predict__price-chart">
              <div className="sui-predict__bars">
                {result.scenarios.map((s, i) => {
                  const maxAbs = Math.max(Math.abs(result.maxLoss), Math.abs(result.maxGain)) || 1
                  const pct = (Math.abs(s.pnl) / maxAbs) * 100
                  return (
                    <div key={i} className="sui-predict__bar-col">
                      <div
                        className={`sui-predict__bar ${s.pnl >= 0 ? 'sui-predict__bar--green' : 'sui-predict__bar--red'}`}
                        style={{ height: `${Math.max(4, pct)}%` }}
                        title={`$${s.settlement.toFixed(0)}: ${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(0)}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="sui-predict__price-range">
                <span>${result.scenarios[0]?.settlement.toFixed(0)}</span>
                <span>Settlement Price</span>
                <span>${result.scenarios[result.scenarios.length - 1]?.settlement.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
