// SUI Price Feed Plugin
// Live token prices from DeepBook v3 Indexer with OHLCV sparkline chart
// Uses /summary for prices and /ohclv for candle data

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import './style.css'

const INDEXER_URLS: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

const INTERVALS = ['1h', '4h', '1d', '1w'] as const
type Interval = (typeof INTERVALS)[number]

interface PairSummary {
  trading_pairs: string
  last_price: number
  highest_price_24h: number
  lowest_price_24h: number
  highest_bid: number
  lowest_ask: number
  base_volume: number
  quote_volume: number
  price_change_percent_24h: number
}

type Candle = [number, number, number, number, number, number] // ts, o, h, l, c, vol

let sharedHost: SuiHostAPI | null = null

// --- Helpers ---
function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

function formatVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(2)
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

/** Build a simple ASCII sparkline from close prices */
function sparkline(closes: number[], width = 60): string {
  if (closes.length < 2) return ''
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const blocks = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  // Sample down to width
  const step = Math.max(1, Math.floor(closes.length / width))
  const sampled = closes.filter((_, i) => i % step === 0).slice(0, width)
  return sampled.map((c) => blocks[Math.round(((c - min) / range) * 8)]).join('')
}

// --- Component ---
function PriceFeedContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [pairs, setPairs] = useState<PairSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('SUI_USDC')
  const [interval, setInterval_] = useState<Interval>('1h')
  const [candles, setCandles] = useState<Candle[]>([])
  const [candleLoading, setCandleLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const base = INDEXER_URLS[network]

  const fetchPrices = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${base}/summary`)
      if (!res.ok) throw new Error(`API: ${res.status}`)
      const data: PairSummary[] = await res.json()
      // Sort by quote volume desc, keep only pairs with price
      const sorted = data
        .filter((p) => p.last_price > 0)
        .sort((a, b) => b.quote_volume - a.quote_volume)
      setPairs(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [base])

  const fetchCandles = useCallback(async () => {
    setCandleLoading(true)
    try {
      const res = await fetch(`${base}/ohclv/${selected}?interval=${interval}&limit=60`)
      if (!res.ok) throw new Error(`OHLCV: ${res.status}`)
      const data = await res.json()
      setCandles(data.candles ?? [])
    } catch {
      setCandles([])
    } finally {
      setCandleLoading(false)
    }
  }, [base, selected, interval])

  useEffect(() => {
    fetchPrices()
    // Auto-refresh every 30s
    timerRef.current = setInterval(fetchPrices, 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchPrices])

  useEffect(() => {
    fetchCandles()
  }, [fetchCandles])

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') setNetwork(ctx.network)
    })
  }, [])

  const selectedPair = pairs.find((p) => p.trading_pairs === selected)
  const closes = candles.map((c) => c[4])
  const spark = sparkline(closes)
  const candleHigh = candles.length ? Math.max(...candles.map((c) => c[2])) : 0
  const candleLow = candles.length ? Math.min(...candles.map((c) => c[3])) : 0
  const candleVol = candles.reduce((s, c) => s + c[5], 0)

  return (
    <div className="sui-price">
      <div className="sui-price__header">
        <h3 className="sui-price__title">Price Feed</h3>
        <button
          className="sui-price__refresh"
          onClick={() => {
            fetchPrices()
            fetchCandles()
          }}
          disabled={loading}
        >
          {loading ? '⏳' : '↻'}
        </button>
      </div>

      {error && (
        <div className="sui-price__error">
          {error}
          <button className="sui-price__retry" onClick={fetchPrices}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="sui-price__loading">Loading prices...</div>}

      {/* Price cards */}
      {!loading && !error && (
        <div className="sui-price__grid">
          {pairs.slice(0, 12).map((p) => (
            <div
              key={p.trading_pairs}
              className={`sui-price__card ${selected === p.trading_pairs ? 'sui-price__card--selected' : ''}`}
              onClick={() => setSelected(p.trading_pairs)}
            >
              <div className="sui-price__card-pair">{p.trading_pairs.replace('_', '/')}</div>
              <div className="sui-price__card-price">{formatPrice(p.last_price)}</div>
              <div
                className={`sui-price__card-change ${p.price_change_percent_24h >= 0 ? 'sui-price__card-change--up' : 'sui-price__card-change--down'}`}
              >
                {formatChange(p.price_change_percent_24h)}
              </div>
              <div className="sui-price__card-row">
                <span>Vol: {formatVol(p.quote_volume)}</span>
                <span>Bid: {formatPrice(p.highest_bid)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sparkline chart */}
      {selectedPair && (
        <div className="sui-price__chart">
          <div className="sui-price__chart-header">
            <h4 className="sui-price__chart-title">
              {selected.replace('_', '/')} — {formatPrice(selectedPair.last_price)}
            </h4>
            <div className="sui-price__intervals">
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  className={`sui-price__interval ${interval === iv ? 'sui-price__interval--active' : ''}`}
                  onClick={() => setInterval_(iv)}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>
          {candleLoading ? (
            <div className="sui-price__loading">Loading chart...</div>
          ) : candles.length > 0 ? (
            <>
              <div className="sui-price__sparkline">{spark}</div>
              <div className="sui-price__chart-stats">
                <span>
                  H: <span className="sui-price__chart-stat-val">{formatPrice(candleHigh)}</span>
                </span>
                <span>
                  L: <span className="sui-price__chart-stat-val">{formatPrice(candleLow)}</span>
                </span>
                <span>
                  Vol: <span className="sui-price__chart-stat-val">{formatVol(candleVol)}</span>
                </span>
              </div>
            </>
          ) : (
            <div className="sui-price__loading">No candle data</div>
          )}
        </div>
      )}

      <div className="sui-price__footer">
        Data from{' '}
        <a
          href="https://docs.sui.io/standards/deepbookv3-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-price__link"
        >
          DeepBook v3 Indexer
        </a>
        {' · Auto-refreshes every 30s'}
      </div>
    </div>
  )
}

const SuiPriceFeedPlugin: Plugin = {
  name: 'SuiPriceFeed',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-price-feed/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiPriceFeed', PriceFeedContent)
    host.log('SuiPriceFeed plugin initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiPriceFeed] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiPriceFeed] unmounted')
  },
}

export default SuiPriceFeedPlugin
