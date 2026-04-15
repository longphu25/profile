// SUI DeepBook Analysis Engine Plugin
// Standalone trend detection + market analysis for any DeepBook pool
// Uses: EMA crossover, RSI, VWAP, orderbook imbalance, momentum, volatility

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import {
  type AnalysisResult,
  type Signal,
  type Candle,
  type OrderbookSnapshot,
  runAnalysis,
  fetchCandles,
  fetchOrderbookSnapshot,
  detectWalls,
} from './analysis'
import './style.css'

let sharedHost: SuiHostAPI | null = null

const SIGNAL_COLORS: Record<Signal, string> = {
  strong_buy: '#22c55e',
  buy: '#4ade80',
  neutral: '#94a3b8',
  sell: '#f87171',
  strong_sell: '#ef4444',
}
const SIGNAL_LABELS: Record<Signal, string> = {
  strong_buy: 'STRONG BUY',
  buy: 'BUY',
  neutral: 'NEUTRAL',
  sell: 'SELL',
  strong_sell: 'STRONG SELL',
}

function AnalysisContent() {
  const [network, setNetwork] = useState<string>('mainnet')
  const [pool, setPoolLocal] = useState('SUI_USDC')

  // Sync pool selection via sharedData
  const setPool = useCallback((p: string) => {
    setPoolLocal(p)
    if (sharedHost) sharedHost.setSharedData('deepbook:selectedPool', p)
  }, [])

  useEffect(() => {
    if (!sharedHost) return
    // Read initial
    const initial = sharedHost.getSharedData('deepbook:selectedPool') as string | undefined
    if (initial) setPoolLocal(initial)
    // Subscribe
    return sharedHost.onSharedDataChange('deepbook:selectedPool', (v) => {
      if (typeof v === 'string' && v !== pool) setPoolLocal(v)
    })
  }, [])
  const [pools, setPools] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [ob, setOb] = useState<OrderbookSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [poolRanking, setPoolRanking] = useState<{ pool: string; price: number; chg: number; spread: number; vol: number; score: number }[]>([])

  // Sync network from host
  useEffect(() => {
    if (!sharedHost) return
    const ctx = sharedHost.getSuiContext()
    if (ctx.network === 'mainnet' || ctx.network === 'testnet') setNetwork(ctx.network)
    return sharedHost.onSuiContextChange((c) => {
      if (c.network === 'mainnet' || c.network === 'testnet') setNetwork(c.network)
    })
  }, [])

  // Fetch pool list
  useEffect(() => {
    const base = network === 'testnet'
      ? 'https://deepbook-indexer.testnet.mystenlabs.com'
      : 'https://deepbook-indexer.mainnet.mystenlabs.com'
    fetch(`${base}/get_pools`)
      .then((r) => r.json())
      .then((data: { pool_name: string }[]) => {
        const names = data.map((p) => p.pool_name).sort()
        setPools(names)
      })
      .catch(() => {})
    // Fetch pool ranking
    fetch(`${base}/summary`)
      .then((r) => r.json())
      .then((data: { trading_pairs: string; last_price: number; price_change_percent_24h: number; quote_volume: number; highest_bid: number; lowest_ask: number }[]) => {
        const rows = data
          .filter((d) => d.last_price > 0 && d.quote_volume > 500 && d.highest_bid > 0 && d.lowest_ask > 0)
          .map((d) => {
            const spread = ((d.lowest_ask - d.highest_bid) / d.last_price) * 100
            const chg = Math.abs(d.price_change_percent_24h)
            const score = (d.quote_volume / 10000) * Math.min(chg || 0.01, 5) / Math.max(spread, 0.001)
            return { pool: d.trading_pairs, price: d.last_price, chg, spread, vol: d.quote_volume, score }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
        setPoolRanking(rows)
        if (sharedHost) sharedHost.setSharedData('deepbook:poolRanking', rows)
      })
      .catch(() => {})
  }, [network])

  // Run analysis
  const runAnalysisFn = useCallback(async () => {
    setLoading(true)
    try {
      const [c, o] = await Promise.all([
        fetchCandles(pool, network, 5, 60),
        fetchOrderbookSnapshot(pool, network, 20),
      ])
      setCandles(c)
      setOb(o)
      const result = await runAnalysis(pool, network)
      setAnalysis(result)
      // Publish to shared context for other plugins
      if (sharedHost) {
        sharedHost.setSharedData('deepbook:analysis', { pool, network, ...result, ts: Date.now() })
        sharedHost.setSharedData('deepbook:orderbook', { pool, ...o, ts: Date.now() })
      }
    } catch {
      /* silent */
    }
    setLoading(false)
  }, [pool, network])

  // Auto-refresh
  useEffect(() => {
    runAnalysisFn()
    if (!autoRefresh) return
    const id = setInterval(runAnalysisFn, 10000)
    return () => clearInterval(id)
  }, [runAnalysisFn, autoRefresh])

  const a = analysis
  const walls = ob ? detectWalls(ob) : { bidWalls: [], askWalls: [] }

  return (
    <div className="sui-da">
      <div className="sui-da__header">
        <h3 className="sui-da__title">DeepBook Analysis Engine</h3>
        <p className="sui-da__desc">Trend detection + market analysis</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <select
          className="sui-da__select"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
          style={{ flex: 1 }}
        >
          {pools.map((p) => (
            <option key={p} value={p}>{p.replace('_', ' / ')}</option>
          ))}
        </select>
        <button
          className={`sui-da__btn sui-da__btn--sm ${autoRefresh ? '' : 'sui-da__btn--ghost'}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <button
          className="sui-da__btn sui-da__btn--ghost sui-da__btn--sm"
          onClick={runAnalysisFn}
          disabled={loading}
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {/* Top 10 Pools */}
      {poolRanking.length > 0 && (
        <div className="sui-da__card">
          <div className="sui-da__card-title">Top 10 Pools — Trading Score</div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>Score = volume × volatility / spread. Click to analyze.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, marginBottom: 8 }}>
            <span><span style={{ color: '#22c55e' }}>●</span> 24h &lt;1% safe</span>
            <span><span style={{ color: '#eab308' }}>●</span> 24h 1-3% moderate</span>
            <span><span style={{ color: '#ef4444' }}>●</span> 24h &gt;3% volatile</span>
            <span style={{ marginLeft: 4 }}><span style={{ color: '#22c55e' }}>■</span> spread &lt;0.05%</span>
            <span><span style={{ color: '#94a3b8' }}>■</span> spread &lt;0.2%</span>
            <span><span style={{ color: '#eab308' }}>■</span> spread &gt;0.2%</span>
            <span style={{ marginLeft: 4 }}>★ top 3</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 600 }}>Pool</th>
                  <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 600 }}>24h %</th>
                  <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 600 }}>Spread</th>
                  <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 600 }}>Volume</th>
                  <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 600 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {poolRanking.map((r, i) => (
                  <tr
                    key={r.pool}
                    style={{
                      borderBottom: '1px solid #0f172a',
                      cursor: 'pointer',
                      background: r.pool === pool ? '#1e293b' : undefined,
                    }}
                    onClick={() => setPool(r.pool)}
                  >
                    <td style={{ padding: '4px', color: '#475569' }}>{i + 1}</td>
                    <td style={{ padding: '4px', color: r.pool === pool ? '#22c55e' : '#f8fafc', fontWeight: r.pool === pool ? 600 : 400 }}>
                      {r.pool.replace('_', '/')}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right', color: r.chg > 3 ? '#ef4444' : r.chg > 1 ? '#eab308' : '#22c55e' }}>
                      {r.chg.toFixed(2)}%
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right', color: r.spread < 0.05 ? '#22c55e' : r.spread < 0.2 ? '#94a3b8' : '#eab308' }}>
                      {r.spread.toFixed(3)}%
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right', color: '#94a3b8', fontFamily: "'Fira Code', monospace" }}>
                      {r.vol >= 1e6 ? `$${(r.vol / 1e6).toFixed(1)}M` : r.vol >= 1e3 ? `$${(r.vol / 1e3).toFixed(0)}K` : `$${r.vol.toFixed(0)}`}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right', fontFamily: "'Fira Code', monospace", color: i < 3 ? '#22c55e' : '#94a3b8' }}>
                      {r.score >= 1000 ? `${(r.score / 1000).toFixed(1)}K` : r.score.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {a ? (
        <>
          {/* Signal */}
          <div
            className="sui-da__signal"
            style={{
              background: `${SIGNAL_COLORS[a.signal]}12`,
              border: `1px solid ${SIGNAL_COLORS[a.signal]}30`,
            }}
          >
            <div className="sui-da__signal-label" style={{ color: SIGNAL_COLORS[a.signal] }}>
              {SIGNAL_LABELS[a.signal]}
            </div>
            <div className="sui-da__signal-conf">Confidence: {a.confidence}%</div>
          </div>

          {/* Allocation */}
          <div className="sui-da__card">
            <div className="sui-da__card-title">Allocation Recommendation</div>
            <div className="sui-da__bar">
              <div className="sui-da__bar--long" style={{ width: `${a.recommendation.longPct}%` }} />
              <div className="sui-da__bar--short" style={{ width: `${a.recommendation.shortPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#22c55e' }}>Long {a.recommendation.longPct}%</span>
              <span style={{ color: '#ef4444' }}>Short {a.recommendation.shortPct}%</span>
            </div>
          </div>

          {/* Market Stats */}
          {ob && (
            <div className="sui-da__grid">
              <div className="sui-da__stat">
                <span className="sui-da__stat-label">Mid Price</span>
                <span className="sui-da__stat-value" style={{ color: '#f8fafc' }}>
                  {ob.midPrice.toFixed(ob.midPrice > 1 ? 4 : 6)}
                </span>
              </div>
              <div className="sui-da__stat">
                <span className="sui-da__stat-label">Spread</span>
                <span className="sui-da__stat-value" style={{ color: ob.spreadPct < 0.1 ? '#22c55e' : '#eab308' }}>
                  {ob.spreadPct.toFixed(3)}%
                </span>
              </div>
              <div className="sui-da__stat">
                <span className="sui-da__stat-label">Bid Walls</span>
                <span className="sui-da__stat-value" style={{ color: '#4da2ff' }}>
                  {walls.bidWalls.length}
                </span>
              </div>
              <div className="sui-da__stat">
                <span className="sui-da__stat-label">Ask Walls</span>
                <span className="sui-da__stat-value" style={{ color: '#a78bfa' }}>
                  {walls.askWalls.length}
                </span>
              </div>
            </div>
          )}

          {/* Indicators */}
          <div className="sui-da__card">
            <div className="sui-da__card-title">Technical Indicators</div>
            {([
              ['EMA Trend (8/21)', a.indicators.ema_trend, -1, 1, 'Positive = uptrend'],
              ['RSI (14)', a.indicators.rsi, 0, 100, '<30 oversold, >70 overbought'],
              ['Orderbook Imbalance', a.indicators.ob_imbalance, -1, 1, 'Positive = buy pressure'],
              ['Momentum (10)', a.indicators.momentum, -1, 1, 'Rate of price change'],
              ['Volatility', a.indicators.volatility, 0, 1, '0 = flat, 1 = volatile'],
              ['VWAP Deviation', a.indicators.vwap_deviation, -2, 2, 'Price vs volume avg'],
            ] as [string, number, number, number, string][]).map(([label, value, min, max, desc]) => {
              const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
              const color =
                label.includes('RSI') ? (value > 70 ? '#ef4444' : value < 30 ? '#22c55e' : '#94a3b8')
                : value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#94a3b8'
              return (
                <div key={label} className="sui-da__indicator">
                  <div className="sui-da__indicator-row">
                    <span className="sui-da__indicator-label">{label}</span>
                    <span className="sui-da__indicator-value">{value.toFixed(3)}</span>
                  </div>
                  <div className="sui-da__indicator-track">
                    <div
                      className="sui-da__indicator-dot"
                      style={{ left: `${pct}%`, background: color }}
                    />
                  </div>
                  <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>

          {/* Price History (mini sparkline) */}
          {candles.length > 0 && (
            <div className="sui-da__card">
              <div className="sui-da__card-title">Price History ({candles.length} candles, 5min)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 40 }}>
                {(() => {
                  const prices = candles.map((c) => c.close)
                  const min = Math.min(...prices)
                  const max = Math.max(...prices)
                  const range = max - min || 1
                  return candles.map((c, i) => {
                    const h = ((c.close - min) / range) * 36 + 4
                    const isUp = i > 0 ? c.close >= candles[i - 1].close : true
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: h,
                          background: isUp ? '#22c55e40' : '#ef444440',
                          borderRadius: 1,
                          minWidth: 2,
                        }}
                      />
                    )
                  })
                })()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginTop: 4 }}>
                <span>{new Date(candles[0].ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>{new Date(candles[candles.length - 1].ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )}

          {/* Orderbook Walls */}
          {(walls.bidWalls.length > 0 || walls.askWalls.length > 0) && (
            <div className="sui-da__card">
              <div className="sui-da__card-title">Detected Walls (3× avg size)</div>
              {walls.bidWalls.map((w, i) => (
                <div key={`b${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#22c55e' }}>
                  <span>BID {w.price.toFixed(6)}</span>
                  <span style={{ fontFamily: "'Fira Code', monospace" }}>{w.size.toFixed(1)}</span>
                </div>
              ))}
              {walls.askWalls.map((w, i) => (
                <div key={`a${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#ef4444' }}>
                  <span>ASK {w.price.toFixed(6)}</span>
                  <span style={{ fontFamily: "'Fira Code', monospace" }}>{w.size.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="sui-da__footer">
            Auto-refresh {autoRefresh ? 'every 10s' : 'paused'} · 5-min candles + live orderbook · {network}
          </div>
        </>
      ) : (
        <div className="sui-da__empty">{loading ? 'Analyzing...' : 'Select a pool to start'}</div>
      )}
    </div>
  )
}

const SuiDeepBookAnalysisPlugin: Plugin = {
  name: 'SuiDeepBookAnalysis',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-analysis/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiDeepBookAnalysis', AnalysisContent)
    host.log('SuiDeepBookAnalysis initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },
  mount() {
    console.log('[SuiDeepBookAnalysis] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookAnalysis] unmounted')
  },
}

export default SuiDeepBookAnalysisPlugin
