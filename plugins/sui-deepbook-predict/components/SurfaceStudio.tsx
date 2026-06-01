import { useEffect, useState } from 'react'
import { computeSVISurface, checkButterflyViolations } from '../domain/svi'
import { getOracleSVIHistory, getOracleState } from '../data/predictRepository'
import { CollapsibleNotes } from './shared'

export function SurfaceStudio({ oracleId, oracles }: { oracleId: string | null; oracles: any[] }) {
  const [sviHistory, setSviHistory] = useState<any[]>([])
  const [sliderIdx, setSliderIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selOracle, setSelOracle] = useState<string | null>(oracleId)
  const [latestPrice, setLatestPrice] = useState<any>(null)
  const [prevOracleId, setPrevOracleId] = useState<string | null>(oracleId)

  if (oracleId !== prevOracleId) {
    setPrevOracleId(oracleId)
    if (oracleId && !selOracle) setSelOracle(oracleId)
  }

  const activeOracle = oracles.find((o) => o.oracle_id === selOracle)

  useEffect(() => {
    if (!selOracle) return
    setLoading(true)
    Promise.all([getOracleSVIHistory(selOracle), getOracleState(selOracle)]).then(
      ([svi, state]) => {
        if (svi && Array.isArray(svi)) {
          setSviHistory(svi.slice(-30))
          setSliderIdx(Math.min(svi.length - 1, 29))
        }
        if (state?.latest_price) setLatestPrice(state.latest_price)
        setLoading(false)
      },
    )
  }, [selOracle])

  const currentSVI = sviHistory[sliderIdx]
  const surface =
    currentSVI && latestPrice && activeOracle
      ? computeSVISurface(
          currentSVI,
          latestPrice.forward,
          activeOracle.expiry,
          activeOracle.min_strike,
          activeOracle.tick_size,
        )
      : null
  const violations = surface ? checkButterflyViolations(surface.surface) : []

  return (
    <div className="sui-predict__grid">
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Predict Surface Studio</h3>
          <select
            className="sui-predict__select"
            value={selOracle || ''}
            onChange={(e) => setSelOracle(e.target.value)}
          >
            {oracles.map((o) => (
              <option key={o.oracle_id} value={o.oracle_id}>
                {o.underlying_asset} —{' '}
                {new Date(o.expiry).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="sui-predict__empty">Loading SVI data…</div>}

      {sviHistory.length > 1 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Time Travel</h3>
            <span className="sui-predict__stat-value--mono">
              {currentSVI ? new Date(currentSVI.onchain_timestamp).toLocaleTimeString() : '—'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={sviHistory.length - 1}
            value={sliderIdx}
            onChange={(e) => setSliderIdx(Number(e.target.value))}
            className="sui-predict__slider"
          />
          <div className="sui-predict__slider-labels">
            <span>
              {new Date(sviHistory[0]?.onchain_timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>
              Update {sliderIdx + 1} / {sviHistory.length}
            </span>
            <span>
              {new Date(sviHistory[sviHistory.length - 1]?.onchain_timestamp).toLocaleTimeString(
                [],
                { hour: '2-digit', minute: '2-digit' },
              )}
            </span>
          </div>
        </div>
      )}

      {surface && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Implied Volatility Smile</h3>
            <div className="sui-predict__surface-meta">
              <span>F=${surface.forward.toFixed(0)}</span>
              <span>T={(surface.T * 365).toFixed(1)}d</span>
            </div>
          </div>
          <div className="sui-predict__vol-chart">
            <div className="sui-predict__vol-y-axis">
              <span>{Math.max(...surface.surface.map((p) => p.iv)).toFixed(1)}%</span>
              <span>{Math.min(...surface.surface.map((p) => p.iv)).toFixed(1)}%</span>
            </div>
            <div className="sui-predict__vol-bars">
              {surface.surface.map((p, i) => {
                const maxIV = Math.max(...surface.surface.map((x) => x.iv))
                const minIV = Math.min(...surface.surface.map((x) => x.iv))
                const pct = ((p.iv - minIV) / (maxIV - minIV || 1)) * 100
                const isATM = Math.abs(p.moneyness) < 0.02
                const hasViolation = violations.some((v) => v.strike === p.strike)
                return (
                  <div
                    key={i}
                    className="sui-predict__vol-bar-col"
                    title={`K=$${p.strike.toFixed(0)} IV=${p.iv.toFixed(2)}%`}
                  >
                    <div
                      className={`sui-predict__vol-bar ${isATM ? 'sui-predict__vol-bar--atm' : ''} ${hasViolation ? 'sui-predict__vol-bar--violation' : ''}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="sui-predict__vol-x-axis">
            <span>${surface.surface[0]?.strike.toFixed(0)}</span>
            <span>← OTM Put | ATM | OTM Call →</span>
            <span>${surface.surface[surface.surface.length - 1]?.strike.toFixed(0)}</span>
          </div>
        </div>
      )}

      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Arbitrage-Free Check</h3>
          <span
            className={`sui-predict__badge ${violations.length === 0 ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
          >
            {violations.length === 0 ? 'CLEAN' : `${violations.length} VIOLATIONS`}
          </span>
        </div>
        {violations.length > 0 && (
          <div className="sui-predict__table">
            <div className="sui-predict__table-header sui-predict__table-header--4col">
              <span>Strike</span>
              <span>Actual IV</span>
              <span>Expected</span>
              <span>Excess</span>
            </div>
            {violations.map((v, i) => (
              <div key={i} className="sui-predict__table-row sui-predict__table-row--4col">
                <span>${v.strike.toFixed(0)}</span>
                <span className="sui-predict__text--red">{v.iv.toFixed(2)}%</span>
                <span>{v.expected.toFixed(2)}%</span>
                <span className="sui-predict__text--red">+{(v.iv - v.expected).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {surface && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Current SVI Parameters</h3>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">a (level)</span>
              <span className="sui-predict__stat-value">{surface.params.a.toFixed(6)}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">b (slope)</span>
              <span className="sui-predict__stat-value">{surface.params.b.toFixed(6)}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">ρ (skew)</span>
              <span className="sui-predict__stat-value">{surface.params.rho.toFixed(4)}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">m (shift)</span>
              <span className="sui-predict__stat-value">{surface.params.m.toFixed(6)}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">σ (curve)</span>
              <span className="sui-predict__stat-value">{surface.params.sigma.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}

      <CollapsibleNotes title="SVI Documentation">
        <h4>How it works</h4>
        <p>
          Live implied volatility surface streamed from <code>oracle::OracleSVIUpdated</code>{' '}
          events. The SVI (Stochastic Volatility Inspired) parameterization models the entire smile
          with 5 parameters.
        </p>
        <h4>SVI Formula</h4>
        <p className="sui-predict__formula">w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))</p>
        <p className="sui-predict__formula">IV(K) = √(w(k) / T) × 100%</p>
        <p>
          Where: <code>k = ln(K/F)</code> is log-moneyness, <code>K</code> = strike, <code>F</code>{' '}
          = forward price, <code>T</code> = time to expiry (years)
        </p>
        <h4>Parameters</h4>
        <ul>
          <li>
            <code>a</code> — overall variance level
          </li>
          <li>
            <code>b</code> — slope (controls wing steepness)
          </li>
          <li>
            <code>ρ</code> — skew (negative = put skew)
          </li>
          <li>
            <code>m</code> — horizontal shift of the smile minimum
          </li>
          <li>
            <code>σ</code> — curvature at the vertex
          </li>
        </ul>
        <h4>Arbitrage-Free Check</h4>
        <p>
          Butterfly condition: for consecutive strikes K₁ &lt; K₂ &lt; K₃, the interpolated IV must
          not exceed actual IV by &gt;2%. Violations indicate potential arbitrage opportunities.
        </p>
      </CollapsibleNotes>
    </div>
  )
}
