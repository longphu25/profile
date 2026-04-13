// SUI DeepBook Orderbook Plugin
// Full-featured live orderbook with depth chart and auto-refresh
// Uses DeepBook Indexer /orderbook/:pool and /summary endpoints

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import './style.css'

const INDEXER = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

interface PoolMeta {
  pool_name: string
}

interface OrderBookData {
  timestamp: string
  bids: [string, string][]
  asks: [string, string][]
}

interface Level {
  price: number
  size: number
  total: number
}

let sharedHost: SuiHostAPI | null = null

function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

function formatSize(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  if (v < 0.01 && v > 0) return v.toFixed(6)
  return v.toFixed(4)
}

/** Parse raw orderbook into Level[] with cumulative totals */
function parseLevels(raw: [string, string][]): Level[] {
  let total = 0
  return raw.map(([p, s]) => {
    const size = Number(s)
    total += size
    return { price: Number(p), size, total }
  })
}

const DEPTH_OPTIONS = [10, 20, 50] as const
const REFRESH_MS = [0, 3000, 5000, 10000] as const

function OrderbookContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [pools, setPools] = useState<string[]>([])
  const [pool, setPool] = useState('SUI_USDC')
  const [depth, setDepth] = useState<(typeof DEPTH_OPTIONS)[number]>(20)
  const [refreshInterval, setRefreshInterval] = useState<number>(5000)
  const [bids, setBids] = useState<Level[]>([])
  const [asks, setAsks] = useState<Level[]>([])
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const base = INDEXER[network]

  // Fetch pool list
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

  // Fetch orderbook
  const fetchBook = useCallback(async () => {
    if (!pool) return
    setError(null)
    try {
      const res = await fetch(`${base}/orderbook/${pool}?level=2&depth=${depth * 2}`)
      if (!res.ok) throw new Error(`API: ${res.status}`)
      const data: OrderBookData = await res.json()
      setBids(parseLevels(data.bids))
      setAsks(parseLevels(data.asks))
      setTimestamp(data.timestamp)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [base, pool, depth])

  // Initial + auto-refresh
  useEffect(() => {
    setLoading(true)
    fetchBook()
    if (timerRef.current) clearInterval(timerRef.current)
    if (refreshInterval > 0) {
      timerRef.current = setInterval(fetchBook, refreshInterval)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchBook, refreshInterval])

  // Sync network from host
  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
    })
  }, [])

  const bestBid = bids[0]?.price ?? 0
  const bestAsk = asks[0]?.price ?? 0
  const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk
  const spreadAbs = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0
  const spreadPct = bestAsk > 0 ? (spreadAbs / bestAsk) * 100 : 0

  // Depth chart data: bids reversed (high→low) + asks (low→high)
  const maxTotal = Math.max(bids[bids.length - 1]?.total ?? 0, asks[asks.length - 1]?.total ?? 0, 1)
  const depthBars = [
    ...bids
      .slice(0, depth)
      .reverse()
      .map((l) => ({ side: 'bid' as const, pct: (l.total / maxTotal) * 100 })),
    ...asks.slice(0, depth).map((l) => ({ side: 'ask' as const, pct: (l.total / maxTotal) * 100 })),
  ]

  return (
    <div className="sui-ob">
      <div className="sui-ob__header">
        <div className="sui-ob__title-row">
          <h3 className="sui-ob__title">Orderbook</h3>
          <button className="sui-ob__refresh" onClick={fetchBook} disabled={loading}>
            {loading ? '⏳' : '↻'}
          </button>
        </div>
        <p className="sui-ob__desc">Live Level 2 orderbook from DeepBook v3</p>
      </div>

      {/* Controls */}
      <div className="sui-ob__controls">
        <select className="sui-ob__select" value={pool} onChange={(e) => setPool(e.target.value)}>
          {pools.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="sui-ob__select"
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value) as typeof depth)}
        >
          {DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} levels
            </option>
          ))}
        </select>
        <select
          className="sui-ob__select"
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
        >
          {REFRESH_MS.map((ms) => (
            <option key={ms} value={ms}>
              {ms === 0 ? 'Manual' : `${ms / 1000}s`}
            </option>
          ))}
        </select>
        {refreshInterval > 0 && (
          <span className="sui-ob__auto-label">
            <span className="sui-ob__pulse" />
            Live
          </span>
        )}
      </div>

      {error && (
        <div className="sui-ob__error">
          {error}
          <button className="sui-ob__retry" onClick={fetchBook}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="sui-ob__loading">Loading orderbook...</div>}

      {!loading && !error && (
        <>
          {/* Mid price + spread */}
          <div className="sui-ob__price-banner">
            <div className="sui-ob__mid-price">{formatPrice(midPrice)}</div>
            <div className="sui-ob__spread">
              Spread: <span className="sui-ob__spread-val">{formatPrice(spreadAbs)}</span> (
              {spreadPct.toFixed(3)}%)
            </div>
          </div>

          {/* Depth chart */}
          {depthBars.length > 0 && (
            <div className="sui-ob__depth">
              <div className="sui-ob__depth-title">Cumulative Depth</div>
              <div className="sui-ob__depth-chart">
                {depthBars.map((bar, i) => (
                  <div
                    key={i}
                    className={`sui-ob__depth-bar sui-ob__depth-bar--${bar.side}`}
                    style={{ height: `${Math.max(bar.pct, 2)}%` }}
                  />
                ))}
              </div>
              <div className="sui-ob__depth-labels">
                <span>{formatPrice(bids[Math.min(depth - 1, bids.length - 1)]?.price ?? 0)}</span>
                <span>{formatPrice(midPrice)}</span>
                <span>{formatPrice(asks[Math.min(depth - 1, asks.length - 1)]?.price ?? 0)}</span>
              </div>
            </div>
          )}

          {/* Orderbook levels */}
          <div className="sui-ob__book">
            <div className="sui-ob__side">
              <div className="sui-ob__side-label">Bids ({bids.length})</div>
              {bids.slice(0, depth).map((l, i) => (
                <div key={i} className="sui-ob__level sui-ob__level--bid">
                  <div
                    className="sui-ob__level-bar"
                    style={{ width: `${(l.total / maxTotal) * 100}%` }}
                  />
                  <span className="sui-ob__level-price">{formatPrice(l.price)}</span>
                  <span className="sui-ob__level-size">{formatSize(l.size)}</span>
                  <span className="sui-ob__level-total">{formatSize(l.total)}</span>
                </div>
              ))}
              {bids.length === 0 && <div className="sui-ob__loading">No bids</div>}
            </div>
            <div className="sui-ob__side">
              <div className="sui-ob__side-label">Asks ({asks.length})</div>
              {asks.slice(0, depth).map((l, i) => (
                <div key={i} className="sui-ob__level sui-ob__level--ask">
                  <div
                    className="sui-ob__level-bar"
                    style={{ width: `${(l.total / maxTotal) * 100}%` }}
                  />
                  <span className="sui-ob__level-price">{formatPrice(l.price)}</span>
                  <span className="sui-ob__level-size">{formatSize(l.size)}</span>
                  <span className="sui-ob__level-total">{formatSize(l.total)}</span>
                </div>
              ))}
              {asks.length === 0 && <div className="sui-ob__loading">No asks</div>}
            </div>
          </div>

          {timestamp && (
            <div className="sui-ob__footer">
              Updated: {new Date(Number(timestamp)).toLocaleTimeString()}
              {' · '}
              <a
                href="https://docs.sui.io/standards/deepbookv3-indexer"
                target="_blank"
                rel="noopener noreferrer"
                className="sui-ob__link"
              >
                DeepBook v3 Indexer
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const SuiDeepBookOrderbookPlugin: Plugin = {
  name: 'SuiDeepBookOrderbook',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-orderbook/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiDeepBookOrderbook', OrderbookContent)
    host.log('SuiDeepBookOrderbook initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiDeepBookOrderbook] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookOrderbook] unmounted')
  },
}

export default SuiDeepBookOrderbookPlugin
