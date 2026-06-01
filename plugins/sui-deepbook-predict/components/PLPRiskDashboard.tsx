import { useEffect, useState } from 'react'
import { PREDICT_ID } from '../domain/constants'
import { getVaultSummary, getVaultPerformance, getOracles } from '../data/predictRepository'
import { CollapsibleNotes } from './shared'

export function PLPRiskDashboard() {
  const [vault, setVault] = useState<any>(null)
  const [performance, setPerformance] = useState<any[]>([])
  const [oracleList, setOracleList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState(0)

  useEffect(() => {
    Promise.all([
      getVaultSummary(PREDICT_ID),
      getVaultPerformance(PREDICT_ID),
      getOracles(PREDICT_ID),
    ]).then(([v, perf, orc]) => {
      if (v) setVault(v)
      if (perf?.points) setPerformance(perf.points)
      if (orc.length > 0) setOracleList(orc)
      setLoading(false)
    })
  }, [])

  const simulateScenario = (movePct: number) => {
    if (!vault) return null
    const vaultVal = vault.vault_value / 1e6
    const mtm = vault.total_mtm / 1e6
    const newMtm = mtm * (1 + Math.abs(movePct) / 100)
    const pnl = -(newMtm - mtm)
    const newVaultVal = vaultVal + pnl
    const newSharePrice =
      vault.plp_total_supply > 0 ? (newVaultVal * 1e6) / vault.plp_total_supply : 1
    return { pnl, newVaultVal, newSharePrice, newMtm }
  }
  const scenarioResult = simulateScenario(scenario)

  if (loading) return <div className="sui-predict__empty">Loading risk data…</div>

  return (
    <div className="sui-predict__grid">
      {vault && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Vault Health</h3>
            <span
              className={`sui-predict__badge ${vault.utilization < 0.5 ? 'sui-predict__badge--green' : 'sui-predict__badge--yellow'}`}
            >
              {(vault.utilization * 100).toFixed(3)}% util
            </span>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Balance</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                ${(vault.vault_balance / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Value</span>
              <span className="sui-predict__stat-value">
                ${(vault.vault_value / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">MTM</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--red">
                ${(vault.total_mtm / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Max Payout</span>
              <span className="sui-predict__stat-value">
                ${(vault.total_max_payout / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Available</span>
              <span className="sui-predict__stat-value">
                ${(vault.available_liquidity / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">PLP Price</span>
              <span className="sui-predict__stat-value">{vault.plp_share_price?.toFixed(6)}</span>
            </div>
          </div>
          <div className="sui-predict__gauge">
            <div className="sui-predict__gauge-bar">
              <div
                className="sui-predict__gauge-fill sui-predict__gauge-fill--mtm"
                style={{ width: `${Math.min(100, vault.utilization * 100 * 100)}%` }}
              />
            </div>
            <div className="sui-predict__gauge-labels">
              <span>MTM: {(vault.utilization * 100).toFixed(3)}%</span>
              <span>Max Payout: {(vault.max_payout_utilization * 100).toFixed(3)}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">What-If Scenario (±5σ)</h3>
        </div>
        <div className="sui-predict__scenario">
          <div className="sui-predict__scenario-control">
            <label className="sui-predict__stat-label">BTC Move</label>
            <input
              type="range"
              min={-50}
              max={50}
              value={scenario}
              onChange={(e) => setScenario(Number(e.target.value))}
              className="sui-predict__slider"
            />
            <span
              className={`sui-predict__scenario-value ${scenario >= 0 ? 'sui-predict__text--green' : 'sui-predict__text--red'}`}
            >
              {scenario >= 0 ? '+' : ''}
              {scenario}%
            </span>
          </div>
          {scenarioResult && (
            <div className="sui-predict__stats">
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">PLP PnL</span>
                <span
                  className={`sui-predict__stat-value ${scenarioResult.pnl >= 0 ? 'sui-predict__stat-value--green' : 'sui-predict__stat-value--red'}`}
                >
                  {scenarioResult.pnl >= 0 ? '+' : ''}${scenarioResult.pnl.toFixed(2)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">New Vault</span>
                <span className="sui-predict__stat-value">
                  ${scenarioResult.newVaultVal.toFixed(2)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">New Price</span>
                <span className="sui-predict__stat-value">
                  {scenarioResult.newSharePrice.toFixed(6)}
                </span>
              </div>
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">New MTM</span>
                <span className="sui-predict__stat-value">${scenarioResult.newMtm.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {performance.length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">PLP Share Price History</h3>
          </div>
          <div className="sui-predict__price-chart">
            <div className="sui-predict__bars">
              {performance.slice(-30).map((p, i, arr) => {
                const vals = arr.map((x) => x.share_price)
                const min = Math.min(...vals),
                  max = Math.max(...vals),
                  range = max - min || 0.001
                const pct = ((p.share_price - min) / range) * 100
                const isUp = i > 0 ? p.share_price >= arr[i - 1].share_price : true
                return (
                  <div key={i} className="sui-predict__bar-col">
                    <div
                      className={`sui-predict__bar ${isUp ? 'sui-predict__bar--green' : 'sui-predict__bar--red'}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={p.share_price.toFixed(6)}
                    />
                  </div>
                )
              })}
            </div>
            <div className="sui-predict__price-range">
              <span>{Math.min(...performance.map((p) => p.share_price)).toFixed(6)}</span>
              <span>{performance[performance.length - 1]?.share_price.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Per-Oracle Exposure</h3>
        </div>
        <div className="sui-predict__table">
          <div className="sui-predict__table-header sui-predict__table-header--4col">
            <span>Asset</span>
            <span>Expiry</span>
            <span>Status</span>
            <span>Time Left</span>
          </div>
          {oracleList.map((o, i) => (
            <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
              <span>{o.underlying_asset}</span>
              <span>
                {new Date(o.expiry).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span
                className={`sui-predict__badge ${o.status === 'active' ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
              >
                {o.status}
              </span>
              <span>
                {o.expiry > Date.now()
                  ? `${Math.floor((o.expiry - Date.now()) / 60000)}m`
                  : 'Expired'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <CollapsibleNotes title="PLP Risk Documentation">
        <h4>How it works</h4>
        <p>
          The vault takes the opposite side of every Predict trade. LPs supply DUSDC and receive PLP
          shares proportional to their deposit relative to current vault value.
        </p>
        <h4>Key Formulas</h4>
        <p className="sui-predict__formula">
          PLP_shares = deposit × (total_PLP_supply / vault_value)
        </p>
        <p className="sui-predict__formula">share_price = vault_value / total_PLP_supply</p>
        <p className="sui-predict__formula">utilization = total_MTM / vault_value</p>
        <p className="sui-predict__formula">max_payout_util = max_payout / vault_balance</p>
        <h4>Risk Metrics</h4>
        <ul>
          <li>
            <strong>MTM (Mark-to-Market)</strong> — current liability from open positions
          </li>
          <li>
            <strong>Max Payout</strong> — worst-case payout if all positions settle ITM
          </li>
          <li>
            <strong>Utilization</strong> — how much of vault value is at risk
          </li>
          <li>
            <strong>Available Liquidity</strong> — vault_balance − max_payout (withdrawable)
          </li>
        </ul>
        <h4>What-If Simulator</h4>
        <p>
          Simulates PLP PnL under a BTC price move. MTM increases proportionally with |move%|,
          reducing vault value and share price.
        </p>
        <p className="sui-predict__formula">
          PnL = −(MTM_new − MTM_current) where MTM_new = MTM × (1 + |move%|)
        </p>
      </CollapsibleNotes>
    </div>
  )
}
