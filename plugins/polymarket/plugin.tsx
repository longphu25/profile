// Polymarket Plugin (WASM-powered)
// Combines: Market Explorer + Offline Signing + Auth Tools
// Runs 100% static for signing — market data fetched from Gamma API
//
// Architecture:
//   WASM Module (Rust):
//     ├── EIP-712 order signing (secp256k1 + keccak256)
//     ├── HMAC-SHA256 auth header generation
//     └── Order building logic
//   JS Host:
//     ├── Market explorer (Gamma API — public, has CORS)
//     ├── WASM initialization
//     └── UI / React components

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { gammaApi } from '../polymarket-shared/api'
import './style.css'

let sharedHost: SuiHostAPI | null = null
const API = gammaApi()
const PER_PAGE = 20

// ─── WASM Module ─────────────────────────────────────────────────────────────

type WasmModule = typeof import('./pkg/polymarket_wasm')
let wasmModule: WasmModule | null = null
let wasmReady = false

async function initWasm(): Promise<WasmModule> {
  if (wasmModule && wasmReady) return wasmModule
  const mod = await import('./pkg/polymarket_wasm')
  const wasmUrl = new URL('./pkg/polymarket_wasm_bg.wasm', import.meta.url)
  await mod.default(wasmUrl)
  wasmModule = mod
  wasmReady = true
  return mod
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletData {
  address: string
  privateKey?: string | null
  mode: string
}
interface SignedOutput {
  type: string
  data: unknown
  summary: string
  curl?: string
}
interface Market {
  id: string
  question: string
  slug: string
  outcomes: string
  outcomePrices: string
  volume: string
}
interface PolyEvent {
  id: string
  title: string
  slug: string
  image?: string
  icon?: string
  volume: number
  volume24hr?: number
  liquidity: number
  competitive: number
  new: boolean
  createdAt: string
  markets: Market[]
}

type Tab = 'markets' | 'sign-order' | 'auth' | 'tools'
type SortKey = 'volume' | 'volume_24hr' | 'liquidity' | 'start_date' | 'competitive'

// ─── Tag tree ────────────────────────────────────────────────────────────────
interface TagNode {
  id: string
  label: string
  icon: string
  children?: TagNode[]
}

const TAG_TREE: TagNode[] = [
  { id: '', label: 'All', icon: '🔥' },
  {
    id: 'politics',
    label: 'Politics',
    icon: '🏛',
    children: [
      { id: 'elections', label: 'Elections', icon: '🗳' },
      { id: 'us-politics', label: 'US', icon: '🇺🇸' },
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    icon: '⚽',
    children: [
      { id: 'nba', label: 'NBA', icon: '🏀' },
      { id: 'nfl', label: 'NFL', icon: '🏈' },
      { id: 'soccer', label: 'Soccer', icon: '⚽' },
      { id: 'nhl', label: 'NHL', icon: '🏒' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    icon: '₿',
    children: [
      { id: 'bitcoin', label: 'Bitcoin', icon: '₿' },
      { id: 'ethereum', label: 'Ethereum', icon: 'Ξ' },
    ],
  },
  { id: 'weather', label: 'Weather', icon: '🌤' },
  { id: 'finance', label: 'Finance', icon: '📈' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'pop-culture', label: 'Culture', icon: '🎬' },
]

const VOL_FILTERS = [
  { label: 'Any' },
  { label: '> $10K', min: 10000 },
  { label: '> $100K', min: 100000 },
  { label: '> $1M', min: 1000000 },
  { label: '> $10M', min: 10000000 },
] as Array<{ label: string; min?: number; max?: number }>

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'volume_24hr', label: '24h' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'competitive', label: 'Competitive' },
  { key: 'start_date', label: 'Newest' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtVol(v: number): string {
  const d = '$'
  if (v >= 1e6) return d + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return d + (v / 1e3).toFixed(0) + 'K'
  return d + Math.round(v)
}
function pctColor(p: number): string {
  if (p >= 70) return '#3fb950'
  if (p >= 30) return '#d29922'
  return '#8b949e'
}

// ─── Market Explorer Sub-components ──────────────────────────────────────────

function OutcomeBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="pm-outcome">
      <span className="pm-outcome__label" title={label}>
        {label}
      </span>
      <div className="pm-outcome__track">
        <div
          className="pm-outcome__fill"
          style={{ width: Math.max(pct, 2) + '%', background: pct >= 50 ? '#3fb950' : '#30363d' }}
        />
      </div>
      <span className="pm-outcome__pct" style={{ color: pctColor(pct) }}>
        {pct}%
      </span>
    </div>
  )
}

function EventCard({ ev }: { ev: PolyEvent }) {
  const markets = ev.markets || []
  const top = [...markets]
    .sort((a, b) => parseFloat(b.volume || '0') - parseFloat(a.volume || '0'))
    .slice(0, 2)
  const outcomes = top.map((m) => {
    try {
      const names: string[] = JSON.parse(m.outcomes || '[]')
      const prices: string[] = JSON.parse(m.outcomePrices || '[]')
      const yesIdx = names.indexOf('Yes')
      const pct = yesIdx >= 0 ? Math.round(parseFloat(prices[yesIdx]) * 100) : 0
      let label = names[0] || '-'
      if (markets.length > 1)
        label = m.question.replace(ev.title, '').replace(/\?/g, '').trim() || m.question
      return { label, pct }
    } catch {
      return { label: '-', pct: 0 }
    }
  })
  const imgSrc = ev.icon || ev.image || ''
  const handleClick = () => {
    if (sharedHost) sharedHost.setSharedData('polymarket:selectedEvent', ev.slug)
    else window.open('https://polymarket.com/event/' + ev.slug, '_blank')
  }
  return (
    <article
      className="pm-card"
      onClick={handleClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="pm-card__head">
        {imgSrc && <img className="pm-card__icon" src={imgSrc} alt="" loading="lazy" />}
        <h3 className="pm-card__title">{ev.title}</h3>
      </div>
      <div className="pm-card__meta">
        {ev.new && <span className="pm-badge pm-badge--new">NEW</span>}
        <span className="pm-badge pm-badge--vol">{fmtVol(ev.volume)} Vol</span>
        {ev.volume24hr != null && ev.volume24hr > 0 && (
          <span className="pm-badge pm-badge--24h">{fmtVol(ev.volume24hr)} 24h</span>
        )}
      </div>
      <div className="pm-card__outcomes">
        {outcomes.map((o, i) => (
          <OutcomeBar key={i} label={o.label} pct={o.pct} />
        ))}
      </div>
      <a
        className="pm-card__link"
        href={'https://polymarket.com/event/' + ev.slug}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        Trade on Polymarket ↗
      </a>
    </article>
  )
}

// ─── Markets Tab ─────────────────────────────────────────────────────────────

function MarketsPanel() {
  const [events, setEvents] = useState<PolyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parentTag, setParentTag] = useState('')
  const [childTag, setChildTag] = useState('')
  const [sort, setSort] = useState<SortKey>('volume')
  const [volIdx, setVolIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const activeTagId = childTag || parentTag
  const parentNode = TAG_TREE.find((t) => t.id === parentTag)
  const children = parentNode?.children || []

  const buildUrl = useCallback(
    (p: number) => {
      const vol = VOL_FILTERS[volIdx]
      let url =
        API +
        '/events?active=true&closed=false&limit=' +
        PER_PAGE +
        '&offset=' +
        p * PER_PAGE +
        '&order=' +
        sort +
        '&ascending=false'
      if (activeTagId) url += '&tag_slug=' + activeTagId
      if (vol.min != null) url += '&volume_min=' + vol.min
      if (vol.max != null) url += '&volume_max=' + vol.max
      return url
    },
    [activeTagId, sort, volIdx],
  )

  const fetchPage = useCallback(
    async (p: number) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(buildUrl(p), { signal: ctrl.signal })
        if (!res.ok) throw new Error('API ' + res.status)
        const data: PolyEvent[] = await res.json()
        setEvents(data)
        setHasMore(data.length === PER_PAGE)
      } catch (e: any) {
        if (e.name !== 'AbortError') setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    },
    [buildUrl],
  )

  useEffect(() => {
    fetchPage(page)
  }, [page, fetchPage])

  const reset = () => setPage(0)
  const handleParentTag = (id: string) => {
    setParentTag(id)
    setChildTag('')
    setSearch('')
    reset()
  }
  const handleChildTag = (id: string) => {
    setChildTag((prev) => (prev === id ? '' : id))
    setSearch('')
    reset()
  }

  const displayed = search.trim()
    ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : events

  return (
    <div className="pm-root">
      <div className="pm-tags">
        {TAG_TREE.map((t) => (
          <button
            type="button"
            key={t.id}
            className={'pm-tag-btn' + (parentTag === t.id ? ' pm-tag-btn--active' : '')}
            onClick={() => handleParentTag(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      {children.length > 0 && (
        <div className="pm-subtags">
          <span className="pm-subtags__label">
            {parentNode!.icon} {parentNode!.label}:
          </span>
          {children.map((c) => (
            <button
              type="button"
              key={c.id}
              className={'pm-subtag-btn' + (childTag === c.id ? ' pm-subtag-btn--active' : '')}
              onClick={() => handleChildTag(c.id)}
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="pm-toolbar">
        <input
          className="pm-search"
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="pm-select"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey)
            reset()
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="pm-select"
          value={volIdx}
          onChange={(e) => {
            setVolIdx(Number(e.target.value))
            reset()
          }}
        >
          {VOL_FILTERS.map((v, i) => (
            <option key={i} value={i}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="pm-error">
          <p>{error}</p>
          <button type="button" className="pm-retry" onClick={() => fetchPage(page)}>
            Retry
          </button>
        </div>
      )}
      {loading && (
        <div className="pm-loading">
          <div className="pm-spinner" />
        </div>
      )}
      {!loading && !error && (
        <>
          {displayed.length === 0 ? (
            <div className="pm-empty">{search ? 'No match' : 'No markets found.'}</div>
          ) : (
            <div className="pm-grid">
              {displayed.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          )}
          <div className="pm-pagination">
            <button
              type="button"
              className="pm-page-btn"
              disabled={page === 0}
              onClick={() => setPage(0)}
            >
              ⟨⟨
            </button>
            <button
              type="button"
              className="pm-page-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="pm-page-num">Page {page + 1}</span>
            <button
              type="button"
              className="pm-page-btn"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

function PolymarketTradingComponent() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [wasmStatus, setWasmStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [wasmInfo, setWasmInfo] = useState('')
  const [tab, setTab] = useState<Tab>('markets')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [output, setOutput] = useState<SignedOutput | null>(null)

  // Order form
  const [tokenId, setTokenId] = useState('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [price, setPrice] = useState('0.50')
  const [size, setSize] = useState('10')
  const [tickSize, setTickSize] = useState('0.01')
  const [negRisk, setNegRisk] = useState(false)

  // L2 auth form
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/orders?active=true')
  const [body, setBody] = useState('')

  useEffect(() => {
    const t0 = performance.now()
    initWasm()
      .then(() => {
        setWasmStatus('ready')
        setWasmInfo(`WASM (${Math.round(performance.now() - t0)}ms)`)
      })
      .catch((e) => {
        setWasmStatus('error')
        setWasmInfo(`WASM failed: ${e}`)
      })
  }, [])

  useEffect(() => {
    if (!sharedHost) return
    const init = sharedHost.getSharedData('polymarket:wallet') as WalletData | null
    if (init) setWallet(init)
    return sharedHost.onSharedDataChange('polymarket:wallet', (v) =>
      setWallet(v as WalletData | null),
    )
  }, [])

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  const hasKey = !!wallet?.privateKey

  // Sign Order
  const handleSignOrder = useCallback(async () => {
    setError(null)
    setOutput(null)
    if (!hasKey) {
      setError('Wallet with private key required')
      return
    }
    if (!tokenId.trim()) {
      setError('Token ID required')
      return
    }
    try {
      const wasm = await initWasm()
      const pk = wallet!.privateKey!.replace(/^0x/, '')
      const built = wasm.build_order({
        token_id: tokenId.trim(),
        price: parseFloat(price),
        size: parseFloat(size),
        side,
        tick_size: tickSize,
        neg_risk: negRisk,
      })
      if (!built.valid) throw new Error(built.error || 'Invalid order')
      const signed = wasm.sign_order(built.order, pk)
      if (signed.error) throw new Error(signed.error)
      const curl = `curl -X POST https://clob.polymarket.com/order \\\n  -H "Content-Type: application/json" \\\n  -H "POLY_ADDRESS: ${wallet!.address}" \\\n  -H "POLY_SIGNATURE: <L2_HMAC>" \\\n  -H "POLY_TIMESTAMP: <TS>" \\\n  -H "POLY_API_KEY: <KEY>" \\\n  -H "POLY_PASSPHRASE: <PASS>" \\\n  -d '${JSON.stringify(signed)}'`
      setOutput({ type: 'order', data: signed, summary: built.summary, curl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [wallet, tokenId, price, size, side, tickSize, negRisk, hasKey])

  // L1 Auth
  const handleSignL1 = useCallback(async () => {
    setError(null)
    setOutput(null)
    if (!hasKey) {
      setError('Private key required')
      return
    }
    try {
      const wasm = await initWasm()
      const pk = wallet!.privateKey!.replace(/^0x/, '')
      const ts = Math.floor(Date.now() / 1000).toString()
      const l1 = wasm.sign_l1_auth(pk, ts, '0')
      if (l1.error) throw new Error(l1.error)
      const curl = `# Derive API Key\ncurl -X GET https://clob.polymarket.com/auth/derive-api-key \\\n  -H "POLY_ADDRESS: ${l1.address}" \\\n  -H "POLY_SIGNATURE: ${l1.signature}" \\\n  -H "POLY_TIMESTAMP: ${l1.timestamp}" \\\n  -H "POLY_NONCE: ${l1.nonce}"\n\n# Or Create\ncurl -X POST https://clob.polymarket.com/auth/api-key \\\n  -H "POLY_ADDRESS: ${l1.address}" \\\n  -H "POLY_SIGNATURE: ${l1.signature}" \\\n  -H "POLY_TIMESTAMP: ${l1.timestamp}" \\\n  -H "POLY_NONCE: ${l1.nonce}"`
      setOutput({ type: 'l1', data: l1, summary: `L1 EIP-712 for ${l1.address}`, curl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [wallet, hasKey])

  // L2 Headers
  const handleSignL2 = useCallback(async () => {
    setError(null)
    setOutput(null)
    if (!apiKey.trim() || !secret.trim() || !passphrase.trim()) {
      setError('API Key, Secret, Passphrase required')
      return
    }
    try {
      const wasm = await initWasm()
      const ts = Math.floor(Date.now() / 1000).toString()
      const result = wasm.sign_l2_auth(
        apiKey.trim(),
        secret.trim(),
        passphrase.trim(),
        ts,
        method,
        path,
        body,
        wallet?.address || '',
      )
      if (result.error) throw new Error(result.error)
      const curl = `curl -X ${method} "https://clob.polymarket.com${path}" \\\n  -H "POLY_ADDRESS: ${result.address}" \\\n  -H "POLY_SIGNATURE: ${result.signature}" \\\n  -H "POLY_TIMESTAMP: ${result.timestamp}" \\\n  -H "POLY_API_KEY: ${result.api_key}" \\\n  -H "POLY_PASSPHRASE: ${result.passphrase}"${body ? ` \\\n  -d '${body}'` : ''}`
      setOutput({ type: 'l2', data: result, summary: `L2 HMAC for ${method} ${path}`, curl })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [apiKey, secret, passphrase, method, path, body, wallet])

  return (
    <div className="pmt-root">
      {/* Status */}
      <div className="pmt-status">
        <div className="pmt-status__left">
          <span className={`pmt-dot ${hasKey ? 'pmt-dot--on' : ''}`} />
          <span className="pmt-status__text">
            {hasKey ? `${wallet!.address.slice(0, 6)}...${wallet!.address.slice(-4)}` : 'No key'}
          </span>
        </div>
        <div className="pmt-status__right">
          <span
            className={`pmt-dot ${wasmStatus === 'ready' ? 'pmt-dot--wasm' : wasmStatus === 'error' ? 'pmt-dot--err' : ''}`}
          />
          <span className="pmt-status__text">{wasmInfo || 'Loading...'}</span>
          <span className="pmt-badge-static">OFFLINE SIGNING</span>
        </div>
      </div>

      {error && <div className="pmt-msg pmt-msg--error">{error}</div>}

      {/* Tabs */}
      <div className="pmt-tabs">
        <button
          type="button"
          className={`pmt-tab ${tab === 'markets' ? 'pmt-tab--active' : ''}`}
          onClick={() => {
            setTab('markets')
            setOutput(null)
          }}
        >
          Markets
        </button>
        <button
          type="button"
          className={`pmt-tab ${tab === 'sign-order' ? 'pmt-tab--active' : ''}`}
          onClick={() => {
            setTab('sign-order')
            setOutput(null)
          }}
        >
          Sign Order
        </button>
        <button
          type="button"
          className={`pmt-tab ${tab === 'auth' ? 'pmt-tab--active' : ''}`}
          onClick={() => {
            setTab('auth')
            setOutput(null)
          }}
        >
          Auth
        </button>
        <button
          type="button"
          className={`pmt-tab ${tab === 'tools' ? 'pmt-tab--active' : ''}`}
          onClick={() => {
            setTab('tools')
            setOutput(null)
          }}
        >
          Tools
        </button>
      </div>

      {/* Markets Tab */}
      {tab === 'markets' && <MarketsPanel />}

      {/* Sign Order Tab */}
      {tab === 'sign-order' && (
        <div className="pmt-section">
          <p className="pmt-section__desc">
            Build + EIP-712 sign order locally via WASM. No network calls.
          </p>
          <div className="pmt-trade-form">
            <label className="pmt-label">Token ID</label>
            <input
              className="pmt-input"
              type="text"
              placeholder="Condition token ID"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
            />
            <div className="pmt-trade-row">
              <div className="pmt-trade-col">
                <label className="pmt-label">Side</label>
                <div className="pmt-side-toggle">
                  <button
                    type="button"
                    className={`pmt-side-btn ${side === 'BUY' ? 'pmt-side-btn--buy' : ''}`}
                    onClick={() => setSide('BUY')}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    className={`pmt-side-btn ${side === 'SELL' ? 'pmt-side-btn--sell' : ''}`}
                    onClick={() => setSide('SELL')}
                  >
                    Sell
                  </button>
                </div>
              </div>
              <div className="pmt-trade-col">
                <label className="pmt-label">Price</label>
                <input
                  className="pmt-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="pmt-trade-col">
                <label className="pmt-label">Size ($)</label>
                <input
                  className="pmt-input"
                  type="number"
                  step="1"
                  min="1"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
              </div>
            </div>
            <div className="pmt-trade-row">
              <div className="pmt-trade-col">
                <label className="pmt-label">Tick</label>
                <select
                  className="pmt-select"
                  value={tickSize}
                  onChange={(e) => setTickSize(e.target.value)}
                >
                  <option value="0.01">0.01</option>
                  <option value="0.001">0.001</option>
                </select>
              </div>
              <div className="pmt-trade-col">
                <label className="pmt-label">Neg Risk</label>
                <button
                  type="button"
                  className={`pmt-toggle ${negRisk ? 'pmt-toggle--on' : ''}`}
                  onClick={() => setNegRisk(!negRisk)}
                >
                  {negRisk ? 'Yes' : 'No'}
                </button>
              </div>
              <div className="pmt-trade-col">
                <div className="pmt-trade-summary">
                  <span>
                    Cost: ${(parseFloat(price || '0') * parseFloat(size || '0')).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`pmt-btn pmt-btn--lg ${side === 'BUY' ? 'pmt-btn--buy' : 'pmt-btn--sell'}`}
              onClick={handleSignOrder}
              disabled={wasmStatus !== 'ready' || !hasKey}
            >
              Build &amp; Sign (WASM)
            </button>
          </div>
        </div>
      )}

      {/* Auth Tab */}
      {tab === 'auth' && (
        <div className="pmt-section">
          <div className="pmt-subsection">
            <h4 className="pmt-subsection__title">L1: Derive API Key (EIP-712)</h4>
            <p className="pmt-section__desc">
              Sign auth message → copy curl → run in terminal to get credentials.
            </p>
            <button
              type="button"
              className="pmt-btn pmt-btn--derive"
              onClick={handleSignL1}
              disabled={wasmStatus !== 'ready' || !hasKey}
            >
              Sign L1 Auth
            </button>
          </div>
          <div className="pmt-subsection">
            <h4 className="pmt-subsection__title">L2: HMAC Trading Headers</h4>
            <div className="pmt-form">
              <label className="pmt-label">API Key</label>
              <input
                className="pmt-input"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <label className="pmt-label">Secret</label>
              <input
                className="pmt-input"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
              />
              <label className="pmt-label">Passphrase</label>
              <input
                className="pmt-input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
              />
              <div className="pmt-trade-row">
                <div className="pmt-trade-col">
                  <label className="pmt-label">Method</label>
                  <select
                    className="pmt-select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>DELETE</option>
                  </select>
                </div>
                <div className="pmt-trade-col" style={{ flex: 2 }}>
                  <label className="pmt-label">Path</label>
                  <input
                    className="pmt-input"
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                  />
                </div>
              </div>
              {method === 'POST' && (
                <>
                  <label className="pmt-label">Body</label>
                  <textarea
                    className="pmt-textarea"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </>
              )}
              <button
                type="button"
                className="pmt-btn pmt-btn--primary"
                onClick={handleSignL2}
                disabled={wasmStatus !== 'ready'}
              >
                Generate Headers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div className="pmt-section">
          <p className="pmt-section__desc">WASM crypto utilities — all local.</p>
          <div className="pmt-tools-grid">
            <div className="pmt-tool-card">
              <h4>derive_address</h4>
              <p>ETH address from key</p>
              <button
                type="button"
                className="pmt-btn pmt-btn--sm"
                disabled={!hasKey}
                onClick={async () => {
                  const wasm = await initWasm()
                  const addr = wasm.derive_address(wallet!.privateKey!.replace(/^0x/, ''))
                  setOutput({ type: 'tool', data: { address: addr }, summary: addr })
                }}
              >
                Run
              </button>
            </div>
            <div className="pmt-tool-card">
              <h4>keccak256</h4>
              <p>Hash hex/text</p>
              <button
                type="button"
                className="pmt-btn pmt-btn--sm"
                onClick={async () => {
                  const i = prompt('Input:')
                  if (!i) return
                  const wasm = await initWasm()
                  setOutput({
                    type: 'tool',
                    data: { hash: wasm.keccak256_hex(i) },
                    summary: 'keccak256',
                  })
                }}
              >
                Run
              </button>
            </div>
            <div className="pmt-tool-card">
              <h4>hmac_sha256</h4>
              <p>HMAC with b64 secret</p>
              <button
                type="button"
                className="pmt-btn pmt-btn--sm"
                onClick={async () => {
                  const s = prompt('Secret (b64):')
                  const m = prompt('Message:')
                  if (!s || !m) return
                  const wasm = await initWasm()
                  setOutput({
                    type: 'tool',
                    data: { sig: wasm.hmac_sha256(s, m) },
                    summary: 'hmac_sha256',
                  })
                }}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Output Panel */}
      {output && (
        <div className="pmt-output">
          <div className="pmt-output__header">
            <span className="pmt-output__title">{output.summary}</span>
            <button
              type="button"
              className="pmt-btn pmt-btn--sm"
              onClick={() => copy(JSON.stringify(output.data, null, 2), 'json')}
            >
              {copied === 'json' ? '✓' : 'Copy JSON'}
            </button>
          </div>
          <pre className="pmt-output__json">{JSON.stringify(output.data, null, 2)}</pre>
          {output.curl && (
            <>
              <div className="pmt-output__curl-header">
                <span>curl</span>
                <button
                  type="button"
                  className="pmt-btn pmt-btn--sm"
                  onClick={() => copy(output.curl!, 'curl')}
                >
                  {copied === 'curl' ? '✓' : 'Copy'}
                </button>
              </div>
              <pre className="pmt-output__curl">{output.curl}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Plugin Export ────────────────────────────────────────────────────────────

const PolymarketPlugin: Plugin = {
  name: 'Polymarket',
  version: '3.0.0',
  styleUrls: ['/plugins/polymarket/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('Polymarket', PolymarketTradingComponent)
    host.log('Polymarket plugin v3 (explorer + WASM signing)')
  },
  mount() {
    initWasm().catch(() => {})
  },
  unmount() {
    sharedHost = null
  },
}

export default PolymarketPlugin
