// SUI Lending Pools Plugin
// Lists all active lending pools from Scallop protocol on Sui
// Uses Scallop Indexer API directly for lightweight browser usage

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import './style.css'

// --- Scallop Indexer API ---
const SCALLOP_API = 'https://sdk.api.scallop.io'

interface PoolData {
  coinName: string
  symbol: string
  coinPrice: number
  supplyApr: number
  supplyApy: number
  borrowApr: number
  borrowApy: number
  supplyCoin: number
  borrowCoin: number
  utilizationRate: number
  coinDecimal: number
  isIsolated: boolean
  maxSupplyCoin: number
  maxBorrowCoin: number
  conversionRate: number
}

interface CollateralData {
  coinName: string
  symbol: string
  coinPrice: number
  collateralFactor: number
  liquidationFactor: number
  liquidationPenalty: number
  depositCoin: number
  maxDepositCoin: number
  coinDecimal: number
  isIsolated: boolean
}

type SortKey = 'supplyApy' | 'borrowApy' | 'supplyCoin' | 'borrowCoin' | 'utilizationRate'
type SortDir = 'asc' | 'desc'

// Store reference to SuiHostAPI if available
let sharedHost: SuiHostAPI | null = null

function formatNumber(value: number, decimals = 2): string {
  if (value === 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`
  return value.toFixed(decimals)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function LendingContent() {
  const [pools, setPools] = useState<PoolData[]>([])
  const [collaterals, setCollaterals] = useState<CollateralData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'supply' | 'borrow' | 'collateral'>('supply')
  const [sortKey, setSortKey] = useState<SortKey>('supplyApy')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')

  const fetchMarket = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${SCALLOP_API}/api/market/migrate`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()

      const poolList: PoolData[] = (data.pools ?? []).map((p: Record<string, unknown>) => ({
        coinName: p.coinName ?? '',
        symbol: p.symbol ?? p.coinName ?? '',
        coinPrice: p.coinPrice ?? 0,
        supplyApr: p.supplyApr ?? 0,
        supplyApy: p.supplyApy ?? 0,
        borrowApr: p.borrowApr ?? 0,
        borrowApy: p.borrowApy ?? 0,
        supplyCoin: p.supplyCoin ?? 0,
        borrowCoin: p.borrowCoin ?? 0,
        utilizationRate: p.utilizationRate ?? 0,
        coinDecimal: p.coinDecimal ?? 9,
        isIsolated: p.isIsolated ?? false,
        maxSupplyCoin: p.maxSupplyCoin ?? 0,
        maxBorrowCoin: p.maxBorrowCoin ?? 0,
        conversionRate: p.conversionRate ?? 1,
      }))

      const collateralList: CollateralData[] = (data.collaterals ?? []).map(
        (c: Record<string, unknown>) => ({
          coinName: c.coinName ?? '',
          symbol: c.symbol ?? c.coinName ?? '',
          coinPrice: c.coinPrice ?? 0,
          collateralFactor: c.collateralFactor ?? 0,
          liquidationFactor: c.liquidationFactor ?? 0,
          liquidationPenalty: c.liquidationPenalty ?? 0,
          depositCoin: c.depositCoin ?? 0,
          maxDepositCoin: c.maxDepositCoin ?? 0,
          coinDecimal: c.coinDecimal ?? 9,
          isIsolated: c.isIsolated ?? false,
        }),
      )

      setPools(poolList)
      setCollaterals(collateralList)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMarket()
  }, [fetchMarket])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'desc' ? ' ↓' : ' ↑'
  }

  const filteredPools = pools
    .filter(
      (p) =>
        p.symbol.toLowerCase().includes(search.toLowerCase()) ||
        p.coinName.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1
      return (a[sortKey] - b[sortKey]) * mul
    })

  const filteredCollaterals = collaterals.filter(
    (c) =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.coinName.toLowerCase().includes(search.toLowerCase()),
  )

  const totalSupplyUsd = pools.reduce((sum, p) => sum + p.supplyCoin * p.coinPrice, 0)
  const totalBorrowUsd = pools.reduce((sum, p) => sum + p.borrowCoin * p.coinPrice, 0)

  return (
    <div className="sui-lending">
      <div className="sui-lending__header">
        <div className="sui-lending__title-row">
          <h3 className="sui-lending__title">Scallop Lending Pools</h3>
          <button
            className="sui-lending__refresh"
            onClick={fetchMarket}
            disabled={loading}
            title="Refresh data"
          >
            {loading ? '⏳' : '↻'}
          </button>
        </div>
        <p className="sui-lending__desc">Live lending market data from Scallop protocol on Sui</p>
      </div>

      {/* Stats summary */}
      {!loading && !error && (
        <div className="sui-lending__stats">
          <div className="sui-lending__stat">
            <span className="sui-lending__stat-label">Total Supply</span>
            <span className="sui-lending__stat-value">{formatUsd(totalSupplyUsd)}</span>
          </div>
          <div className="sui-lending__stat">
            <span className="sui-lending__stat-label">Total Borrow</span>
            <span className="sui-lending__stat-value">{formatUsd(totalBorrowUsd)}</span>
          </div>
          <div className="sui-lending__stat">
            <span className="sui-lending__stat-label">Pools</span>
            <span className="sui-lending__stat-value">{pools.length}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="sui-lending__tabs">
        <button
          className={`sui-lending__tab ${tab === 'supply' ? 'sui-lending__tab--active' : ''}`}
          onClick={() => {
            setTab('supply')
            setSortKey('supplyApy')
            setSortDir('desc')
          }}
        >
          Supply
        </button>
        <button
          className={`sui-lending__tab ${tab === 'borrow' ? 'sui-lending__tab--active' : ''}`}
          onClick={() => {
            setTab('borrow')
            setSortKey('borrowApy')
            setSortDir('desc')
          }}
        >
          Borrow
        </button>
        <button
          className={`sui-lending__tab ${tab === 'collateral' ? 'sui-lending__tab--active' : ''}`}
          onClick={() => setTab('collateral')}
        >
          Collateral
        </button>
      </div>

      {/* Search */}
      <input
        className="sui-lending__search"
        type="text"
        placeholder="Search by token name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Error */}
      {error && (
        <div className="sui-lending__error">
          {error}
          <button className="sui-lending__retry" onClick={fetchMarket}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="sui-lending__loading">Loading lending pools...</div>}

      {/* Supply tab */}
      {!loading && !error && tab === 'supply' && (
        <div className="sui-lending__table-wrap">
          <table className="sui-lending__table">
            <thead>
              <tr>
                <th className="sui-lending__th">Asset</th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('supplyApy')}
                >
                  Supply APY{sortIndicator('supplyApy')}
                </th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('supplyCoin')}
                >
                  Total Supply{sortIndicator('supplyCoin')}
                </th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('utilizationRate')}
                >
                  Utilization{sortIndicator('utilizationRate')}
                </th>
                <th className="sui-lending__th sui-lending__th--right">Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredPools.map((pool) => (
                <tr key={pool.coinName} className="sui-lending__row">
                  <td className="sui-lending__td">
                    <div className="sui-lending__asset">
                      <span className="sui-lending__symbol">{pool.symbol}</span>
                      {pool.isIsolated && (
                        <span className="sui-lending__badge sui-lending__badge--isolated">
                          Isolated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="sui-lending__td sui-lending__td--right sui-lending__td--green">
                    {formatPercent(pool.supplyApy)}
                  </td>
                  <td className="sui-lending__td sui-lending__td--right">
                    <div>{formatNumber(pool.supplyCoin)}</div>
                    <div className="sui-lending__sub">
                      {formatUsd(pool.supplyCoin * pool.coinPrice)}
                    </div>
                  </td>
                  <td className="sui-lending__td sui-lending__td--right">
                    <div className="sui-lending__util-bar">
                      <div
                        className="sui-lending__util-fill"
                        style={{ width: `${Math.min(pool.utilizationRate * 100, 100)}%` }}
                      />
                    </div>
                    <span className="sui-lending__sub">{formatPercent(pool.utilizationRate)}</span>
                  </td>
                  <td className="sui-lending__td sui-lending__td--right sui-lending__td--muted">
                    {formatUsd(pool.coinPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPools.length === 0 && <div className="sui-lending__empty">No pools found</div>}
        </div>
      )}

      {/* Borrow tab */}
      {!loading && !error && tab === 'borrow' && (
        <div className="sui-lending__table-wrap">
          <table className="sui-lending__table">
            <thead>
              <tr>
                <th className="sui-lending__th">Asset</th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('borrowApy')}
                >
                  Borrow APY{sortIndicator('borrowApy')}
                </th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('borrowCoin')}
                >
                  Total Borrow{sortIndicator('borrowCoin')}
                </th>
                <th
                  className="sui-lending__th sui-lending__th--right sui-lending__th--sort"
                  onClick={() => handleSort('utilizationRate')}
                >
                  Utilization{sortIndicator('utilizationRate')}
                </th>
                <th className="sui-lending__th sui-lending__th--right">Available</th>
              </tr>
            </thead>
            <tbody>
              {filteredPools.map((pool) => {
                const available = pool.supplyCoin - pool.borrowCoin
                return (
                  <tr key={pool.coinName} className="sui-lending__row">
                    <td className="sui-lending__td">
                      <div className="sui-lending__asset">
                        <span className="sui-lending__symbol">{pool.symbol}</span>
                        {pool.isIsolated && (
                          <span className="sui-lending__badge sui-lending__badge--isolated">
                            Isolated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="sui-lending__td sui-lending__td--right sui-lending__td--orange">
                      {formatPercent(pool.borrowApy)}
                    </td>
                    <td className="sui-lending__td sui-lending__td--right">
                      <div>{formatNumber(pool.borrowCoin)}</div>
                      <div className="sui-lending__sub">
                        {formatUsd(pool.borrowCoin * pool.coinPrice)}
                      </div>
                    </td>
                    <td className="sui-lending__td sui-lending__td--right">
                      <div className="sui-lending__util-bar">
                        <div
                          className="sui-lending__util-fill"
                          style={{ width: `${Math.min(pool.utilizationRate * 100, 100)}%` }}
                        />
                      </div>
                      <span className="sui-lending__sub">
                        {formatPercent(pool.utilizationRate)}
                      </span>
                    </td>
                    <td className="sui-lending__td sui-lending__td--right">
                      <div>{formatNumber(available > 0 ? available : 0)}</div>
                      <div className="sui-lending__sub">
                        {formatUsd(Math.max(available, 0) * pool.coinPrice)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredPools.length === 0 && <div className="sui-lending__empty">No pools found</div>}
        </div>
      )}

      {/* Collateral tab */}
      {!loading && !error && tab === 'collateral' && (
        <div className="sui-lending__table-wrap">
          <table className="sui-lending__table">
            <thead>
              <tr>
                <th className="sui-lending__th">Asset</th>
                <th className="sui-lending__th sui-lending__th--right">LTV</th>
                <th className="sui-lending__th sui-lending__th--right">Liq. Threshold</th>
                <th className="sui-lending__th sui-lending__th--right">Liq. Penalty</th>
                <th className="sui-lending__th sui-lending__th--right">Deposited</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollaterals.map((col) => (
                <tr key={col.coinName} className="sui-lending__row">
                  <td className="sui-lending__td">
                    <div className="sui-lending__asset">
                      <span className="sui-lending__symbol">{col.symbol}</span>
                      {col.isIsolated && (
                        <span className="sui-lending__badge sui-lending__badge--isolated">
                          Isolated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="sui-lending__td sui-lending__td--right">
                    {formatPercent(col.collateralFactor)}
                  </td>
                  <td className="sui-lending__td sui-lending__td--right">
                    {formatPercent(col.liquidationFactor)}
                  </td>
                  <td className="sui-lending__td sui-lending__td--right sui-lending__td--orange">
                    {formatPercent(col.liquidationPenalty)}
                  </td>
                  <td className="sui-lending__td sui-lending__td--right">
                    <div>{formatNumber(col.depositCoin)}</div>
                    <div className="sui-lending__sub">
                      {formatUsd(col.depositCoin * col.coinPrice)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCollaterals.length === 0 && (
            <div className="sui-lending__empty">No collaterals found</div>
          )}
        </div>
      )}

      <div className="sui-lending__footer">
        Data from{' '}
        <a
          href="https://app.scallop.io"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-lending__link"
        >
          Scallop Protocol
        </a>{' '}
        on Sui
      </div>
    </div>
  )
}

const SuiLendingPlugin: Plugin = {
  name: 'SuiLending',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-lending/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiLending', LendingContent)
    host.log(
      'SuiLending plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[SuiLending] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[SuiLending] unmounted')
  },
}

export default SuiLendingPlugin
