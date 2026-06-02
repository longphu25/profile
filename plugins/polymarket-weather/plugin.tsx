// Polymarket Explorer Plugin v3
// Server-side: pagination, sort, volume filter, tag + child tags
// Client-side: text search on current page

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { gammaApi } from '../polymarket-shared/api'
import './style.css'

const API = gammaApi()
let sharedHost: SuiHostAPI | null = null
const PER_PAGE = 20

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
    id: '2',
    label: 'Politics',
    icon: '🏛',
    children: [
      { id: '165', label: 'US', icon: '🇺🇸' },
      { id: '100265', label: 'Geopolitics', icon: '🌍' },
      { id: '144', label: 'Elections', icon: '🗳' },
      { id: '102886', label: 'President', icon: '🏛' },
    ],
  },
  {
    id: '1',
    label: 'Sports',
    icon: '⚽',
    children: [
      { id: '745', label: 'NBA', icon: '🏀' },
      { id: '899', label: 'NHL', icon: '🏒' },
      { id: '100350', label: 'Soccer', icon: '⚽' },
      { id: '102232', label: 'FIFA World Cup', icon: '🏆' },
      { id: '306', label: 'EPL', icon: '🏴' },
      { id: '18', label: 'Awards/MVP', icon: '🏅' },
    ],
  },
  {
    id: '10',
    label: 'Crypto',
    icon: '₿',
    children: [
      { id: '100', label: 'Bitcoin', icon: '₿' },
      { id: '101', label: 'Ethereum', icon: 'Ξ' },
      { id: '1596', label: 'Altcoins', icon: '🪙' },
      { id: '100271', label: 'Regulation', icon: '⚖' },
    ],
  },
  {
    id: '84',
    label: 'Weather',
    icon: '🌤',
    children: [
      { id: '104596', label: 'Temperature', icon: '🌡' },
      { id: '832', label: 'Global Temp', icon: '🌐' },
      { id: '87', label: 'Climate', icon: '🌿' },
    ],
  },
  {
    id: '46',
    label: 'Finance',
    icon: '📈',
    children: [
      { id: '100381', label: 'Fed/Rates', icon: '🏦' },
      { id: '100271', label: 'Regulation', icon: '⚖' },
    ],
  },
  {
    id: '102',
    label: 'Tech',
    icon: '💻',
    children: [
      { id: '74', label: 'Science', icon: '🔬' },
      { id: '100', label: 'AI', icon: '🤖' },
    ],
  },
  {
    id: '596',
    label: 'Culture',
    icon: '🎬',
    children: [{ id: '18', label: 'Awards', icon: '🏆' }],
  },
]

// ─── Volume presets ──────────────────────────────────────────────────────────
interface VolFilter {
  label: string
  min?: number
  max?: number
}

const VOL_FILTERS: VolFilter[] = [
  { label: 'Any' },
  { label: '> \u002410K', min: 10000 },
  { label: '> \u0024100K', min: 100000 },
  { label: '> \u00241M', min: 1000000 },
  { label: '> \u002410M', min: 10000000 },
  { label: '\u002410K–\u0024100K', min: 10000, max: 100000 },
  { label: '\u0024100K–\u00241M', min: 100000, max: 1000000 },
]

type SortKey = 'volume' | 'volume_24hr' | 'liquidity' | 'start_date' | 'competitive'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'volume_24hr', label: '24h Volume' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'competitive', label: 'Competitive' },
  { key: 'start_date', label: 'Newest' },
]

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtVol(v: number): string {
  const d = '\u0024'
  if (v >= 1e6) return d + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return d + (v / 1e3).toFixed(0) + 'K'
  return d + Math.round(v)
}

function pctColor(p: number): string {
  if (p >= 70) return '#3fb950'
  if (p >= 30) return '#d29922'
  return '#8b949e'
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function OutcomeBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="pm-outcome">
      <span className="pm-outcome__label" title={label}>
        {label}
      </span>
      <div className="pm-outcome__track">
        <div
          className="pm-outcome__fill"
          style={{
            width: Math.max(pct, 2) + '%',
            background: pct >= 50 ? '#3fb950' : '#30363d',
          }}
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
      if (markets.length > 1) {
        label = m.question.replace(ev.title, '').replace(/\?/g, '').trim() || m.question
      }
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

// ─── Main component ──────────────────────────────────────────────────────────
function PolymarketWeatherComponent() {
  const [events, setEvents] = useState<PolyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [parentTag, setParentTag] = useState<string>('')
  const [childTag, setChildTag] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('volume')
  const [volIdx, setVolIdx] = useState(0)
  const [search, setSearch] = useState('')

  // Pagination
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const abortRef = useRef<AbortController | null>(null)

  // Active tag = child if selected, else parent
  const activeTagId = childTag || parentTag

  // Find parent node for children display
  const parentNode = TAG_TREE.find((t) => t.id === parentTag)
  const children = parentNode?.children || []

  // Build API URL
  const buildUrl = useCallback(
    (p: number) => {
      const vol = VOL_FILTERS[volIdx]
      let url =
        API +
        '/events?active=true&closed=false' +
        '&limit=' +
        PER_PAGE +
        '&offset=' +
        p * PER_PAGE +
        '&order=' +
        sort +
        '&ascending=false'
      if (activeTagId) url += '&tag_id=' + activeTagId
      if (vol.min != null) url += '&volume_min=' + vol.min
      if (vol.max != null) url += '&volume_max=' + vol.max
      return url
    },
    [activeTagId, sort, volIdx],
  )

  // Fetch
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

  // Re-fetch when filters change
  useEffect(() => {
    fetchPage(page)
  }, [page, fetchPage])

  // Reset page when filters change
  const resetAndFetch = () => {
    setPage(0)
  }

  const handleParentTag = (id: string) => {
    setParentTag(id)
    setChildTag('')
    setSearch('')
    resetAndFetch()
  }

  const handleChildTag = (id: string) => {
    setChildTag((prev) => (prev === id ? '' : id)) // toggle
    setSearch('')
    resetAndFetch()
  }

  const handleSort = (s: SortKey) => {
    setSort(s)
    resetAndFetch()
  }
  const handleVol = (idx: number) => {
    setVolIdx(idx)
    resetAndFetch()
  }

  // Client-side search on current page
  const displayed = search.trim()
    ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : events

  return (
    <div className="pm-root">
      {/* Parent tags */}
      <div className="pm-tags">
        {TAG_TREE.map((t) => (
          <button
            key={t.id}
            className={'pm-tag-btn' + (parentTag === t.id ? ' pm-tag-btn--active' : '')}
            onClick={() => handleParentTag(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Child tags (if parent has children) */}
      {children.length > 0 && (
        <div className="pm-subtags">
          <span className="pm-subtags__label">
            {parentNode!.icon} {parentNode!.label}:
          </span>
          {children.map((c) => (
            <button
              key={c.id}
              className={'pm-subtag-btn' + (childTag === c.id ? ' pm-subtag-btn--active' : '')}
              onClick={() => handleChildTag(c.id)}
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar: search + sort + volume filter */}
      <div className="pm-toolbar">
        <input
          className="pm-search"
          type="text"
          placeholder="Filter this page..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter markets on this page"
        />

        <select
          className="pm-select"
          value={sort}
          onChange={(e) => handleSort(e.target.value as SortKey)}
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="pm-select pm-select--vol"
          value={volIdx}
          onChange={(e) => handleVol(Number(e.target.value))}
          aria-label="Volume filter"
        >
          {VOL_FILTERS.map((v, i) => (
            <option key={i} value={i}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="pm-error">
          <p>{error}</p>
          <button className="pm-retry" onClick={() => fetchPage(page)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="pm-loading">
          <div className="pm-spinner" />
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {displayed.length === 0 ? (
            <div className="pm-empty">
              {search ? 'No match for "' + search + '" on this page.' : 'No markets found.'}
            </div>
          ) : (
            <div className="pm-grid">
              {displayed.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="pm-pagination">
            <button className="pm-page-btn" disabled={page === 0} onClick={() => setPage(0)}>
              ⟨⟨
            </button>
            <button
              className="pm-page-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="pm-page-num">Page {page + 1}</span>
            <button
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

// ─── Plugin export ───────────────────────────────────────────────────────────
const PolymarketWeatherPlugin: Plugin = {
  name: 'PolymarketWeather',
  version: '3.0.0',
  styleUrls: ['/plugins/polymarket-weather/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('PolymarketWeather', PolymarketWeatherComponent)
    host.log('PolymarketWeather v3 initialized')
  },
  mount() {
    console.log('[PolymarketWeather] mounted')
  },
  unmount() {
    sharedHost = null
  },
}

export default PolymarketWeatherPlugin
