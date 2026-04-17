// SUI NAVI Dashboard Plugin
// Read-only DeFi dashboard powered by NAVI Protocol MCP
// Tabs: Overview, Pools, Portfolio, Swap Quote, Tx Explain

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect } from 'react'
import {
  getProtocolStats,
  getPools,
  getHealthFactor,
  getCoins,
  getAvailableRewards,
  getSwapQuote,
  explainTransaction,
  type Pool,
} from './navi-api'
import './style.css'

let sharedHost: SuiHostAPI | null = null
const WALLET_KEY = 'walletProfile'

type Tab = 'overview' | 'pools' | 'portfolio' | 'swap' | 'tx'

function formatUsd(n: number | undefined) {
  return '$' + (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function formatPct(n: number | undefined) {
  return ((n ?? 0) * 100).toFixed(2) + '%'
}
function formatApy(n: number | undefined) {
  return (n ?? 0).toFixed(2) + '%'
}
function shortenType(t: string) {
  return t.length > 30 ? t.slice(0, 12) + '…' + t.slice(-10) : t
}

function NaviDashboardContent() {
  const [tab, setTab] = useState<Tab>('overview')
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Overview
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProtocolStats>> | null>(null)

  // Pools
  const [pools, setPools] = useState<Pool[]>([])
  const [poolSort, setPoolSort] = useState<'tvl' | 'supplyApy' | 'borrowApy'>('tvl')

  // Portfolio
  const [coins, setCoins] = useState<
    { coinType: string; symbol: string; balance: number; usdValue: number }[]
  >([])
  const [health, setHealth] = useState<{
    healthFactor: number
    totalSupplyUsd: number
    totalBorrowUsd: number
  } | null>(null)
  const [rewards, setRewards] = useState<Record<string, unknown> | null>(null)

  // Swap
  const [fromSymbol, setFromSymbol] = useState('SUI')
  const [toSymbol, setToSymbol] = useState('USDC')
  const [swapAmount, setSwapAmount] = useState('1')
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null)

  // Tx
  const [txDigest, setTxDigest] = useState('')
  const [txExplain, setTxExplain] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string } | null
      setWalletAddr(p?.address ?? null)
    })
  }, [])

  // Auto-load overview
  useEffect(() => {
    if (tab === 'overview' && !stats) loadOverview()
  }, [tab, stats])

  async function loadOverview() {
    setLoading(true)
    setError(null)
    try {
      setStats(await getProtocolStats())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadPools() {
    setLoading(true)
    setError(null)
    try {
      setPools(await getPools())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadPortfolio() {
    if (!walletAddr) return
    setLoading(true)
    setError(null)
    try {
      const [c, h, r] = await Promise.all([
        getCoins(walletAddr),
        getHealthFactor(walletAddr).catch(() => null),
        getAvailableRewards(walletAddr).catch(() => null) as Promise<Record<
          string,
          unknown
        > | null>,
      ])
      setCoins(c)
      setHealth(h)
      setRewards(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSwapQuote() {
    setLoading(true)
    setError(null)
    setQuote(null)
    try {
      setQuote(
        (await getSwapQuote(fromSymbol, toSymbol, Number(swapAmount))) as unknown as Record<
          string,
          unknown
        >,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleExplainTx() {
    if (!txDigest.trim()) return
    setLoading(true)
    setError(null)
    setTxExplain(null)
    try {
      setTxExplain((await explainTransaction(txDigest.trim())) as Record<string, unknown>)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const sortedPools = [...pools].sort((a, b) => {
    if (poolSort === 'tvl') return b.tvl - a.tvl
    if (poolSort === 'supplyApy') return b.supplyApy - a.supplyApy
    return b.borrowApy - a.borrowApy
  })

  return (
    <div className="sui-nv">
      <div className="sui-nv__header">
        <h3 className="sui-nv__title">NAVI Protocol</h3>
        <p className="sui-nv__desc">DeFi dashboard powered by NAVI MCP</p>
      </div>

      <div className="sui-nv__tabs">
        {(['overview', 'pools', 'portfolio', 'swap', 'tx'] as const).map((t) => (
          <button
            key={t}
            className={`sui-nv__tab ${tab === t ? 'sui-nv__tab--active' : ''}`}
            onClick={() => {
              setTab(t)
              setError(null)
              if (t === 'pools' && pools.length === 0) loadPools()
              if (t === 'portfolio' && walletAddr) loadPortfolio()
            }}
          >
            {t === 'overview'
              ? 'Overview'
              : t === 'pools'
                ? 'Pools'
                : t === 'portfolio'
                  ? 'Portfolio'
                  : t === 'swap'
                    ? 'Swap'
                    : 'Tx'}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ─── */}
      {tab === 'overview' && (
        <div className="sui-nv__panel">
          {stats ? (
            <div className="sui-nv__stats">
              <div className="sui-nv__stat">
                <span className="sui-nv__stat-label">TVL</span>
                <span className="sui-nv__stat-val">{formatUsd(stats.tvl)}</span>
              </div>
              <div className="sui-nv__stat">
                <span className="sui-nv__stat-label">Total Borrow</span>
                <span className="sui-nv__stat-val">{formatUsd(stats.totalBorrowUsd)}</span>
              </div>
              <div className="sui-nv__stat">
                <span className="sui-nv__stat-label">Utilization</span>
                <span className="sui-nv__stat-val">{formatPct(stats.averageUtilization)}</span>
              </div>
              <div className="sui-nv__stat">
                <span className="sui-nv__stat-label">Max APY</span>
                <span className="sui-nv__stat-val sui-nv__stat-val--green">
                  {formatApy(stats.maxApy)}
                </span>
              </div>
              <div className="sui-nv__stat">
                <span className="sui-nv__stat-label">Users</span>
                <span className="sui-nv__stat-val">{stats.userAmount.toLocaleString()}</span>
              </div>
            </div>
          ) : loading ? (
            <div className="sui-nv__loading">Loading…</div>
          ) : null}
        </div>
      )}

      {/* ─── POOLS ─── */}
      {tab === 'pools' && (
        <div className="sui-nv__panel">
          <div className="sui-nv__sort-row">
            <span className="sui-nv__sort-label">Sort:</span>
            {(['tvl', 'supplyApy', 'borrowApy'] as const).map((s) => (
              <button
                key={s}
                className={`sui-nv__sort-btn ${poolSort === s ? 'sui-nv__sort-btn--active' : ''}`}
                onClick={() => setPoolSort(s)}
              >
                {s === 'tvl' ? 'TVL' : s === 'supplyApy' ? 'Supply APY' : 'Borrow APY'}
              </button>
            ))}
          </div>
          {loading && <div className="sui-nv__loading">Loading pools…</div>}
          {sortedPools.map((p) => (
            <div key={p.coinType || p.symbol} className="sui-nv__pool">
              <div className="sui-nv__pool-header">
                <span className="sui-nv__pool-symbol">{p.symbol}</span>
                <span className="sui-nv__pool-tvl">{formatUsd(p.tvl)}</span>
              </div>
              <div className="sui-nv__pool-rates">
                <span className="sui-nv__pool-rate sui-nv__pool-rate--green">
                  Supply {formatApy(p.supplyApy)}
                </span>
                <span className="sui-nv__pool-rate sui-nv__pool-rate--red">
                  Borrow {formatApy(p.borrowApy)}
                </span>
                <span className="sui-nv__pool-rate">LTV {formatPct(p.ltv)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── PORTFOLIO ─── */}
      {tab === 'portfolio' && (
        <div className="sui-nv__panel">
          {!walletAddr ? (
            <div className="sui-nv__warn">Connect wallet to view portfolio</div>
          ) : (
            <>
              <button className="sui-nv__btn-sm" onClick={loadPortfolio} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>

              {/* Health Factor */}
              {health && health.healthFactor != null && (
                <div
                  className={`sui-nv__health ${health.healthFactor <= 1.2 ? 'sui-nv__health--danger' : ''}`}
                >
                  <span className="sui-nv__health-label">Health Factor</span>
                  <span className="sui-nv__health-val">
                    {Number(health.healthFactor).toFixed(2)}
                  </span>
                  <div className="sui-nv__health-detail">
                    Supply: {formatUsd(health.totalSupplyUsd)} | Borrow:{' '}
                    {formatUsd(health.totalBorrowUsd)}
                  </div>
                </div>
              )}

              {/* Coins */}
              {coins.length > 0 && (
                <div className="sui-nv__section">
                  <div className="sui-nv__section-title">Wallet Balances</div>
                  {coins
                    .filter((c) => c.usdValue > 0.01)
                    .map((c, i) => (
                      <div key={i} className="sui-nv__coin-row">
                        <span className="sui-nv__coin-symbol">
                          {c.symbol || shortenType(c.coinType)}
                        </span>
                        <span className="sui-nv__coin-bal">
                          {c.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                        <span className="sui-nv__coin-usd">{formatUsd(c.usdValue)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Rewards */}
              {rewards && (
                <div className="sui-nv__section">
                  <div className="sui-nv__section-title">Unclaimed Rewards</div>
                  <pre className="sui-nv__json">{JSON.stringify(rewards, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── SWAP QUOTE ─── */}
      {tab === 'swap' && (
        <div className="sui-nv__panel">
          <div className="sui-nv__panel-title">Swap Quote (read-only)</div>
          <div className="sui-nv__swap-row">
            <input
              className="sui-nv__input sui-nv__input--sm"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              placeholder="Amount"
            />
            <input
              className="sui-nv__input"
              value={fromSymbol}
              onChange={(e) => setFromSymbol(e.target.value)}
              placeholder="From (SUI)"
            />
            <span className="sui-nv__swap-arrow">→</span>
            <input
              className="sui-nv__input"
              value={toSymbol}
              onChange={(e) => setToSymbol(e.target.value)}
              placeholder="To (USDC)"
            />
          </div>
          <button className="sui-nv__btn" onClick={handleSwapQuote} disabled={loading}>
            {loading ? 'Quoting…' : 'Get Quote'}
          </button>
          {quote && <pre className="sui-nv__json">{JSON.stringify(quote, null, 2)}</pre>}
        </div>
      )}

      {/* ─── TX EXPLAIN ─── */}
      {tab === 'tx' && (
        <div className="sui-nv__panel">
          <div className="sui-nv__panel-title">Transaction Explainer</div>
          <div className="sui-nv__row">
            <input
              className="sui-nv__input"
              value={txDigest}
              onChange={(e) => setTxDigest(e.target.value)}
              placeholder="Transaction digest"
            />
            <button className="sui-nv__btn-sm" onClick={handleExplainTx} disabled={loading}>
              {loading ? '…' : 'Explain'}
            </button>
          </div>
          {txExplain && <pre className="sui-nv__json">{JSON.stringify(txExplain, null, 2)}</pre>}
        </div>
      )}

      {error && <div className="sui-nv__error">{error}</div>}

      <div className="sui-nv__footer">
        <span className="sui-nv__badge">NAVI MCP</span>
        <a
          href="https://naviprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-nv__link"
        >
          naviprotocol.io
        </a>
      </div>
    </div>
  )
}

const SuiNaviDashboardPlugin: Plugin = {
  name: 'SuiNaviDashboard',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-navi-dashboard/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiNaviDashboard', NaviDashboardContent)
    host.log('SuiNaviDashboard initialized')
  },
  mount() {
    console.log('[SuiNaviDashboard] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiNaviDashboard] unmounted')
  },
}

export default SuiNaviDashboardPlugin
