// NAVI Advisor Analysis — Real-time pool stats & best yield finder
// Analysis engine runs as pure functions (WASM-portable)
// UI auto-refreshes every 15s via polling

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type AnalysisSnapshot,
  type Pool,
  type Vault,
  type WalletCoin,
  type Opportunity,
  type PoolDelta,
  fetchPools,
  fetchVaults,
  fetchStats,
  fetchWalletCoins,
  fetchScallopPools,
  buildSnapshot,
} from './analysis'
import './style.css'

// ── WASM bridge ──
// Loads Rust WASM for analysis computation, falls back to TS if unavailable

let wasmAnalyze:
  | ((pools: Pool[], vaults: Vault[], prevPools: Pool[], walletCoins: WalletCoin[]) => unknown)
  | null = null
let wasmStatus: 'loading' | 'ready' | 'fallback' = 'loading'
let wasmLoadTimeMs = 0

async function initWasm() {
  try {
    const t0 = performance.now()
    // Dynamic import of wasm-bindgen generated JS — path resolved at runtime
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/sui-navi-analysis/pkg/navi_analysis_wasm.js`
    const wasmMod = (await import(/* @vite-ignore */ pkgUrl)) as {
      default: (input: URL) => Promise<unknown>
      analyze: (
        pools: unknown,
        vaults: unknown,
        prevPools: unknown,
        walletCoins: unknown,
      ) => unknown
    }
    const wasmUrl = new URL(
      `${import.meta.env.BASE_URL}wasm/navi-analysis.wasm`,
      window.location.origin,
    )
    await wasmMod.default(wasmUrl)
    wasmAnalyze = (pools, vaults, prevPools, walletCoins) =>
      wasmMod.analyze(pools, vaults, prevPools, walletCoins)
    wasmLoadTimeMs = performance.now() - t0
    wasmStatus = 'ready'
  } catch (e) {
    console.warn('[NaviAnalysis] WASM load failed, using TS fallback:', e)
    wasmStatus = 'fallback'
  }
}

// Start loading immediately
const wasmReady = initWasm()

let sharedHost: SuiHostAPI | null = null
const WALLET_KEY = 'walletProfile'
const REFRESH_MS = 15_000

type Tab = 'opportunities' | 'pools' | 'deltas' | 'wallet'

function riskColor(r: string) {
  return r === 'low' ? '#4ade80' : r === 'medium' ? '#f0b429' : '#f87171'
}
function deltaColor(v: number) {
  return v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#888'
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%'
}
function fmtUsd(n: number) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

function AnalysisContent() {
  const [tab, setTab] = useState<Tab>('opportunities')
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000)
  const [paused, setPaused] = useState(false)
  const prevPoolsRef = useRef<Pool[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      setWalletAddr((v as { address: string } | null)?.address ?? null)
    })
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await wasmReady // ensure WASM init attempted
      const [pools, vaults, stats, scallopPools] = await Promise.all([
        fetchPools(),
        fetchVaults(),
        fetchStats(),
        fetchScallopPools(),
      ])
      const walletCoins = walletAddr ? await fetchWalletCoins(walletAddr, pools) : []

      let snap: AnalysisSnapshot
      const t0 = performance.now()

      if (wasmAnalyze) {
        // WASM path: computation in Rust (no Scallop in WASM yet — merge after)
        const result = wasmAnalyze(pools, vaults, prevPoolsRef.current, walletCoins) as Omit<
          AnalysisSnapshot,
          'timestamp' | 'pools' | 'vaults' | 'stats' | 'scallopPools'
        >
        snap = { timestamp: Date.now(), pools, vaults, stats, scallopPools, ...result }
      } else {
        // TS fallback
        snap = buildSnapshot(pools, vaults, stats, prevPoolsRef.current, walletCoins, scallopPools)
      }

      const computeMs = performance.now() - t0
      snap._computeMs = computeMs
      snap._engine = wasmStatus === 'ready' ? 'wasm' : 'ts'

      prevPoolsRef.current = pools
      setSnapshot(snap)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setCountdown(REFRESH_MS / 1000)
    }
  }, [walletAddr])

  // Auto-refresh
  useEffect(() => {
    refresh()
    if (timerRef.current) clearInterval(timerRef.current)
    if (!paused) {
      timerRef.current = setInterval(refresh, REFRESH_MS)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [refresh, paused])

  // Countdown
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [paused, snapshot])

  // ── Renderers ──

  function renderOpp(o: Opportunity) {
    return (
      <div key={`${o.type}-${o.name}-${o.rank}`} className="na2__opp">
        <div className="na2__opp-head">
          <span className="na2__opp-rank">#{o.rank}</span>
          <span className="na2__opp-type" data-type={o.type}>
            {o.type}
          </span>
          <span className="na2__opp-name">{o.name}</span>
          <span className="na2__opp-apy" style={{ color: riskColor(o.risk) }}>
            {fmtPct(o.apy)}
          </span>
        </div>
        <div className="na2__opp-detail">{o.detail}</div>
        <div className="na2__opp-meta">
          <span style={{ color: riskColor(o.risk) }}>Risk: {o.risk}</span>
          <span>TVL: {fmtUsd(o.tvl)}</span>
          <span>~${o.estYearlyPer1k.toFixed(0)}/yr per $1K</span>
        </div>
      </div>
    )
  }

  function renderPool(p: Pool) {
    const bar = Math.min(p.utilization * 100, 100)
    return (
      <div key={p.symbol} className="na2__pool">
        <div className="na2__pool-head">
          <span className="na2__pool-sym">{p.symbol}</span>
          <span className="na2__pool-price">
            ${p.price < 0.01 ? p.price.toExponential(2) : p.price.toFixed(2)}
          </span>
        </div>
        <div className="na2__pool-row">
          <span className="na2__pool-label">Supply</span>
          <span className="na2__pool-val" style={{ color: '#4ade80' }}>
            {fmtPct(p.supplyApy)}
          </span>
          <span className="na2__pool-label">Borrow</span>
          <span className="na2__pool-val" style={{ color: '#f0b429' }}>
            {fmtPct(p.borrowApy)}
          </span>
          <span className="na2__pool-label">TVL</span>
          <span className="na2__pool-val">{fmtUsd(p.tvl)}</span>
        </div>
        <div className="na2__pool-util">
          <div className="na2__pool-util-bar" style={{ width: `${bar}%` }} />
          <span className="na2__pool-util-txt">{(p.utilization * 100).toFixed(0)}% util</span>
        </div>
      </div>
    )
  }

  function renderDelta(d: PoolDelta) {
    const arrow = d.changePct > 0 ? '▲' : '▼'
    const fieldLabel =
      d.field === 'supplyApy'
        ? 'Supply APY'
        : d.field === 'borrowApy'
          ? 'Borrow APY'
          : d.field === 'price'
            ? 'Price'
            : 'TVL'
    const fmtVal =
      d.field === 'tvl' ? fmtUsd : d.field === 'price' ? (n: number) => '$' + n.toFixed(4) : fmtPct
    return (
      <div key={`${d.symbol}-${d.field}`} className="na2__delta">
        <span className="na2__delta-sym">{d.symbol}</span>
        <span className="na2__delta-field">{fieldLabel}</span>
        <span className="na2__delta-prev">{fmtVal(d.prev)}</span>
        <span className="na2__delta-arrow" style={{ color: deltaColor(d.changePct) }}>
          {arrow}
        </span>
        <span className="na2__delta-curr" style={{ color: deltaColor(d.changePct) }}>
          {fmtVal(d.curr)}
        </span>
        <span className="na2__delta-pct" style={{ color: deltaColor(d.changePct) }}>
          {d.changePct > 0 ? '+' : ''}
          {d.changePct.toFixed(2)}%
        </span>
      </div>
    )
  }

  const s = snapshot

  return (
    <div className="na2">
      {/* Header */}
      <div className="na2__header">
        <div className="na2__header-left">
          <h3 className="na2__title">NAVI Analysis</h3>
          {s?.stats && (
            <div className="na2__stats-bar">
              <span>TVL {fmtUsd(s.stats.tvl)}</span>
              <span>Users {(s.stats.userAmount ?? 0).toLocaleString()}</span>
              <span>Max APY {fmtPct(s.stats.maxApy)}</span>
            </div>
          )}
        </div>
        <div className="na2__header-right">
          <button
            className="na2__pause"
            onClick={() => setPaused(!paused)}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? '▶' : '⏸'}
          </button>
          <span className="na2__countdown" title="Next refresh">
            {loading ? '⟳' : `${countdown}s`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="na2__tabs">
        {(['opportunities', 'pools', 'deltas', ...(walletAddr ? ['wallet'] : [])] as Tab[]).map(
          (t) => (
            <button
              key={t}
              className={`na2__tab ${tab === t ? 'na2__tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'opportunities'
                ? `Best Yields${s ? ` (${s.opportunities.length})` : ''}`
                : t === 'pools'
                  ? `Pools${s ? ` (${s.pools.length})` : ''}`
                  : t === 'deltas'
                    ? `Changes${s?.deltas.length ? ` (${s.deltas.length})` : ''}`
                    : `My Wallet${s?.walletOpportunities.length ? ` (${s.walletOpportunities.length})` : ''}`}
            </button>
          ),
        )}
      </div>

      {error && <div className="na2__error">{error}</div>}

      {/* Content */}
      <div className="na2__content">
        {tab === 'opportunities' && s && (
          <div className="na2__list">
            {s.opportunities.length === 0 && (
              <div className="na2__empty">No opportunities found</div>
            )}
            {s.opportunities.map(renderOpp)}
          </div>
        )}

        {tab === 'pools' && s && (
          <div className="na2__list">
            {s.topSupply.length > 0 && (
              <>
                <div className="na2__section-title">Top Supply APY</div>
                {s.topSupply.map(renderPool)}
              </>
            )}
            {s.topBorrow.length > 0 && (
              <>
                <div className="na2__section-title">Cheapest Borrow</div>
                {s.topBorrow.map(renderPool)}
              </>
            )}
            {s.topTvl.length > 0 && (
              <>
                <div className="na2__section-title">Highest TVL</div>
                {s.topTvl.map(renderPool)}
              </>
            )}
          </div>
        )}

        {tab === 'deltas' && s && (
          <div className="na2__list">
            {s.deltas.length === 0 && (
              <div className="na2__empty">
                No significant changes yet. Tracking starts after first refresh cycle (
                {REFRESH_MS / 1000}s).
              </div>
            )}
            {s.deltas.map(renderDelta)}
          </div>
        )}

        {tab === 'wallet' && s && (
          <div className="na2__list">
            {!walletAddr && (
              <div className="na2__empty">Connect wallet to see personalized opportunities</div>
            )}
            {walletAddr && s.walletOpportunities.length === 0 && (
              <div className="na2__empty">No idle tokens found that match NAVI pools</div>
            )}
            {s.walletOpportunities.map(renderOpp)}
          </div>
        )}

        {!s && !error && <div className="na2__empty">Loading analysis...</div>}
      </div>

      {/* Footer */}
      <div className="na2__footer">
        <span className="na2__badge">NAVI MCP</span>
        <span
          className={`na2__badge ${s?._engine === 'wasm' ? 'na2__badge--wasm' : 'na2__badge--ts'}`}
        >
          {s?._engine === 'wasm' ? `WASM ${wasmLoadTimeMs.toFixed(0)}ms init` : 'TS fallback'}
        </span>
        {s?._computeMs != null && (
          <span className="na2__badge na2__badge--perf">{s._computeMs.toFixed(1)}ms compute</span>
        )}
        {s && <span className="na2__ts">Updated {new Date(s.timestamp).toLocaleTimeString()}</span>}
      </div>
    </div>
  )
}

const SuiNaviAnalysisPlugin: Plugin = {
  name: 'SuiNaviAnalysis',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-navi-analysis/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiNaviAnalysis', AnalysisContent)
    host.log('SuiNaviAnalysis initialized')
  },
  mount() {
    console.log('[SuiNaviAnalysis] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiNaviAnalysis] unmounted')
  },
}

export default SuiNaviAnalysisPlugin
