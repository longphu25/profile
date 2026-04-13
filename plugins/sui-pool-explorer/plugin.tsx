// SUI DeepBook Pool Explorer Plugin
// Browse all DeepBook v3 pools with live price, volume, and orderbook data
// Uses the public DeepBook Indexer API (no SDK dependency needed)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import './style.css'

// --- DeepBook Indexer API ---
const INDEXER_URLS: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

// --- Types ---
interface PoolInfo {
  pool_id: string
  pool_name: string
  base_asset_id: string
  base_asset_decimals: number
  base_asset_symbol: string
  base_asset_name: string
  quote_asset_id: string
  quote_asset_decimals: number
  quote_asset_symbol: string
  quote_asset_name: string
  min_size: number
  lot_size: number
  tick_size: number
}

interface PoolSummary {
  trading_pairs: string
  base_currency: string
  quote_currency: string
  last_price: number
  lowest_price_24h: number
  highest_price_24h: number
  highest_bid: number
  lowest_ask: number
  base_volume: number
  quote_volume: number
  price_change_percent_24h: number
}

interface TickerEntry {
  last_price: number
  base_volume: number
  quote_volume: number
  isFrozen: number
}

interface OrderBookData {
  timestamp: string
  bids: [string, string][]
  asks: [string, string][]
}

interface MergedPool {
  pool_id: string
  pool_name: string
  base_symbol: string
  quote_symbol: string
  base_decimals: number
  quote_decimals: number
  last_price: number
  price_change_24h: number
  high_24h: number
  low_24h: number
  best_bid: number
  best_ask: number
  base_volume: number
  quote_volume: number
  tick_size: number
  lot_size: number
  min_size: number
  isFrozen: boolean
}

type SortKey = 'quote_volume' | 'last_price' | 'price_change_24h' | 'base_volume'
type SortDir = 'asc' | 'desc'

let sharedHost: SuiHostAPI | null = null

// --- Helpers ---
function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value < 0.01 && value > 0) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

function formatNum(value: number, decimals = 2): string {
  if (value === 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`
  return value.toFixed(decimals)
}

function formatPrice(value: number): string {
  if (value === 0) return '—'
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value >= 1) return value.toFixed(4)
  if (value >= 0.001) return value.toFixed(5)
  return value.toFixed(8)
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function rawToHuman(raw: number, decimals: number): number {
  return raw / 10 ** decimals
}

// --- Component ---
function PoolExplorerContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [pools, setPools] = useState<MergedPool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('quote_volume')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<MergedPool | null>(null)
  const [orderbook, setOrderbook] = useState<OrderBookData | null>(null)
  const [obLoading, setObLoading] = useState(false)

  const base = INDEXER_URLS[network]

  const fetchPools = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelected(null)
    setOrderbook(null)
    try {
      const [poolsRes, summaryRes, tickerRes] = await Promise.all([
        fetch(`${base}/get_pools`),
        fetch(`${base}/summary`),
        fetch(`${base}/ticker`),
      ])
      if (!poolsRes.ok) throw new Error(`Pools API: ${poolsRes.status}`)

      const poolList: PoolInfo[] = await poolsRes.json()
      const summaryList: PoolSummary[] = summaryRes.ok ? await summaryRes.json() : []
      const tickerMap: Record<string, TickerEntry> = tickerRes.ok ? await tickerRes.json() : {}

      const summaryMap = new Map<string, PoolSummary>()
      for (const s of summaryList) summaryMap.set(s.trading_pairs, s)

      const merged: MergedPool[] = poolList.map((p) => {
        const s = summaryMap.get(p.pool_name)
        const t = tickerMap[p.pool_name]
        return {
          pool_id: p.pool_id,
          pool_name: p.pool_name,
          base_symbol: p.base_asset_symbol,
          quote_symbol: p.quote_asset_symbol,
          base_decimals: p.base_asset_decimals,
          quote_decimals: p.quote_asset_decimals,
          last_price: s?.last_price ?? t?.last_price ?? 0,
          price_change_24h: s?.price_change_percent_24h ?? 0,
          high_24h: s?.highest_price_24h ?? 0,
          low_24h: s?.lowest_price_24h ?? 0,
          best_bid: s?.highest_bid ?? 0,
          best_ask: s?.lowest_ask ?? 0,
          base_volume: t?.base_volume ?? s?.base_volume ?? 0,
          quote_volume: t?.quote_volume ?? s?.quote_volume ?? 0,
          tick_size: rawToHuman(p.tick_size, p.quote_asset_decimals),
          lot_size: rawToHuman(p.lot_size, p.base_asset_decimals),
          min_size: rawToHuman(p.min_size, p.base_asset_decimals),
          isFrozen: t?.isFrozen === 1,
        }
      })

      setPools(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    fetchPools()
  }, [fetchPools])

  // Listen to shared network changes
  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') {
        setNetwork(ctx.network)
      }
    })
  }, [])

  const fetchOrderbook = useCallback(
    async (poolName: string) => {
      setObLoading(true)
      setOrderbook(null)
      try {
        const res = await fetch(`${base}/orderbook/${poolName}?level=2&depth=10`)
        if (!res.ok) throw new Error(`Orderbook: ${res.status}`)
        const data: OrderBookData = await res.json()
        setOrderbook(data)
      } catch {
        setOrderbook(null)
      } finally {
        setObLoading(false)
      }
    },
    [base],
  )

  const handleSelect = (pool: MergedPool) => {
    if (selected?.pool_id === pool.pool_id) {
      setSelected(null)
      setOrderbook(null)
    } else {
      setSelected(pool)
      fetchOrderbook(pool.pool_name)
    }
  }

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

  const filtered = pools
    .filter(
      (p) =>
        p.pool_name.toLowerCase().includes(search.toLowerCase()) ||
        p.base_symbol.toLowerCase().includes(search.toLowerCase()) ||
        p.quote_symbol.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1
      return (a[sortKey] - b[sortKey]) * mul
    })

  const activePools = pools.filter((p) => !p.isFrozen).length
  const totalQuoteVol = pools.reduce((s, p) => s + p.quote_volume, 0)

  return (
    <div className="sui-pools">
      <div className="sui-pools__header">
        <div className="sui-pools__title-row">
          <h3 className="sui-pools__title">DeepBook Pools</h3>
          <button
            className="sui-pools__refresh"
            onClick={fetchPools}
            disabled={loading}
            title="Refresh"
          >
            {loading ? '⏳' : '↻'}
          </button>
        </div>
        <p className="sui-pools__desc">Live pool data from DeepBook v3 Indexer on Sui</p>
      </div>

      {/* Network toggle */}
      <div className="sui-pools__network-row">
        {(['mainnet', 'testnet'] as const).map((n) => (
          <button
            key={n}
            className={`sui-pools__network-btn ${network === n ? 'sui-pools__network-btn--active' : ''}`}
            onClick={() => setNetwork(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="sui-pools__stats">
          <div className="sui-pools__stat">
            <span className="sui-pools__stat-label">Pools</span>
            <span className="sui-pools__stat-value">{pools.length}</span>
          </div>
          <div className="sui-pools__stat">
            <span className="sui-pools__stat-label">Active</span>
            <span className="sui-pools__stat-value">{activePools}</span>
          </div>
          <div className="sui-pools__stat">
            <span className="sui-pools__stat-label">24h Volume</span>
            <span className="sui-pools__stat-value">{formatUsd(totalQuoteVol)}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        className="sui-pools__search"
        type="text"
        placeholder="Search by pair or token..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Error */}
      {error && (
        <div className="sui-pools__error">
          {error}
          <button className="sui-pools__retry" onClick={fetchPools}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="sui-pools__loading">Loading pools...</div>}

      {/* Detail panel */}
      {selected && (
        <div className="sui-pools__detail">
          <div className="sui-pools__detail-header">
            <h4 className="sui-pools__detail-title">{selected.pool_name}</h4>
            <button className="sui-pools__detail-close" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <div className="sui-pools__detail-grid">
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Last Price</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.last_price)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Best Bid</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.best_bid)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Best Ask</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.best_ask)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">24h High</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.high_24h)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">24h Low</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.low_24h)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Tick Size</span>
              <span className="sui-pools__detail-value">{formatPrice(selected.tick_size)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Lot Size</span>
              <span className="sui-pools__detail-value">{formatNum(selected.lot_size, 4)}</span>
            </div>
            <div className="sui-pools__detail-item">
              <span className="sui-pools__detail-label">Min Size</span>
              <span className="sui-pools__detail-value">{formatNum(selected.min_size, 4)}</span>
            </div>
          </div>

          {/* Mini orderbook */}
          <div className="sui-pools__orderbook">
            <div className="sui-pools__orderbook-title">
              Order Book {obLoading && '(loading...)'}
            </div>
            {orderbook && (
              <div className="sui-pools__orderbook-grid">
                <div className="sui-pools__orderbook-side">
                  <div className="sui-pools__orderbook-label">Bids</div>
                  {orderbook.bids.slice(0, 5).map(([price, size], i) => (
                    <div key={i} className="sui-pools__orderbook-row sui-pools__orderbook-row--bid">
                      <span className="sui-pools__orderbook-price">{price}</span>
                      <span className="sui-pools__orderbook-size">{size}</span>
                    </div>
                  ))}
                  {orderbook.bids.length === 0 && <div className="sui-pools__sub">No bids</div>}
                </div>
                <div className="sui-pools__orderbook-side">
                  <div className="sui-pools__orderbook-label">Asks</div>
                  {orderbook.asks.slice(0, 5).map(([price, size], i) => (
                    <div key={i} className="sui-pools__orderbook-row sui-pools__orderbook-row--ask">
                      <span className="sui-pools__orderbook-price">{price}</span>
                      <span className="sui-pools__orderbook-size">{size}</span>
                    </div>
                  ))}
                  {orderbook.asks.length === 0 && <div className="sui-pools__sub">No asks</div>}
                </div>
              </div>
            )}
          </div>

          <div className="sui-pools__sub" style={{ marginTop: 10 }}>
            Pool ID: {selected.pool_id.slice(0, 16)}...{selected.pool_id.slice(-8)}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="sui-pools__table-wrap">
          <table className="sui-pools__table">
            <thead>
              <tr>
                <th className="sui-pools__th">Pair</th>
                <th
                  className="sui-pools__th sui-pools__th--right sui-pools__th--sort"
                  onClick={() => handleSort('last_price')}
                >
                  Price{sortIndicator('last_price')}
                </th>
                <th
                  className="sui-pools__th sui-pools__th--right sui-pools__th--sort"
                  onClick={() => handleSort('price_change_24h')}
                >
                  24h %{sortIndicator('price_change_24h')}
                </th>
                <th
                  className="sui-pools__th sui-pools__th--right sui-pools__th--sort"
                  onClick={() => handleSort('quote_volume')}
                >
                  Volume (Quote){sortIndicator('quote_volume')}
                </th>
                <th className="sui-pools__th sui-pools__th--right">Spread</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pool) => {
                const spread =
                  pool.best_ask > 0 && pool.best_bid > 0
                    ? (((pool.best_ask - pool.best_bid) / pool.best_ask) * 100).toFixed(3)
                    : '—'
                return (
                  <tr
                    key={pool.pool_id}
                    className="sui-pools__row"
                    onClick={() => handleSelect(pool)}
                  >
                    <td className="sui-pools__td">
                      <div className="sui-pools__pair">
                        <span className="sui-pools__pair-name">{pool.pool_name}</span>
                        <span
                          className={`sui-pools__badge ${pool.isFrozen ? 'sui-pools__badge--frozen' : 'sui-pools__badge--active'}`}
                        >
                          {pool.isFrozen ? 'Frozen' : 'Active'}
                        </span>
                      </div>
                    </td>
                    <td className="sui-pools__td sui-pools__td--right">
                      {formatPrice(pool.last_price)}
                    </td>
                    <td
                      className={`sui-pools__td sui-pools__td--right ${pool.price_change_24h >= 0 ? 'sui-pools__td--green' : 'sui-pools__td--red'}`}
                    >
                      {formatChange(pool.price_change_24h)}
                    </td>
                    <td className="sui-pools__td sui-pools__td--right">
                      <div>{formatNum(pool.quote_volume)}</div>
                      <div className="sui-pools__sub">{formatNum(pool.base_volume)} base</div>
                    </td>
                    <td className="sui-pools__td sui-pools__td--right sui-pools__td--muted">
                      {spread === '—' ? spread : `${spread}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="sui-pools__empty">No pools found</div>}
        </div>
      )}

      <div className="sui-pools__footer">
        Data from{' '}
        <a
          href="https://docs.sui.io/standards/deepbookv3-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-pools__link"
        >
          DeepBook v3 Indexer
        </a>{' '}
        on Sui
      </div>
    </div>
  )
}

const SuiPoolExplorerPlugin: Plugin = {
  name: 'SuiPoolExplorer',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-pool-explorer/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiPoolExplorer', PoolExplorerContent)
    host.log(
      'SuiPoolExplorer plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[SuiPoolExplorer] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[SuiPoolExplorer] unmounted')
  },
}

export default SuiPoolExplorerPlugin
