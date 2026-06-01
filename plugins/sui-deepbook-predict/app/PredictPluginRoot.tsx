// SUI DeepBook Predict React root.

import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { buildCreateManager, buildTradeTx } from '../application/tradeActions'
import { StrategyTab } from '../components/StrategyTab'
import { ArbTab } from '../components/ArbTab'
import { PLPHedgeTab } from '../components/PLPHedgeTab'
import { MarginLoopTab } from '../components/MarginLoopTab'
import { PortfolioTab } from '../components/PortfolioTab'
import { LendingTab } from '../components/LendingTab'
import { SpotTab } from '../components/SpotTab'
import { KeeperTab } from '../components/KeeperTab'
import { PredictPositionChart } from '../components/chart/PredictPositionChart'
import { CollapsibleNotes } from '../components/shared'
import { ActionHub } from '../components/ActionHub'
import { GuidedTrade } from '../components/GuidedTrade'
import { SurfaceStudio } from '../components/SurfaceStudio'
import { PLPRiskDashboard } from '../components/PLPRiskDashboard'
import { VaultPanel } from '../components/VaultPanel'
import { usePositionOverlays } from '../application/usePositionOverlays'
import { useTour } from '../hooks/useTour'
import { useEventStream } from '../hooks/useEventStream'
import { PREDICT_ID, PREDICT_PACKAGE, PRICE_SCALE, type TabId } from '../domain'
import { getManagersByOwner } from '../data/managerRepository'
import {
  getOraclePrices,
  getOracleState,
  getOracles,
  getServerStatus,
  getVaultSummary,
} from '../data/predictRepository'
import { updatePrice, updateSVI, markSettled } from '../oracleService'
import { fmtAddr, fmtDate, fmtPrice, statusBadge, timeLeft } from '../utils'
import { ADVANCED_TABS, PRIMARY_LABELS, PRIMARY_TABS } from './predictTabs'

let sharedHost: SuiHostAPI | null = null

export function setPredictPluginHost(host: SuiHostAPI | null) {
  sharedHost = host
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PredictPluginRoot() {
  const [tab, setTab] = useState<TabId>('market')
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
  const [managerId, setManagerId] = useState<string | null>(null)
  const [managerIds, setManagerIds] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { startTour: _startTour } = useTour()

  // ── Live event stream (replaces 20s polling with real-time) ────────────────
  const { connected: wsConnected, lag: wsLag } = useEventStream({
    network: 'testnet',
    onPriceUpdate: (oracleId, spot, forward) => {
      updatePrice(oracleId, spot, forward)
      if (oracleId === selectedOracle) {
        setOracleState((prev: any) =>
          prev
            ? {
                ...prev,
                latest_price: {
                  ...prev.latest_price,
                  spot,
                  forward,
                  onchain_timestamp: Date.now(),
                },
              }
            : prev,
        )
        setPrices((prev) => [...prev.slice(-49), { spot, forward, timestamp: Date.now() }])
      }
    },
    onSVIUpdate: (oracleId, svi) => {
      updateSVI(oracleId, svi)
      if (oracleId === selectedOracle) {
        setOracleState((prev: any) =>
          prev
            ? {
                ...prev,
                latest_svi: { ...svi, onchain_timestamp: Date.now() },
              }
            : prev,
        )
      }
    },
    onSettled: (oracleId) => {
      markSettled(oracleId)
      setOracles((prev) =>
        prev.map((o) => (o.oracle_id === oracleId ? { ...o, status: 'settled' } : o)),
      )
    },
  })

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

  // ── Fetch manager ID ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) {
      setManagerId(null)
      setManagerIds([])
      return
    }
    getManagersByOwner(walletAddress)
      .then((mine) => {
        const ids = mine.map((m) => m.manager_id)
        setManagerIds(ids)
        setManagerId(ids[0] ?? null)
      })
      .catch(() => {
        setManagerId(null)
        setManagerIds([])
      })
  }, [walletAddress])

  // ── Data fetching ──────────────────────────────────────────────────────────
  const checkServer = useCallback(async () => {
    setServerStatus(await getServerStatus())
  }, [])

  const fetchOracles = useCallback(async () => {
    const data = await getOracles(PREDICT_ID)
    if (data.length > 0) {
      setOracles(data)
      if (!selectedOracle && data.length > 0) setSelectedOracle(data[0].oracle_id)
    }
  }, [selectedOracle])

  const fetchOracleState = useCallback(async () => {
    if (!selectedOracle) return
    const data = await getOracleState(selectedOracle)
    if (data) setOracleState(data)
  }, [selectedOracle])

  const fetchVault = useCallback(async () => {
    const data = await getVaultSummary(PREDICT_ID)
    if (data) setVaultData(data)
  }, [])

  const fetchPrices = useCallback(async () => {
    if (!selectedOracle) return
    const data = await getOraclePrices(selectedOracle)
    if (data.length > 0) setPrices(data)
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
    // Fallback poll: 60s (WS handles real-time updates)
    pollRef.current = setInterval(refreshAll, 60000)
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
  // (moved to module scope above)

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
          <h3 className="sui-predict__card-title">
            Oracles ({oracles.filter((o) => o.status === 'active').length} active)
          </h3>
          <button
            type="button"
            className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
            onClick={() => setShowAllOracles((v) => !v)}
          >
            {showAllOracles ? 'Active only' : `Show all (${oracles.length})`}
          </button>
        </div>
        <div className="sui-predict__oracle-list">
          {(showAllOracles ? oracles : oracles.filter((o) => o.status === 'active')).map((o) => (
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
  const renderTrade = () => {
    const spot = oracleState?.latest_price?.spot
    const forward = oracleState?.latest_price?.forward
    const spotUsd = spot ? (spot / PRICE_SCALE).toFixed(2) : '—'
    const forwardUsd = forward ? (forward / PRICE_SCALE).toFixed(2) : '—'
    const spread = spot && forward ? (((forward - spot) / spot) * 100).toFixed(3) : '—'
    const expiry = oracleState?.oracle?.expiry
    const svi = oracleState?.latest_svi
    const lastUpdate = oracleState?.latest_price?.onchain_timestamp
    const oracleLag = lastUpdate ? (Date.now() - lastUpdate) / 1000 : 999
    const killSwitch = oracleLag > 30

    return (
      <div className="sui-predict__grid">
        {/* Kill Switch Warning */}
        {killSwitch && (
          <div
            className="sui-predict__error"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '16px' }}>⚠</span>
            <span>
              Oracle feed stale ({oracleLag.toFixed(0)}s). Trading disabled — prices may be
              outdated.
            </span>
          </div>
        )}

        {/* Oracle Health */}
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Oracle Health</h3>
            <span
              className={`sui-predict__badge ${oracleLag < 5 ? 'sui-predict__badge--green' : oracleLag < 30 ? 'sui-predict__badge--yellow' : 'sui-predict__badge--red'}`}
            >
              {oracleLag < 5 ? 'HEALTHY' : oracleLag < 30 ? 'DELAYED' : 'STALE'}
            </span>
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Price Lag</span>
              <span
                className={`sui-predict__stat-value ${oracleLag > 5 ? 'sui-predict__stat-value--red' : 'sui-predict__stat-value--green'}`}
              >
                {oracleLag.toFixed(1)}s
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">SVI Age</span>
              <span
                className={`sui-predict__stat-value ${svi && (Date.now() - svi.onchain_timestamp) / 1000 > 10 ? 'sui-predict__stat-value--red' : 'sui-predict__stat-value--green'}`}
              >
                {svi ? `${((Date.now() - svi.onchain_timestamp) / 1000).toFixed(1)}s` : '—'}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Feed</span>
              <span
                className={`sui-predict__stat-value ${wsConnected ? 'sui-predict__stat-value--green' : ''}`}
              >
                {wsConnected ? 'WebSocket' : 'Polling'}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Kill Switch</span>
              <span
                className={`sui-predict__badge ${killSwitch ? 'sui-predict__badge--red' : 'sui-predict__badge--green'}`}
              >
                {killSwitch ? 'TRIGGERED' : 'OK'}
              </span>
            </div>
          </div>
        </div>

        {/* Active Oracles — selectable for trading */}
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Active Oracles</h3>
            <span className="sui-predict__stat-value--mono" style={{ fontSize: '10px' }}>
              {new Date().toLocaleString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short',
              })}
            </span>
          </div>
          <div className="sui-predict__oracle-list" style={{ maxHeight: '160px' }}>
            {oracles.filter((o) => o.status === 'active' && o.expiry > Date.now()).length === 0 ? (
              <div className="sui-predict__empty">No active oracles</div>
            ) : (
              oracles
                .filter((o) => o.status === 'active' && o.expiry > Date.now())
                .sort((a, b) => a.expiry - b.expiry)
                .map((o) => {
                  const minsLeft = Math.floor((o.expiry - Date.now()) / 60000)
                  const timeStr =
                    minsLeft < 60
                      ? `${minsLeft}m`
                      : `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
                  return (
                    <div
                      key={o.oracle_id}
                      className={`sui-predict__oracle-row ${selectedOracle === o.oracle_id ? 'sui-predict__oracle-row--active' : ''}`}
                      onClick={() => setSelectedOracle(o.oracle_id)}
                    >
                      <div className="sui-predict__oracle-info">
                        <span className="sui-predict__oracle-name">{o.underlying_asset}</span>
                        <span
                          className="sui-predict__oracle-expiry"
                          style={{ fontFamily: 'var(--font-ui-mono)', fontSize: '10px' }}
                        >
                          {o.oracle_id.slice(0, 10)}…{o.oracle_id.slice(-6)}
                        </span>
                      </div>
                      <div className="sui-predict__oracle-meta">
                        <span className="sui-predict__oracle-strike">
                          exp{' '}
                          {new Date(o.expiry).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span
                          className={`sui-predict__badge ${minsLeft < 30 ? 'sui-predict__badge--red' : 'sui-predict__badge--green'}`}
                        >
                          {timeStr}
                        </span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {/* BTC Price Context */}
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">BTC Price Context</h3>
            {lastUpdate && (
              <span className="sui-predict__stat-value--mono">
                Updated: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="sui-predict__stats">
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Spot Price</span>
              <span className="sui-predict__stat-value sui-predict__stat-value--green">
                ${spotUsd}
              </span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Forward Price</span>
              <span className="sui-predict__stat-value">${forwardUsd}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Basis (F−S)</span>
              <span className="sui-predict__stat-value">{spread}%</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Expiry</span>
              <span className="sui-predict__stat-value">{expiry ? fmtDate(expiry) : '—'}</span>
            </div>
            <div className="sui-predict__stat">
              <span className="sui-predict__stat-label">Time Left</span>
              <span className="sui-predict__stat-value">{expiry ? timeLeft(expiry) : '—'}</span>
            </div>
            {svi && (
              <div className="sui-predict__stat">
                <span className="sui-predict__stat-label">ATM Vol (a)</span>
                <span className="sui-predict__stat-value">{((svi.a / 1e6) * 100).toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Price mini-chart */}
        {prices.length > 0 && (
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__card-header">
              <h3 className="sui-predict__card-title">Recent Price ({prices.length} ticks)</h3>
              {prices.length >= 2 &&
                (() => {
                  const first = prices[0].spot / PRICE_SCALE
                  const last = prices[prices.length - 1].spot / PRICE_SCALE
                  const chg = ((last - first) / first) * 100
                  return (
                    <span
                      className={`sui-predict__badge ${chg >= 0 ? 'sui-predict__badge--green' : 'sui-predict__badge--red'}`}
                    >
                      {chg >= 0 ? '+' : ''}
                      {chg.toFixed(3)}%
                    </span>
                  )
                })()}
            </div>
            <div className="sui-predict__price-chart">
              <div className="sui-predict__bars">
                {prices.slice(-30).map((p, i, arr) => {
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
              <div className="sui-predict__price-range">
                <span>
                  ${Math.min(...prices.slice(-30).map((p) => p.spot / PRICE_SCALE)).toFixed(0)}
                </span>
                <span>
                  ${Math.max(...prices.slice(-30).map((p) => p.spot / PRICE_SCALE)).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Trade form */}
        {!isConnected ? (
          <div className="sui-predict__card sui-predict__card--wide">
            <div className="sui-predict__empty">
              <p>Connect wallet to mint/redeem positions</p>
              <button
                type="button"
                className="sui-predict__btn"
                onClick={() => sharedHost?.requestConnect()}
              >
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sui-predict__card sui-predict__card--wide">
              <div className="sui-predict__card-header">
                <h3 className="sui-predict__card-title">Connected</h3>
                <span className="sui-predict__stat-value--mono">
                  {fmtAddr(walletAddress || '')}
                </span>
              </div>
            </div>
            <TradePanel
              oracleState={oracleState}
              oracles={oracles}
              prices={prices}
              selectedOracle={selectedOracle}
              walletAddress={walletAddress!}
              managerIds={managerIds}
              disabled={killSwitch}
            />
          </>
        )}
      </div>
    )
  }

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
            <button
              type="button"
              className="sui-predict__btn"
              onClick={() => sharedHost?.requestConnect()}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <VaultPanel walletAddress={walletAddress!} vaultData={vaultData} host={sharedHost!} />
      )}
    </div>
  )

  // ── Intent routing (Action Hub CTAs) ──────────────────────────────────────
  const [showGuidedTrade, setShowGuidedTrade] = useState(false)

  const handleIntent = (intent: string) => {
    if (intent === 'trade') setShowGuidedTrade(true)
    else if (intent === 'analyze') setTab('surface')
    else if (intent === 'earn') setTab('vault')
    else if (intent === 'claim') setTab('portfolio')
  }

  const handleConnect = () => sharedHost?.requestConnect?.()

  // Oracle health for ActionHub
  const oracleHealth = (() => {
    const ts = oracleState?.latest_price?.onchain_timestamp
    if (!ts) return null
    const lag = (Date.now() - ts) / 1000
    if (lag < 10) return 'HEALTHY' as const
    if (lag < 30) return 'DELAYED' as const
    return 'STALE' as const
  })()

  // Primary/advanced tabs config moved to module scope
  const [showMore, setShowMore] = useState(false)
  const [showAllOracles, setShowAllOracles] = useState(false)
  const isAdvanced = ADVANCED_TABS.some((t) => t.id === tab)

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="sui-predict">
      <ActionHub
        spot={oracleState?.latest_price?.spot ?? null}
        forward={oracleState?.latest_price?.forward ?? null}
        oracleExpiry={oracles.find((o) => o.oracle_id === selectedOracle)?.expiry ?? null}
        oracleHealth={oracleHealth}
        isConnected={isConnected}
        dusdcBalance={null}
        claimableCount={0}
        onIntent={handleIntent}
        onConnect={handleConnect}
      />
      <div className="sui-predict__tabs">
        {PRIMARY_TABS.map((t) => (
          <button
            type="button"
            key={t}
            className={`sui-predict__tab ${tab === t ? 'sui-predict__tab--active' : ''}`}
            onClick={() => {
              setTab(t)
              setShowMore(false)
            }}
          >
            {PRIMARY_LABELS[t]}
          </button>
        ))}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`sui-predict__tab-more ${isAdvanced ? 'sui-predict__tab--active' : ''}`}
            onClick={() => setShowMore((v) => !v)}
          >
            {isAdvanced ? ADVANCED_TABS.find((t) => t.id === tab)?.label : 'More ▾'}
          </button>
          {showMore && (
            <div className="sui-predict__tab-dropdown">
              {ADVANCED_TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => {
                    setTab(t.id)
                    setShowMore(false)
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span
          className={`sui-predict__badge ${wsConnected ? 'sui-predict__badge--green' : 'sui-predict__badge--yellow'}`}
          style={{ marginLeft: 'auto', fontSize: '9px' }}
          title={wsLag != null ? `Last event: ${wsLag.toFixed(1)}s ago` : 'Connecting…'}
        >
          {wsConnected ? '● LIVE' : '○ POLL'}
        </span>
        <button
          type="button"
          className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
          onClick={refreshAll}
          disabled={loading}
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>
      {error && <div className="sui-predict__error">{error}</div>}
      {showGuidedTrade && (
        <GuidedTrade
          sharedHost={sharedHost}
          walletAddress={walletAddress}
          isConnected={isConnected}
          onClose={() => {
            setShowGuidedTrade(false)
            setTab('portfolio')
          }}
        />
      )}
      {!showGuidedTrade && tab === 'market' && renderMarket()}
      {!showGuidedTrade && tab === 'portfolio' && (
        <PortfolioTab
          oracleState={oracleState}
          oracles={oracles}
          walletAddress={walletAddress}
          isConnected={isConnected}
          sharedHost={sharedHost}
          managerId={managerId}
          managerIds={managerIds}
        />
      )}
      {!showGuidedTrade && tab === 'surface' && (
        <SurfaceStudio oracleId={selectedOracle} oracles={oracles} />
      )}
      {!showGuidedTrade && tab === 'risk' && <PLPRiskDashboard />}
      {!showGuidedTrade && tab === 'strategy' && (
        <StrategyTab oracleState={oracleState} oracles={oracles} selectedOracle={selectedOracle} />
      )}
      {!showGuidedTrade && tab === 'arb' && (
        <ArbTab oracleState={oracleState} oracles={oracles} selectedOracle={selectedOracle} />
      )}
      {!showGuidedTrade && tab === 'plphedge' && (
        <PLPHedgeTab oracleState={oracleState} vaultData={vaultData} />
      )}
      {!showGuidedTrade && tab === 'loop' && (
        <MarginLoopTab
          oracleState={oracleState}
          sharedHost={sharedHost}
          walletAddress={walletAddress}
          isConnected={isConnected}
          selectedOracle={selectedOracle}
        />
      )}
      {!showGuidedTrade && tab === 'trade' && renderTrade()}
      {!showGuidedTrade && tab === 'vault' && renderVault()}
      {!showGuidedTrade && tab === 'lending' && (
        <LendingTab
          walletAddress={walletAddress}
          isConnected={isConnected}
          sharedHost={sharedHost}
          network="testnet"
        />
      )}
      {!showGuidedTrade && tab === 'spot' && (
        <SpotTab
          walletAddress={walletAddress}
          isConnected={isConnected}
          sharedHost={sharedHost}
          network="testnet"
        />
      )}
      {!showGuidedTrade && tab === 'keeper' && (
        <KeeperTab
          oracles={oracles}
          walletAddress={walletAddress}
          isConnected={isConnected}
          sharedHost={sharedHost}
        />
      )}
    </div>
  )
}

// ── Surface Studio ─────────────────────────────────────────────────────────────

// ── Trade Panel (Mint/Redeem Binary + Range) ────────────────────────────────────

function TradePanel({
  oracleState,
  oracles: _oracles,
  prices,
  selectedOracle,
  walletAddress,
  managerIds,
  disabled,
}: {
  oracleState: any
  oracles: any[]
  prices: any[]
  selectedOracle: string | null
  walletAddress: string
  managerIds: string[]
  disabled?: boolean
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
  const [managerId, setManagerId] = useState<string | null>(null)
  const [overlayRefreshKey, setOverlayRefreshKey] = useState(0)

  const spotPrice = oracleState?.latest_price?.spot
    ? (oracleState.latest_price.spot / PRICE_SCALE).toFixed(0)
    : ''
  const effectiveManagerIds = managerIds.length > 0 ? managerIds : managerId ? [managerId] : []
  const {
    overlays,
    loading: overlaysLoading,
    error: overlaysError,
    refresh: refreshOverlays,
  } = usePositionOverlays(effectiveManagerIds, selectedOracle, overlayRefreshKey)

  const handleSubmit = async () => {
    if (!sharedHost || !selectedOracle || !amount) return
    setSubmitting(true)
    setTxError(null)
    setTxDigest(null)

    try {
      // Ensure user has a PredictManager
      let mgr = managerId
      if (!mgr) {
        const txMgr = buildCreateManager(walletAddress)
        await sharedHost.signAndExecuteTransaction(txMgr)
        await new Promise((r) => setTimeout(r, 2500))

        try {
          const mine = (await getManagersByOwner(walletAddress)).at(0)
          if (mine) {
            mgr = mine.manager_id
            setManagerId(mgr)
          }
        } catch {
          /* fallback */
        }

        if (!mgr) {
          setTxError('Manager created but not found by indexer. Please try again in a few seconds.')
          setSubmitting(false)
          return
        }
      }

      const tx = await buildTradeTx({
        walletAddress,
        managerId: mgr,
        oracleId: selectedOracle,
        expiry: oracleState?.oracle?.expiry || 0,
        minStrike: oracleState?.oracle?.min_strike || 50000000000000,
        tickSize: oracleState?.oracle?.tick_size || 1000000000,
        action,
        mode,
        amount: Number(amount),
        strike: Number(strike),
        isUp,
        lowerStrike: Number(lowerStrike),
        upperStrike: Number(upperStrike),
      })

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
      sharedHost.setSharedData('txRefresh', Date.now())
      setOverlayRefreshKey((value) => value + 1)
      refreshOverlays()
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
              type="button"
              className={`sui-predict__toggle-btn ${mode === 'binary' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setMode('binary')}
            >
              Binary
            </button>
            <button
              type="button"
              className={`sui-predict__toggle-btn ${mode === 'range' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setMode('range')}
            >
              Range
            </button>
          </div>
          <div className="sui-predict__toggle">
            <button
              type="button"
              className={`sui-predict__toggle-btn ${action === 'mint' ? 'sui-predict__toggle-btn--active' : ''}`}
              onClick={() => setAction('mint')}
            >
              Mint
            </button>
            <button
              type="button"
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

        <PredictPositionChart
          prices={prices}
          spotRaw={oracleState?.latest_price?.spot || 0}
          mode={mode}
          selectedStrike={strike ? Number(strike) : null}
          selectedLower={lowerStrike ? Number(lowerStrike) : null}
          selectedUpper={upperStrike ? Number(upperStrike) : null}
          overlays={overlays}
          overlaysLoading={overlaysLoading}
          overlaysError={overlaysError}
          onBinarySelect={(nextStrike, nextIsUp) => {
            setMode('binary')
            setStrike(String(nextStrike))
            setIsUp(nextIsUp)
          }}
          onRangeSelect={(nextLower, nextUpper) => {
            setMode('range')
            setLowerStrike(String(nextLower))
            setUpperStrike(String(nextUpper))
          }}
        />

        {/* Inputs */}
        <div className="sui-predict__form">
          {mode === 'binary' ? (
            <>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">
                  Strike Price — Spot: ${spotPrice}
                </label>
                {/* Quick strike buttons relative to spot */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  {[-2000, -1000, -500, 0, 500, 1000, 2000].map((offset) => {
                    const val = Number(spotPrice) + offset
                    if (val < 50000) return null
                    const label = offset === 0 ? 'ATM' : `${offset > 0 ? '+' : ''}$${offset}`
                    return (
                      <button
                        type="button"
                        key={offset}
                        className={`sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm ${strike === String(val) ? 'sui-predict__toggle-btn--active' : ''}`}
                        onClick={() => setStrike(String(val))}
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <input
                  className="sui-predict__input"
                  type="number"
                  placeholder={spotPrice || '75000'}
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  step="1"
                  min="50000"
                />
                {strike && spotPrice && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#9fb9b1',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {Number(strike) > Number(spotPrice)
                      ? `+$${(Number(strike) - Number(spotPrice)).toLocaleString()} above spot (OTM call)`
                      : Number(strike) < Number(spotPrice)
                        ? `-$${(Number(spotPrice) - Number(strike)).toLocaleString()} below spot (OTM put)`
                        : 'At-the-money'}
                  </span>
                )}
              </div>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Direction</label>
                <div className="sui-predict__toggle">
                  <button
                    type="button"
                    className={`sui-predict__toggle-btn ${isUp ? 'sui-predict__toggle-btn--green' : ''}`}
                    onClick={() => setIsUp(true)}
                  >
                    ▲ UP — wins if BTC &gt; ${strike || spotPrice}
                  </button>
                  <button
                    type="button"
                    className={`sui-predict__toggle-btn ${!isUp ? 'sui-predict__toggle-btn--red' : ''}`}
                    onClick={() => setIsUp(false)}
                  >
                    ▼ DOWN — wins if BTC &lt; ${strike || spotPrice}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sui-predict__field">
                <label className="sui-predict__field-label">Range around spot (${spotPrice})</label>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  {[500, 1000, 2000, 5000].map((width) => (
                    <button
                      type="button"
                      key={width}
                      className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
                      onClick={() => {
                        const s = Number(spotPrice)
                        setLowerStrike(String(Math.max(50000, s - width)))
                        setUpperStrike(String(s + width))
                      }}
                      style={{ fontSize: '10px', padding: '4px 8px' }}
                    >
                      ±${width.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
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
          {/* PnL Estimate */}
          {amount &&
            Number(amount) > 0 &&
            oracleState?.latest_svi &&
            oracleState?.latest_price?.forward &&
            strike &&
            mode === 'binary' &&
            (() => {
              const sviData = oracleState.latest_svi
              const a = sviData.a / 1e6,
                b = sviData.b / 1e6
              const rho = ((sviData.rho_negative ? -1 : 1) * sviData.rho) / 1e9
              const m_val = ((sviData.m_negative ? -1 : 1) * sviData.m) / 1e6
              const sigma = sviData.sigma / 1e6
              const F = oracleState.latest_price.forward / PRICE_SCALE
              const K = Number(strike)
              const T = Math.max(
                (oracleState.oracle?.expiry - Date.now()) / (365.25 * 24 * 3600 * 1000),
                1 / 365,
              )
              const k = Math.log(K / F)
              const diff = k - m_val
              const w = a + b * (rho * diff + Math.sqrt(diff * diff + sigma * sigma))
              if (w <= 0) return null
              const sqrtW = Math.sqrt(w / T)
              const d2 = -k / sqrtW - sqrtW / 2
              // Normal CDF approximation
              const x = Math.abs(d2) / Math.SQRT2
              const t = 1.0 / (1.0 + 0.3275911 * x)
              const y =
                1.0 -
                ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
                  0.254829592) *
                  t *
                  Math.exp(-x * x)
              const pUp = 0.5 * (1.0 + (d2 < 0 ? -1 : 1) * y)
              const fairValue = isUp ? pUp : 1 - pUp
              const qty = Number(amount)
              const estCost = fairValue * qty
              const maxWin = qty - estCost
              const maxLoss = estCost
              return (
                <div className="sui-predict__stats" style={{ marginTop: '8px' }}>
                  <div className="sui-predict__stat">
                    <span className="sui-predict__stat-label">Win Prob</span>
                    <span className="sui-predict__stat-value">{(fairValue * 100).toFixed(1)}%</span>
                  </div>
                  <div className="sui-predict__stat">
                    <span className="sui-predict__stat-label">Est. Cost</span>
                    <span className="sui-predict__stat-value">${estCost.toFixed(2)}</span>
                  </div>
                  <div className="sui-predict__stat">
                    <span className="sui-predict__stat-label">If Win</span>
                    <span className="sui-predict__stat-value sui-predict__stat-value--green">
                      +${maxWin.toFixed(2)}
                    </span>
                  </div>
                  <div className="sui-predict__stat">
                    <span className="sui-predict__stat-label">If Lose</span>
                    <span className="sui-predict__stat-value sui-predict__stat-value--red">
                      -${maxLoss.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })()}
          <button
            type="button"
            className="sui-predict__btn sui-predict__btn--full"
            onClick={handleSubmit}
            disabled={submitting || !amount || !selectedOracle || disabled}
          >
            {disabled
              ? '⚠ Oracle Stale — Trading Disabled'
              : submitting
                ? 'Submitting…'
                : `${action === 'mint' ? 'Mint' : 'Redeem'} ${mode === 'binary' ? 'Position' : 'Range'}`}
          </button>
        </div>

        {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
        {txError && <div className="sui-predict__error">{txError}</div>}
      </div>

      {/* Info — collapsible */}
      <CollapsibleNotes title="Position Types">
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
      </CollapsibleNotes>
    </>
  )
}

// ── Vault Panel (Supply/Withdraw) ───────────────────────────────────────────────
