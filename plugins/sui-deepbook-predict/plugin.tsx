// SUI DeepBook Predict Plugin — Prediction Market Dashboard
// Features: Surface Studio, PLP Risk, Wallet Mint/Redeem, Range Positions, Vault Supply/Withdraw
// Connects to DeepBook Predict testnet server + on-chain via SuiHostAPI

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { StrategyTab } from './components/StrategyTab'
import { ArbTab } from './components/ArbTab'
import { PLPHedgeTab } from './components/PLPHedgeTab'
import { MarginLoopTab } from './components/MarginLoopTab'
import { useTour } from './hooks/useTour'
import './style.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const PRICE_SCALE = 1e9
const STRIKE_SCALE = 1e9
const DUSDC_DECIMALS = 6

let sharedHost: SuiHostAPI | null = null

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── SVI Math ───────────────────────────────────────────────────────────────────

function computeSVISurface(
  svi: {
    a: number
    b: number
    rho: number
    rho_negative: boolean
    m: number
    m_negative: boolean
    sigma: number
  },
  forward: number,
  expiryMs: number,
  minStrike: number,
  tickSize: number,
) {
  const a = svi.a / 1e6,
    b = svi.b / 1e6
  const rho = ((svi.rho_negative ? -1 : 1) * svi.rho) / 1e9
  const m_val = ((svi.m_negative ? -1 : 1) * svi.m) / 1e6
  const sigma = svi.sigma / 1e6
  const F = forward / PRICE_SCALE
  const T = Math.max((expiryMs - Date.now()) / (365.25 * 24 * 3600 * 1000), 1 / 365)
  const strikes: number[] = []
  const lo = Math.max(minStrike / STRIKE_SCALE, F * 0.7)
  const hi = F * 1.3
  const tick = tickSize / STRIKE_SCALE
  for (let s = lo; s <= hi; s += tick) strikes.push(s)
  const step = Math.max(1, Math.floor(strikes.length / 30))
  const sampled = strikes.filter((_, i) => i % step === 0)
  const surface = sampled.map((K) => {
    const k = Math.log(K / F)
    const diff = k - m_val
    const w = a + b * (rho * diff + Math.sqrt(diff * diff + sigma * sigma))
    const iv = w > 0 ? Math.sqrt(w / T) * 100 : 0
    return { strike: K, moneyness: k, iv, w }
  })
  return { surface, forward: F, T, params: { a, b, rho, m: m_val, sigma } }
}

function checkButterflyViolations(surface: { strike: number; iv: number }[]) {
  const violations: { strike: number; iv: number; expected: number }[] = []
  for (let i = 1; i < surface.length - 1; i++) {
    const prev = surface[i - 1],
      curr = surface[i],
      next = surface[i + 1]
    const w = (next.strike - curr.strike) / (next.strike - prev.strike)
    const interp = w * prev.iv + (1 - w) * next.iv
    if (curr.iv > interp * 1.02)
      violations.push({ strike: curr.strike, iv: curr.iv, expected: interp })
  }
  return violations
}

// ── Main Component ─────────────────────────────────────────────────────────────

function PredictContent() {
  const [tab, setTab] = useState<
    'market' | 'surface' | 'risk' | 'trade' | 'vault' | 'strategy' | 'arb' | 'plphedge' | 'loop'
  >('market')
  const [oracles, setOracles] = useState<any[]>([])
  const [selectedOracle, setSelectedOracle] = useState<string | null>(null)
  const [oracleState, setOracleState] = useState<any>(null)
  const [vaultData, setVaultData] = useState<any>(null)
  const [prices, setPrices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<string>('checking')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { startTour } = useTour()

  // ── Wallet sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sharedHost) return
    const ctx = sharedHost.getSuiContext()
    setWalletAddress(ctx.address)
    setIsConnected(ctx.isConnected)
    return sharedHost.onSuiContextChange((c) => {
      setWalletAddress(c.address)
      setIsConnected(c.isConnected)
    })
  }, [])

  // ── Data fetching ──────────────────────────────────────────────────────────
  const checkServer = useCallback(async () => {
    const data = await fetchJSON<{ status: string }>('/status')
    setServerStatus(data ? 'online' : 'offline')
  }, [])

  const fetchOracles = useCallback(async () => {
    const data = await fetchJSON<any[]>(`/predicts/${PREDICT_ID}/oracles`)
    if (data && Array.isArray(data)) {
      setOracles(data)
      if (!selectedOracle && data.length > 0) setSelectedOracle(data[0].oracle_id)
    }
  }, [selectedOracle])

  const fetchOracleState = useCallback(async () => {
    if (!selectedOracle) return
    const data = await fetchJSON<any>(`/oracles/${selectedOracle}/state`)
    if (data) setOracleState(data)
  }, [selectedOracle])

  const fetchVault = useCallback(async () => {
    const data = await fetchJSON<any>(`/predicts/${PREDICT_ID}/vault/summary`)
    if (data) setVaultData(data)
  }, [])

  const fetchPrices = useCallback(async () => {
    if (!selectedOracle) return
    const data = await fetchJSON<any[]>(`/oracles/${selectedOracle}/prices`)
    if (data && Array.isArray(data)) setPrices(data.slice(-50))
  }, [selectedOracle])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([checkServer(), fetchOracles(), fetchVault()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch')
    }
    setLoading(false)
  }, [checkServer, fetchOracles, fetchVault])

  useEffect(() => {
    refreshAll()
    pollRef.current = setInterval(refreshAll, 20000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refreshAll])
  useEffect(() => {
    if (selectedOracle) {
      fetchOracleState()
      fetchPrices()
    }
  }, [selectedOracle, fetchOracleState, fetchPrices])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtPrice = (raw: number | null | undefined) =>
    raw == null
      ? '—'
      : `$${(raw / PRICE_SCALE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtAddr = (a: string) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—')
  const fmtDate = (ms: number | null | undefined) =>
    !ms
      ? '—'
      : new Date(ms).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  const timeLeft = (ms: number) => {
    const d = ms - Date.now()
    if (d <= 0) return 'Expired'
    const m = Math.floor(d / 60000)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }
  const statusBadge = (s: string) =>
    s === 'active'
      ? 'sui-predict__badge--green'
      : s === 'settled'
        ? 'sui-predict__badge--red'
        : 'sui-predict__badge--yellow'

  // ── Market Tab ─────────────────────────────────────────────────────────────
  const renderMarket = () => (
    <div className="sui-predict__grid">
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Protocol State</h3>
          <span
            className={`sui-predict__badge ${serverStatus === 'online' ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
          >
            {serverStatus}
          </span>
        </div>
        <div className="sui-predict__stats">
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">Predict Object</span>
            <span className="sui-predict__stat-value sui-predict__stat-value--mono">
              {fmtAddr(PREDICT_ID)}
            </span>
          </div>
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">Package</span>
            <span className="sui-predict__stat-value sui-predict__stat-value--mono">
              {fmtAddr(PREDICT_PACKAGE)}
            </span>
          </div>
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">Quote Asset</span>
            <span className="sui-predict__stat-value">DUSDC</span>
          </div>
          <div className="sui-predict__stat">
            <span className="sui-predict__stat-label">Active Oracles</span>
            <span className="sui-predict__stat-value">
              {oracles.filter((o) => o.status === 'active').length} / {oracles.length}
            </span>
          </div>
        </div>
      </div>
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Oracles ({oracles.length})</h3>
        </div>
        <div className="sui-predict__oracle-list">
          {oracles.map((o) => (
            <div
              key={o.oracle_id}
              className={`sui-predict__oracle-row ${selectedOracle === o.oracle_id ? 'sui-predict__oracle-row--active' : ''}`}
              onClick={() => setSelectedOracle(o.oracle_id)}
            >
              <div className="sui-predict__oracle-info">
                <span className="sui-predict__oracle-name">{o.underlying_asset}</span>
                <span className="sui-predict__oracle-expiry">
                  Exp: {fmtDate(o.expiry)} ({timeLeft(o.expiry)})
                </span>
              </div>
              <span className={`sui-predict__badge ${statusBadge(o.status)}`}>{o.status}</span>
            </div>
          ))}
        </div>
      </div>
      {oracleState && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">
              Oracle: {oracleState.oracle?.underlying_asset}
            </h3>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Spot</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                {fmtPrice(oracleState.latest_price?.spot)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Forward</span>
              <span className="sui-predict__stat-value">
                {fmtPrice(oracleState.latest_price?.forward)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Status</span>
              <span
                className={`sui-predict__badge ${statusBadge(oracleState.oracle?.status || '')}`}
              >
                {oracleState.oracle?.status}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Expiry</span>
              <span className="sui-predict__stat-value">{fmtDate(oracleState.oracle?.expiry)}</span>
            </div>
          </div>
        </div>
      )}
      {prices.length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Price History</h3>
          </div>
          <div className="sui-predict__price-chart">
            <div className="sui-predict__bars">
              {prices.slice(-40).map((p, i, arr) => {
                const vals = arr.map((x) => x.spot / PRICE_SCALE)
                const min = Math.min(...vals),
                  max = Math.max(...vals),
                  range = max - min || 1
                const v = p.spot / PRICE_SCALE
                const pct = ((v - min) / range) * 100
                const isUp = i > 0 ? v >= arr[i - 1].spot / PRICE_SCALE : true
                return (
                  <div key={i} className="sui-predict__bar-col">
                    <div
                      className={`sui-predict__bar ${isUp ? 'sui-predict__bar--green' : 'sui-predict__bar--red'}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                      title={`$${v.toFixed(2)}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Trade Tab (Mint/Redeem + Range) ────────────────────────────────────────
  const renderTrade = () => (
    <div className="sui-predict__grid">
      {!isConnected ? (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__empty">
            <p>Connect wallet to mint/redeem positions</p>
            <button className="sui-predict__btn" onClick={() => sharedHost?.requestConnect()}>
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Connected</h3>
              <span className="sui-predict__stat-value--mono">{fmtAddr(walletAddress || '')}</span>
            </div>
          </div>
          <TradePanel
            oracleState={oracleState}
            oracles={oracles}
            selectedOracle={selectedOracle}
            walletAddress={walletAddress!}
          />
        </>
      )}
    </div>
  )

  // ── Vault Tab (Supply/Withdraw) ────────────────────────────────────────────
  const renderVault = () => (
    <div className="sui-predict__grid">
      {vaultData && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Vault Summary</h3>
            <span
              className={`sui-predict__badge ${vaultData.utilization < 0.5 ? 'sui-predict__badge--green' : 'sui-predict__badge--yellow'}`}
            >
              {(vaultData.utilization * 100).toFixed(3)}% util
            </span>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Balance</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                ${(vaultData.vault_balance / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Value</span>
              <span className="sui-predict__stat-value">
                ${(vaultData.vault_value / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">MTM</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--red">
                ${(vaultData.total_mtm / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Max Payout</span>
              <span className="sui-predict__stat-value">
                ${(vaultData.total_max_payout / 1e6).toLocaleString()}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">PLP Price</span>
              <span className="sui-predict__stat-value">
                {vaultData.plp_share_price?.toFixed(6)}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">PLP Supply</span>
              <span className="sui-predict__stat-value">
                {(vaultData.plp_total_supply / 1e6).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
      {!isConnected ? (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__empty">
            <p>Connect wallet to supply/withdraw liquidity</p>
            <button className="sui-predict__btn" onClick={() => sharedHost?.requestConnect()}>
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <VaultPanel walletAddress={walletAddress!} vaultData={vaultData} />
      )}
    </div>
  )

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="sui-predict">
      <div className="sui-predict__tabs">
        {(
          [
            'market',
            'surface',
            'risk',
            'strategy',
            'plphedge',
            'loop',
            'arb',
            'trade',
            'vault',
          ] as const
        ).map((t) => (
          <button
            key={t}
            className={`sui-predict__tab ${tab === t ? 'sui-predict__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'market'
              ? '◉ Market'
              : t === 'surface'
                ? '◊ Surface'
                : t === 'risk'
                  ? '⬡ Risk'
                  : t === 'strategy'
                    ? '⬢ Strategy'
                    : t === 'plphedge'
                      ? '⛨ PLP+Hedge'
                      : t === 'loop'
                        ? '∞ Loop'
                        : t === 'arb'
                          ? '⇄ Arb'
                          : t === 'trade'
                            ? '◇ Trade'
                            : '◈ Vault'}
          </button>
        ))}
        <button
          className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
          onClick={refreshAll}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          {loading ? '⟳' : '↻'} Refresh
        </button>
        <button
          className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm sui-predict__btn--guide"
          onClick={() => {
            const tourMap: Record<string, Parameters<typeof startTour>[0]> = {
              market: 'overview',
              surface: 'surface',
              risk: 'overview',
              strategy: 'overview',
              plphedge: 'plpHedge',
              loop: 'marginLoop',
              arb: 'overview',
              trade: 'trade',
              vault: 'overview',
            }
            startTour(tourMap[tab] || 'overview')
          }}
        >
          ? Guide
        </button>
      </div>
      {error && <div className="sui-predict__error">{error}</div>}
      {tab === 'market' && renderMarket()}
      {tab === 'surface' && <SurfaceStudio oracleId={selectedOracle} oracles={oracles} />}
      {tab === 'risk' && <PLPRiskDashboard />}
      {tab === 'strategy' && (
        <StrategyTab oracleState={oracleState} oracles={oracles} selectedOracle={selectedOracle} />
      )}
      {tab === 'arb' && (
        <ArbTab oracleState={oracleState} oracles={oracles} selectedOracle={selectedOracle} />
      )}
      {tab === 'plphedge' && <PLPHedgeTab oracleState={oracleState} vaultData={vaultData} />}
      {tab === 'loop' && <MarginLoopTab oracleState={oracleState} />}
      {tab === 'trade' && renderTrade()}
      {tab === 'vault' && renderVault()}
    </div>
  )
}

// ── Surface Studio ─────────────────────────────────────────────────────────────

function SurfaceStudio({ oracleId, oracles }: { oracleId: string | null; oracles: any[] }) {
  const [sviHistory, setSviHistory] = useState<any[]>([])
  const [sliderIdx, setSliderIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selOracle, setSelOracle] = useState(oracleId)
  const [latestPrice, setLatestPrice] = useState<any>(null)

  const activeOracle = oracles.find((o) => o.oracle_id === selOracle)

  useEffect(() => {
    if (oracleId && !selOracle) setSelOracle(oracleId)
  }, [oracleId])

  useEffect(() => {
    if (!selOracle) return
    setLoading(true)
    Promise.all([
      fetchJSON<any[]>(`/oracles/${selOracle}/svi`),
      fetchJSON<any>(`/oracles/${selOracle}/state`),
    ]).then(([svi, state]) => {
      if (svi && Array.isArray(svi)) {
        setSviHistory(svi.slice(-30))
        setSliderIdx(Math.min(svi.length - 1, 29))
      }
      if (state?.latest_price) setLatestPrice(state.latest_price)
      setLoading(false)
    })
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
      {/* Feature description */}
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
        <div className="sui-predict__info-text">
          <h4>How it works</h4>
          <p>
            Live implied volatility surface streamed from <code>oracle::OracleSVIUpdated</code>{' '}
            events. The SVI (Stochastic Volatility Inspired) parameterization models the entire
            smile with 5 parameters.
          </p>
          <h4>SVI Formula</h4>
          <p className="sui-predict__formula">w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))</p>
          <p className="sui-predict__formula">IV(K) = √(w(k) / T) × 100%</p>
          <p>
            Where: <code>k = ln(K/F)</code> is log-moneyness, <code>K</code> = strike,{' '}
            <code>F</code> = forward price, <code>T</code> = time to expiry (years)
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
            Butterfly condition: for consecutive strikes K₁ &lt; K₂ &lt; K₃, the interpolated IV
            must not exceed actual IV by &gt;2%. Violations indicate potential arbitrage
            opportunities.
          </p>
        </div>
      </div>

      {loading && <div className="sui-predict__empty">Loading SVI data…</div>}

      {/* Time-travel slider */}
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

      {/* Vol Surface */}
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

      {/* Arbitrage check */}
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

      {/* SVI params */}
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
    </div>
  )
}

// ── PLP Risk Dashboard ──────────────────────────────────────────────────────────

function PLPRiskDashboard() {
  const [vault, setVault] = useState<any>(null)
  const [performance, setPerformance] = useState<any[]>([])
  const [oracleList, setOracleList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState(0)

  useEffect(() => {
    Promise.all([
      fetchJSON<any>(`/predicts/${PREDICT_ID}/vault/summary`),
      fetchJSON<any>(`/predicts/${PREDICT_ID}/vault/performance?range=ALL`),
      fetchJSON<any[]>(`/predicts/${PREDICT_ID}/oracles`),
    ]).then(([v, perf, orc]) => {
      if (v) setVault(v)
      if (perf?.points) setPerformance(perf.points)
      if (orc && Array.isArray(orc)) setOracleList(orc)
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
      {/* Feature description */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">PLP Risk Dashboard</h3>
        </div>
        <div className="sui-predict__info-text">
          <h4>How it works</h4>
          <p>
            The vault takes the opposite side of every Predict trade. LPs supply DUSDC and receive
            PLP shares proportional to their deposit relative to current vault value.
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
        </div>
      </div>

      {/* Vault health */}
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

      {/* What-if */}
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

      {/* PLP performance */}
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

      {/* Per-oracle exposure */}
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
    </div>
  )
}

// ── Trade Panel (Mint/Redeem Binary + Range) ────────────────────────────────────

function TradePanel({
  oracleState,
  oracles: _oracles,
  selectedOracle,
  walletAddress,
}: {
  oracleState: any
  oracles: any[]
  selectedOracle: string | null
  walletAddress: string
}) {
  const [mode, setMode] = useState<'binary' | 'range'>('binary')
  const [action, setAction] = useState<'mint' | 'redeem'>('mint')
  const [strike, setStrike] = useState('')
  const [lowerStrike, setLowerStrike] = useState('')
  const [upperStrike, setUpperStrike] = useState('')
  const [isUp, setIsUp] = useState(true)
  const [amount, setAmount] = useState('')
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const spotPrice = oracleState?.latest_price?.spot
    ? (oracleState.latest_price.spot / PRICE_SCALE).toFixed(0)
    : ''

  const handleSubmit = async () => {
    if (!sharedHost || !selectedOracle || !amount) return
    setSubmitting(true)
    setTxError(null)
    setTxDigest(null)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)
      const amountRaw = Math.floor(Number(amount) * 10 ** DUSDC_DECIMALS)

      if (mode === 'binary') {
        const strikeRaw = Math.floor(Number(strike) * STRIKE_SCALE)
        // Call predict::mint_position or predict::redeem_position
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::${action === 'mint' ? 'mint_position' : 'redeem_position'}`,
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(selectedOracle),
            tx.pure.u64(strikeRaw),
            tx.pure.bool(isUp),
            tx.pure.u64(amountRaw),
          ],
        })
      } else {
        const lowerRaw = Math.floor(Number(lowerStrike) * STRIKE_SCALE)
        const upperRaw = Math.floor(Number(upperStrike) * STRIKE_SCALE)
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::${action === 'mint' ? 'mint_range' : 'redeem_range'}`,
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(selectedOracle),
            tx.pure.u64(lowerRaw),
            tx.pure.u64(upperRaw),
            tx.pure.u64(amountRaw),
          ],
        })
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  return (
    <>
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">
            {action === 'mint' ? 'Mint' : 'Redeem'}{' '}
            {mode === 'binary' ? 'Binary Position' : 'Vertical Range'}
          </h3>
        </div>
        {/* Mode + Action toggles */}
        <div className="sui-predict__toggle-row">
          <div className="sui-predict__toggle">
            <button
              className={`sui-predict__toggle-btn ${mode === 'binary' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setMode('binary')}
            >
              Binary
            </button>
            <button
              className={`sui-predict__toggle-btn ${mode === 'range' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setMode('range')}
            >
              Range
            </button>
          </div>
          <div className="sui-predict__toggle">
            <button
              className={`sui-predict__toggle-btn ${action === 'mint' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setAction('mint')}
            >
              Mint
            </button>
            <button
              className={`sui-predict__toggle-btn ${action === 'redeem' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setAction('redeem')}
            >
              Redeem
            </button>
          </div>
        </div>

        {/* Oracle info */}
        {oracleState && (
          <div className="sui-predict__trade-info">
            <span>Oracle: {oracleState.oracle?.underlying_asset}</span>
            <span>Spot: ${spotPrice}</span>
            <span>
              Expiry:{' '}
              {new Date(oracleState.oracle?.expiry).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Inputs */}
        <div className="sui-predict__form">
          {mode === 'binary' ? (
            <>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Strike Price (USD)</label>
                <input
                  className="sui-predict__input"
                  type="number"
                  placeholder={spotPrice || '75000'}
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                />
              </div>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Direction</label>
                <div className="sui-predict__toggle">
                  <button
                    className={`sui-predict__toggle-btn ${isUp ? 'sui-predict__toggle-btn--green' : ''}`}
                    onClick={() => setIsUp(true)}
                  >
                    ▲ UP
                  </button>
                  <button
                    className={`sui-predict__toggle-btn ${!isUp ? 'sui-predict__toggle-btn--red' : ''}`}
                    onClick={() => setIsUp(false)}
                  >
                    ▼ DOWN
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Lower Strike (USD)</label>
                <input
                  className="sui-predict__input"
                  type="number"
                  placeholder="70000"
                  value={lowerStrike}
                  onChange={(e) => setLowerStrike(e.target.value)}
                />
              </div>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Upper Strike (USD)</label>
                <input
                  className="sui-predict__input"
                  type="number"
                  placeholder="80000"
                  value={upperStrike}
                  onChange={(e) => setUpperStrike(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="sui-predict__field">
            <label className="sui-predict__field-label">Amount (DUSDC)</label>
            <input
              className="sui-predict__input"
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button
            className="sui-predict__btn sui-predict__btn--full"
            onClick={handleSubmit}
            disabled={submitting || !amount || !selectedOracle}
          >
            {submitting
              ? 'Submitting…'
              : `${action === 'mint' ? 'Mint' : 'Redeem'} ${mode === 'binary' ? 'Position' : 'Range'}`}
          </button>
        </div>

        {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
        {txError && <div className="sui-predict__error">{txError}</div>}
      </div>

      {/* Info */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__info-text">
          <h4>Binary Positions</h4>
          <p>
            Key: <code>(oracle_id, expiry, strike, is_up)</code>. UP pays if settlement &gt; strike.
            DOWN pays if settlement &lt; strike.
          </p>
          <h4>Vertical Ranges</h4>
          <p>
            Key: <code>(oracle_id, expiry, lower, upper)</code>. Pays when settlement ∈ (lower,
            upper]. Priced as a bounded instrument.
          </p>
        </div>
      </div>
    </>
  )
}

// ── Vault Panel (Supply/Withdraw) ───────────────────────────────────────────────

function VaultPanel({ walletAddress, vaultData }: { walletAddress: string; vaultData: any }) {
  const [action, setAction] = useState<'supply' | 'withdraw'>('supply')
  const [amount, setAmount] = useState('')
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!sharedHost || !amount) return
    setSubmitting(true)
    setTxError(null)
    setTxDigest(null)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)
      const amountRaw = Math.floor(Number(amount) * 10 ** DUSDC_DECIMALS)

      if (action === 'supply') {
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::supply`,
          typeArguments: [DUSDC_TYPE],
          arguments: [tx.object(PREDICT_ID), tx.pure.u64(amountRaw)],
        })
      } else {
        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::withdraw`,
          typeArguments: [DUSDC_TYPE],
          arguments: [tx.object(PREDICT_ID), tx.pure.u64(amountRaw)],
        })
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  const estimatedShares =
    vaultData && Number(amount) > 0
      ? ((Number(amount) * vaultData.plp_total_supply) / (vaultData.vault_value / 1e6)).toFixed(2)
      : null

  return (
    <div className="sui-predict__card sui-predict__card--wide">
      <div className="sui-predict__card-header">
        <h3 className="sui-predict__card-title">
          {action === 'supply' ? 'Supply Liquidity' : 'Withdraw Liquidity'}
        </h3>
      </div>
      <div className="sui-predict__toggle-row">
        <div className="sui-predict__toggle">
          <button
            className={`sui-predict__toggle-btn ${action === 'supply' ? 'sui-predict__toggle-btn--active' : ''}`}
            onClick={() => setAction('supply')}
          >
            Supply
          </button>
          <button
            className={`sui-predict__toggle-btn ${action === 'withdraw' ? 'sui-predict__toggle-btn--active' : ''}`}
            onClick={() => setAction('withdraw')}
          >
            Withdraw
          </button>
        </div>
      </div>
      <div className="sui-predict__form">
        <div className="sui-predict__field">
          <label className="sui-predict__field-label">
            {action === 'supply' ? 'DUSDC Amount' : 'PLP Amount'}
          </label>
          <input
            className="sui-predict__input"
            type="number"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {action === 'supply' && estimatedShares && (
          <div className="sui-predict__trade-info">
            <span>≈ {estimatedShares} PLP shares</span>
            <span>Share price: {vaultData.plp_share_price?.toFixed(6)}</span>
          </div>
        )}
        <button
          className="sui-predict__btn sui-predict__btn--full"
          onClick={handleSubmit}
          disabled={submitting || !amount}
        >
          {submitting
            ? 'Submitting…'
            : action === 'supply'
              ? 'Supply DUSDC → PLP'
              : 'Burn PLP → DUSDC'}
        </button>
      </div>
      {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
      {txError && <div className="sui-predict__error">{txError}</div>}
      <div className="sui-predict__info-text" style={{ marginTop: '12px' }}>
        <p>
          <strong>Supply:</strong> Deposit DUSDC → receive PLP shares. First supplier gets 1:1,
          later suppliers proportional to vault value.
        </p>
        <p>
          <strong>Withdraw:</strong> Burn PLP → receive DUSDC. Subject to available liquidity after
          max payout coverage.
        </p>
      </div>
    </div>
  )
}

// ── Plugin export ──────────────────────────────────────────────────────────────

const SuiDeepBookPredictPlugin: Plugin = {
  name: 'SuiDeepBookPredict',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-predict/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) sharedHost = host
    host.registerComponent('SuiDeepBookPredict', PredictContent)
    host.log('SuiDeepBookPredict initialized')
  },

  mount() {
    console.log('[SuiDeepBookPredict] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookPredict] unmounted')
  },
}

export default SuiDeepBookPredictPlugin
