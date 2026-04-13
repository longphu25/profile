// SUI DeepBook History Plugin
// Browse recent trades per pool, filter by balance manager
// Uses /trades/:pool_name and /get_pools endpoints

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import './style.css'

const INDEXER = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

const EXPLORER = {
  mainnet: 'https://suiscan.xyz/mainnet',
  testnet: 'https://suiscan.xyz/testnet',
}

interface PoolMeta {
  pool_name: string
}

interface Trade {
  digest: string
  trade_id: string
  maker_balance_manager_id: string
  taker_balance_manager_id: string
  price: number
  base_volume: number
  quote_volume: number
  timestamp: number
  type: string
  taker_is_bid: boolean
  taker_fee: number
  maker_fee: number
  taker_fee_is_deep: boolean
  maker_fee_is_deep: boolean
}

let sharedHost: SuiHostAPI | null = null

function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  return v.toFixed(6)
}

function formatNum(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  if (v < 0.001 && v > 0) return v.toFixed(6)
  return v.toFixed(4)
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function shortenDigest(d: string): string {
  return `${d.slice(0, 8)}…${d.slice(-6)}`
}

function HistoryContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [pools, setPools] = useState<string[]>([])
  const [pool, setPool] = useState('SUI_USDC')
  const [managerId, setManagerId] = useState('')
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = INDEXER[network]
  const explorer = EXPLORER[network]

  // Fetch pool list for dropdown
  useEffect(() => {
    fetch(`${base}/get_pools`)
      .then((r) => r.json())
      .then((data: PoolMeta[]) => {
        const names = data.map((p) => p.pool_name).sort()
        setPools(names)
        if (names.length > 0 && !names.includes(pool)) setPool(names[0])
      })
      .catch(() => {})
  }, [base])

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let url = `${base}/trades/${pool}?limit=50`
      const trimmed = managerId.trim()
      if (trimmed) {
        url += `&maker_balance_manager_id=${trimmed}&taker_balance_manager_id=${trimmed}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Trades API: ${res.status}`)
      const data: Trade[] = await res.json()
      setTrades(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [base, pool, managerId])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
    })
  }, [])

  const totalBaseVol = trades.reduce((s, t) => s + t.base_volume, 0)
  const totalQuoteVol = trades.reduce((s, t) => s + t.quote_volume, 0)
  const totalFees = trades.reduce((s, t) => s + t.taker_fee + t.maker_fee, 0)

  return (
    <div className="sui-history">
      <div className="sui-history__header">
        <div className="sui-history__title-row">
          <h3 className="sui-history__title">Trade History</h3>
          <button className="sui-history__refresh" onClick={fetchTrades} disabled={loading}>
            {loading ? '⏳' : '↻'}
          </button>
        </div>
        <p className="sui-history__desc">Recent trades on DeepBook v3</p>
      </div>

      {/* Controls */}
      <div className="sui-history__controls">
        <select
          className="sui-history__select"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
        >
          {pools.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          className="sui-history__input"
          type="text"
          placeholder="Filter by balance manager ID (optional)"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchTrades()}
        />
        <button className="sui-history__btn" onClick={fetchTrades} disabled={loading}>
          Search
        </button>
      </div>

      {error && (
        <div className="sui-history__error">
          {error}
          <button className="sui-history__retry" onClick={fetchTrades}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="sui-history__loading">Loading trades...</div>}

      {/* Stats */}
      {!loading && trades.length > 0 && (
        <div className="sui-history__stats">
          <div className="sui-history__stat">
            <span className="sui-history__stat-label">Trades</span>
            <span className="sui-history__stat-value">{trades.length}</span>
          </div>
          <div className="sui-history__stat">
            <span className="sui-history__stat-label">Base Volume</span>
            <span className="sui-history__stat-value">{formatNum(totalBaseVol)}</span>
          </div>
          <div className="sui-history__stat">
            <span className="sui-history__stat-label">Quote Volume</span>
            <span className="sui-history__stat-value">{formatNum(totalQuoteVol)}</span>
          </div>
          <div className="sui-history__stat">
            <span className="sui-history__stat-label">Total Fees</span>
            <span className="sui-history__stat-value">{formatNum(totalFees)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="sui-history__table-wrap">
          <table className="sui-history__table">
            <thead>
              <tr>
                <th className="sui-history__th">Time</th>
                <th className="sui-history__th">Side</th>
                <th className="sui-history__th sui-history__th--right">Price</th>
                <th className="sui-history__th sui-history__th--right">Base Qty</th>
                <th className="sui-history__th sui-history__th--right">Quote Qty</th>
                <th className="sui-history__th sui-history__th--right">Fee</th>
                <th className="sui-history__th">Tx</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.trade_id} className="sui-history__row">
                  <td className="sui-history__td sui-history__td--muted">
                    {formatTime(t.timestamp)}
                  </td>
                  <td className="sui-history__td">
                    <span
                      className={`sui-history__badge ${t.type === 'buy' ? 'sui-history__badge--buy' : 'sui-history__badge--sell'}`}
                    >
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="sui-history__td sui-history__td--right">{formatPrice(t.price)}</td>
                  <td className="sui-history__td sui-history__td--right">
                    {formatNum(t.base_volume)}
                  </td>
                  <td className="sui-history__td sui-history__td--right">
                    {formatNum(t.quote_volume)}
                  </td>
                  <td className="sui-history__td sui-history__td--right sui-history__td--muted">
                    <div>
                      {formatNum(t.taker_fee)}
                      {t.taker_fee_is_deep ? ' DEEP' : ''}
                    </div>
                    <div className="sui-history__sub">
                      {formatNum(t.maker_fee)}
                      {t.maker_fee_is_deep ? ' DEEP' : ''}
                    </div>
                  </td>
                  <td className="sui-history__td">
                    <a
                      className="sui-history__digest-link"
                      href={`${explorer}/tx/${t.digest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shortenDigest(t.digest)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trades.length === 0 && !loading && (
            <div className="sui-history__empty">No trades found</div>
          )}
        </div>
      )}

      <div className="sui-history__footer">
        Data from{' '}
        <a
          href="https://docs.sui.io/standards/deepbookv3-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-history__link"
        >
          DeepBook v3 Indexer
        </a>
      </div>
    </div>
  )
}

const SuiDeepBookHistoryPlugin: Plugin = {
  name: 'SuiDeepBookHistory',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-history/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiDeepBookHistory', HistoryContent)
    host.log('SuiDeepBookHistory initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiDeepBookHistory] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookHistory] unmounted')
  },
}

export default SuiDeepBookHistoryPlugin
