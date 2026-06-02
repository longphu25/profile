// Polymarket Event Detail Plugin
// Shows full event info when user clicks a card in the weather plugin
// Reads event slug from shared data: polymarket:selectedEvent

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef } from 'react'
import { gammaApi } from '../polymarket-shared/api'
import './style.css'

const API_BASE = gammaApi()

let sharedHost: SuiHostAPI | null = null

interface Market {
  id: string
  question: string
  slug: string
  outcomes: string
  outcomePrices: string
  volume: string
  liquidity: string
  groupItemTitle?: string
  description: string
  endDate: string
  clobTokenIds?: string
  volume24hr?: number
}

interface EventDetail {
  id: string
  title: string
  slug: string
  description: string
  image?: string
  icon?: string
  volume: number
  volume24hr?: number
  volume1wk?: number
  volume1mo?: number
  liquidity: number
  openInterest?: number
  competitive: number
  startDate: string
  endDate: string
  markets: Market[]
  commentCount?: number
  negRisk?: boolean
}

function fmtVol(v: number): string {
  const d = '\u0024'
  if (v >= 1e6) return d + (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return d + (v / 1e3).toFixed(1) + 'K'
  return d + Math.round(v)
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function pctColor(p: number): string {
  if (p >= 60) return '#3fb950'
  if (p >= 30) return '#d29922'
  return '#8b949e'
}

function MarketRow({ m, index }: { m: Market; index: number }) {
  let outcomes: string[] = []
  let prices: number[] = []
  try {
    outcomes = JSON.parse(m.outcomes || '[]')
    prices = JSON.parse(m.outcomePrices || '[]').map(Number)
  } catch {
    /* empty */
  }

  const label = m.groupItemTitle || m.question

  return (
    <div className="pmd-market">
      <div className="pmd-market__head">
        <span className="pmd-market__idx">{index + 1}</span>
        <span className="pmd-market__label">{label}</span>
        <span className="pmd-market__vol">{fmtVol(parseFloat(m.volume || '0'))}</span>
      </div>
      <div className="pmd-market__bars">
        {outcomes.map((name, i) => {
          const pct = Math.round(prices[i] * 100)
          return (
            <div key={i} className="pmd-bar-row">
              <span className="pmd-bar-row__name">{name}</span>
              <div className="pmd-bar-row__track">
                <div
                  className="pmd-bar-row__fill"
                  style={{
                    width: Math.max(pct, 2) + '%',
                    background: i === 0 ? '#3fb950' : '#f85149',
                  }}
                />
              </div>
              <span
                className="pmd-bar-row__pct"
                style={{ color: i === 0 ? pctColor(pct) : '#f85149' }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PolymarketDetailComponent() {
  const [slug, setSlug] = useState<string | null>(null)
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevSlugRef = useRef<string | null>(null)

  // Listen for event selection from weather plugin
  useEffect(() => {
    if (!sharedHost) return
    // Read initial value
    const initial = sharedHost.getSharedData('polymarket:selectedEvent') as string | undefined
    if (initial) setSlug(initial)

    return sharedHost.onSharedDataChange('polymarket:selectedEvent', (val) => {
      setSlug(val as string)
    })
  }, [])

  // Fetch event detail when slug changes
  useEffect(() => {
    if (!slug || slug === prevSlugRef.current) return
    prevSlugRef.current = slug

    setLoading(true)
    setError(null)
    setEvent(null)

    fetch(API_BASE + '/events/slug/' + slug)
      .then((res) => {
        if (!res.ok) throw new Error('API ' + res.status)
        return res.json()
      })
      .then((data: EventDetail) => {
        setEvent(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
  }, [slug])

  const handleBack = () => {
    if (sharedHost) {
      sharedHost.setSharedData('polymarket:selectedEvent', null)
      sharedHost.setSharedData('polymarket:navigate', 'weather')
    }
  }

  if (!slug) {
    return (
      <div className="pmd-empty">
        <p>Click a market card to view details.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="pmd-loading">
        <div className="pmd-spinner" />
        <p>Loading event details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pmd-error">
        <p>Failed to load event</p>
        <p className="pmd-error__detail">{error}</p>
        <button className="pmd-back" onClick={handleBack}>
          Back to Markets
        </button>
      </div>
    )
  }

  if (!event) return null

  const markets = (event.markets || []).sort(
    (a, b) => parseFloat(b.volume || '0') - parseFloat(a.volume || '0'),
  )

  const polyUrl = 'https://polymarket.com/event/' + event.slug

  return (
    <div className="pmd-root">
      {/* Back button */}
      <button className="pmd-back" onClick={handleBack}>
        ← Back to Markets
      </button>

      {/* Hero */}
      <div className="pmd-hero">
        {event.image && <img className="pmd-hero__img" src={event.image} alt="" />}
        <div className="pmd-hero__info">
          <h2 className="pmd-hero__title">{event.title}</h2>
          <div className="pmd-hero__meta">
            <span className="pmd-tag pmd-tag--vol">{fmtVol(event.volume)} Volume</span>
            <span className="pmd-tag pmd-tag--liq">{fmtVol(event.liquidity)} Liquidity</span>
            {event.openInterest != null && (
              <span className="pmd-tag pmd-tag--oi">
                {fmtVol(event.openInterest)} Open Interest
              </span>
            )}
            <span className="pmd-tag pmd-tag--date">
              {fmtDate(event.startDate)} → {fmtDate(event.endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Volume breakdown */}
      <div className="pmd-stats-row">
        <div className="pmd-stat-box">
          <div className="pmd-stat-box__val">{fmtVol(event.volume24hr || 0)}</div>
          <div className="pmd-stat-box__label">24h Volume</div>
        </div>
        <div className="pmd-stat-box">
          <div className="pmd-stat-box__val">{fmtVol(event.volume1wk || 0)}</div>
          <div className="pmd-stat-box__label">7d Volume</div>
        </div>
        <div className="pmd-stat-box">
          <div className="pmd-stat-box__val">{fmtVol(event.volume1mo || 0)}</div>
          <div className="pmd-stat-box__label">30d Volume</div>
        </div>
        <div className="pmd-stat-box">
          <div className="pmd-stat-box__val">{markets.length}</div>
          <div className="pmd-stat-box__label">Markets</div>
        </div>
      </div>

      {/* Markets list */}
      <div className="pmd-section">
        <h3 className="pmd-section__title">Markets ({markets.length})</h3>
        <div className="pmd-markets">
          {markets.map((m, i) => (
            <MarketRow key={m.id} m={m} index={i} />
          ))}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="pmd-section">
          <h3 className="pmd-section__title">Resolution Details</h3>
          <div className="pmd-desc">{event.description}</div>
        </div>
      )}

      {/* External link */}
      <a className="pmd-ext-link" href={polyUrl} target="_blank" rel="noopener noreferrer">
        View on Polymarket ↗
      </a>
    </div>
  )
}

const PolymarketDetailPlugin: Plugin = {
  name: 'PolymarketDetail',
  version: '1.0.0',
  styleUrls: ['/plugins/polymarket-detail/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('PolymarketDetail', PolymarketDetailComponent)
    host.log('PolymarketDetail plugin initialized')
  },

  mount() {
    console.log('[PolymarketDetail] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[PolymarketDetail] unmounted')
  },
}

export default PolymarketDetailPlugin
