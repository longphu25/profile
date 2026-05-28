/**
 * PLP + Hedge Vault Tab
 * Supply PLP + buy OTM DOWN binaries to cap drawdown.
 */

import { useState, useMemo } from 'react'
import { simulatePLPHedge } from '../strategies'
import { PRICE_SCALE } from '../types'
import { CollapsibleNotes } from './shared'

interface Props {
  oracleState: any
  vaultData: any
}

export function PLPHedgeTab({ oracleState, vaultData }: Props) {
  const [capital, setCapital] = useState('5000')
  const [plpPct, setPlpPct] = useState('80')
  const [otmPct, setOtmPct] = useState('10')
  const [numHedges, setNumHedges] = useState('3')
  const [plpAPY, setPlpAPY] = useState('12')

  const spotRaw = oracleState?.latest_price?.spot || 0
  const utilization = vaultData?.utilization || 0
  const sharePrice = vaultData?.plp_share_price || 1

  const result = useMemo(() => {
    if (!spotRaw) return null
    return simulatePLPHedge({
      capital: Number(capital) || 5000,
      plpAllocationPct: Number(plpPct) || 80,
      hedgeOTMPct: Number(otmPct) || 10,
      numHedges: Number(numHedges) || 3,
      vaultUtilization: utilization,
      plpSharePrice: sharePrice,
      plpAPY: Number(plpAPY) || 12,
      spotRaw,
      expiryHours: 1,
    })
  }, [capital, plpPct, otmPct, numHedges, plpAPY, spotRaw, utilization, sharePrice])

  const spot = spotRaw / PRICE_SCALE

  return (
    <div className="sui-predict__grid">
      {/* Config — TOP */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">PLP + Hedge Configuration</h3>
          {spot > 0 && (
            <span className="sui-predict__stat-value--mono">
              Spot: ${spot.toFixed(0)} | Util: {(utilization * 100).toFixed(2)}%
            </span>
          )}
        </div>
        <div
          className="sui-predict__form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px' }}
        >
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Capital</label>
            <input
              className="sui-predict__input"
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">PLP %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="50"
              max="95"
              value={plpPct}
              onChange={(e) => setPlpPct(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">OTM %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="3"
              max="30"
              value={otmPct}
              onChange={(e) => setOtmPct(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Hedges</label>
            <input
              className="sui-predict__input"
              type="number"
              min="1"
              max="10"
              value={numHedges}
              onChange={(e) => setNumHedges(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">PLP APY%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={plpAPY}
              onChange={(e) => setPlpAPY(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Results</h3>
              <span
                className={`sui-predict__badge ${result.netAPY > 0 ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
              >
                Net APY: {result.netAPY.toFixed(1)}%
              </span>
            </div>
            <div className="sui-predict__stats">
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">PLP Allocation</span>
                <span className="sui-predict__stat-value">${result.plpAmount.toFixed(0)}</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Hedge Allocation</span>
                <span className="sui-predict__stat-value">${result.hedgeAmount.toFixed(0)}</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Gross APY</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--green">
                  {result.grossAPY.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Insurance Cost</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--red">
                  {result.insuranceCostPct.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Hedged Max DD</span>
                <span className="sui-predict__stat-value">{result.maxDrawdownPct.toFixed(1)}%</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Unhedged Max DD</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--red">
                  {result.unhedgedMaxDrawdownPct.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Dynamic Ratio</span>
                <span className="sui-predict__stat-value">
                  {(result.dynamicHedgeRatio * 100).toFixed(0)}% hedge
                </span>
              </div>
            </div>
          </div>

          {/* Hedge positions */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Hedge Positions (DOWN binaries)</h3>
            </div>
            <div className="sui-predict__table">
              <div className="sui-predict__table-header sui-predict__table-header--4col">
                <span>Strike</span>
                <span>Cost</span>
                <span>Max Payout</span>
                <span>ITM Prob</span>
              </div>
              {result.hedgePositions.map((h, i) => (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>${h.strike.toFixed(0)}</span>
                  <span>${h.cost.toFixed(0)}</span>
                  <span className="sui-predict__text--green">${h.maxPayout.toFixed(0)}</span>
                  <span>{(h.itmProb * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* PnL chart */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">PnL by BTC Move</h3>
            </div>
            <div className="sui-predict__price-chart">
              <div className="sui-predict__bars">
                {result.scenarios.map((s, i) => {
                  const maxAbs = Math.max(...result.scenarios.map((x) => Math.abs(x.netPnl))) || 1
                  const pct = (Math.abs(s.netPnl) / maxAbs) * 100
                  return (
                    <div key={i} className="sui-predict__bar-col">
                      <div
                        className={`sui-predict__bar ${s.netPnl >= 0 ? 'sui-predict__bar--green' : 'sui-predict__bar--red'}`}
                        style={{ height: `${Math.max(4, pct)}%` }}
                        title={`${s.move}%: $${s.netPnl.toFixed(0)}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="sui-predict__price-range">
                <span>−50%</span>
                <span>BTC Move</span>
                <span>+20%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notes — BOTTOM, collapsible */}
      <CollapsibleNotes title="Strategy Documentation">
        <h4>Strategy</h4>
        <p>
          Supply DUSDC into <code>predict::supply</code> to earn PLP returns. Simultaneously buy OTM
          DOWN binaries via <code>predict::mint</code> to cap left-tail drawdown.
        </p>
        <p className="sui-predict__formula">Product = PLP yield − crash insurance cost</p>
        <h4>How it works</h4>
        <ol>
          <li>Allocate X% to PLP supply (earn vault yield)</li>
          <li>Allocate (100−X)% to OTM DOWN binaries (insurance)</li>
          <li>If BTC crashes below strike → hedges pay out, offsetting PLP loss</li>
          <li>If BTC stays flat/up → PLP earns yield, hedges expire worthless</li>
        </ol>
        <h4>Dynamic Hedge Ratio</h4>
        <p className="sui-predict__formula">
          hedge_ratio = base_ratio × (1 + utilization_adjustment)
        </p>
        <p>
          When vault utilization &gt; 50%, increase hedge allocation by 20%. When &gt; 75%, increase
          by 40%.
        </p>
        <h4>Net APY</h4>
        <p className="sui-predict__formula">
          Net APY = PLP_APY − (hedge_cost / capital) × (365 / expiry_days)
        </p>
      </CollapsibleNotes>
    </div>
  )
}
