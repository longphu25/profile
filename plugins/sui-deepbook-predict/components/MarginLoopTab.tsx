/**
 * Three-Protocol Margin Loop Tab
 * iron_bank → deepbook_margin → predict ranges
 */

import { useState, useMemo } from 'react'
import { simulateMarginLoop } from '../strategies'
import { PRICE_SCALE } from '../types'

interface Props {
  oracleState: any
}

export function MarginLoopTab({ oracleState }: Props) {
  const [collateral, setCollateral] = useState('10000')
  const [ltv, setLtv] = useState('70')
  const [numRanges, setNumRanges] = useState('5')
  const [rangeWidth, setRangeWidth] = useState('8')
  const [ironAPY, setIronAPY] = useState('5')
  const [borrowRate, setBorrowRate] = useState('8')
  const [predictReturn, setPredictReturn] = useState('30')

  const spotRaw = oracleState?.latest_price?.spot || 0
  const spot = spotRaw / PRICE_SCALE

  const result = useMemo(() => {
    if (!spotRaw) return null
    return simulateMarginLoop({
      collateral: Number(collateral) || 10000,
      ironBankAPY: Number(ironAPY) || 5,
      marginBorrowRate: Number(borrowRate) || 8,
      ltv: (Number(ltv) || 70) / 100,
      numRanges: Number(numRanges) || 5,
      rangeWidthPct: Number(rangeWidth) || 8,
      spotRaw,
      expiryHours: 1,
      predictReturnPct: Number(predictReturn) || 30,
    })
  }, [collateral, ltv, numRanges, rangeWidth, ironAPY, borrowRate, predictReturn, spotRaw])

  return (
    <div className="sui-predict__grid">
      {/* Description */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Three-Protocol Margin Loop</h3>
        </div>
        <div className="sui-predict__info-text">
          <h4>Strategy</h4>
          <p>Stack three Sui DeFi protocols in a single composable flow:</p>
          <ol>
            <li>
              <strong>iron_bank</strong>: Deposit USDC → receive USDsui share token (earn yield)
            </li>
            <li>
              <strong>deepbook_margin</strong>: Collateralize USDsui → borrow dUSDC (leverage)
            </li>
            <li>
              <strong>predict</strong>: Deploy dUSDC into range positions (earn prediction payouts)
            </li>
          </ol>
          <p className="sui-predict__formula">Leverage = borrowed_amount / collateral = LTV</p>
          <p className="sui-predict__formula">
            Net PnL = predict_payout + iron_bank_yield − margin_interest − predict_cost
          </p>
          <h4>Liquidation Path</h4>
          <p className="sui-predict__formula">LTV_current = debt / collateral_value</p>
          <p>If LTV &gt; 85% → margin call → close predict positions → repay debt</p>
          <h4>Atomic Execution</h4>
          <p>Entire stack opens in a single PTB (Programmable Transaction Block):</p>
          <p className="sui-predict__formula">
            PTB = [iron_bank::deposit, margin::borrow, predict::mint_range × N]
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
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}
        >
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Collateral ($)</label>
            <input
              className="sui-predict__input"
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">LTV %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="30"
              max="80"
              value={ltv}
              onChange={(e) => setLtv(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Ranges</label>
            <input
              className="sui-predict__input"
              type="number"
              min="1"
              max="10"
              value={numRanges}
              onChange={(e) => setNumRanges(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Width %</label>
            <input
              className="sui-predict__input"
              type="number"
              min="2"
              max="20"
              value={rangeWidth}
              onChange={(e) => setRangeWidth(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">iron_bank APY%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={ironAPY}
              onChange={(e) => setIronAPY(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Borrow Rate%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={borrowRate}
              onChange={(e) => setBorrowRate(e.target.value)}
            />
          </div>
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Predict Return%</label>
            <input
              className="sui-predict__input"
              type="number"
              value={predictReturn}
              onChange={(e) => setPredictReturn(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Protocol flow */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Protocol Flow</h3>
            </div>
            <div className="sui-predict__flow">
              {result.steps.map((s, i) => (
                <div key={i} className="sui-predict__flow-step">
                  <span className="sui-predict__flow-protocol">{s.protocol}</span>
                  <span className="sui-predict__flow-action">{s.action}</span>
                  <span className="sui-predict__flow-amount">${s.amount.toFixed(0)}</span>
                  <span className="sui-predict__flow-result">{s.result}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Metrics</h3>
            </div>
            <div className="sui-predict__stats">
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Leverage</span>
                <span className="sui-predict__stat-value">{result.leverage.toFixed(2)}×</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Exposure</span>
                <span className="sui-predict__stat-value">${result.totalExposure.toFixed(0)}</span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Best APY</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--green">
                  {result.bestCaseAPY.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Worst APY</span>
                <span className="sui-predict__stat-value sui-predict__stat-value--red">
                  {result.worstCaseAPY.toFixed(1)}%
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Liq. Price</span>
                <span className="sui-predict__stat-value">
                  ${result.liquidationPrice.toFixed(0)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">Worst LTV</span>
                <span
                  className={`sui-predict__stat-value ${result.worstCaseLTV > 0.85 ? 'sui-predict__stat-value--red' : ''}`}
                >
                  {(result.worstCaseLTV * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">PnL & LTV Scenarios</h3>
            </div>
            <div className="sui-predict__table">
              <div className="sui-predict__table-header sui-predict__table-header--4col">
                <span>BTC Move</span>
                <span>PnL</span>
                <span>LTV</span>
                <span>Status</span>
              </div>
              {result.scenarios.map((s, i) => (
                <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                  <span>
                    {s.move >= 0 ? '+' : ''}
                    {s.move}%
                  </span>
                  <span
                    className={s.pnl >= 0 ? 'sui-predict__text--green' : 'sui-predict__text--red'}
                  >
                    ${s.pnl.toFixed(0)}
                  </span>
                  <span className={s.ltv > 0.85 ? 'sui-predict__text--red' : ''}>
                    {(s.ltv * 100).toFixed(1)}%
                  </span>
                  <span
                    className={`sui-predict__badge ${s.liquidated ? 'sui-predict__badge--red' : 'sui-predict__badge--green'}`}
                  >
                    {s.liquidated ? 'LIQUIDATED' : 'SAFE'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
