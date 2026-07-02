// BTC Chart — Trade Setup panel (stitch-design-taste cockpit layout).

import { useState, memo } from 'react'
import { fmtP, type TradeSetup } from '../lib'
import { ExplainModal } from './ExplainModal'
import { SideBlock, SideHead, SideBody, SideNote, SideDivider, SideRow } from './sidebar'

interface Props {
  setup: TradeSetup
}

function countConfluenceGroups(reasons: string[]) {
  const mlCount = reasons.filter(
    (r) =>
      (r.startsWith('ML') || r.startsWith('RSI') || r.startsWith('ADX') || r.includes('NWE')) &&
      !r.startsWith('NWE Cross') &&
      !r.startsWith('Price at Lux') &&
      !r.includes('Lux NWE mid'),
  ).length
  const boucherCount = reasons.filter(
    (r) => r.startsWith('Boucher') || r.startsWith('3-Bar') || r.startsWith('Box'),
  ).length
  const lienCount = reasons.filter(
    (r) => r.startsWith('Lien') || r.startsWith('Squeeze') || r.startsWith('Exhaustion'),
  ).length
  const nweCount = reasons.filter(
    (r) => r.startsWith('NWE Cross') || r.startsWith('Price at Lux') || r.includes('Lux NWE mid'),
  ).length
  return { mlCount, boucherCount, lienCount, nweCount }
}

function pctFromEntry(entry: number, price: number): string {
  const pct = ((price - entry) / entry) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function fmtSpotOffset(entry: number, spot: number): string | null {
  if (!spot || spot <= 0 || entry <= 0) return null
  const pct = ((entry - spot) / spot) * 100
  if (Math.abs(pct) < 0.01) return 'At spot'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

interface RiskMapProps {
  sl: number
  entry: number
  tp1: number
  tp2: number
}

function TradeRiskMap({ sl, entry, tp1, tp2 }: RiskMapProps) {
  const min = Math.min(sl, entry, tp1, tp2)
  const max = Math.max(sl, entry, tp1, tp2)
  const span = max - min || 1
  const pos = (v: number) => ((v - min) / span) * 100
  const riskLo = Math.min(sl, entry)
  const riskHi = Math.max(sl, entry)

  return (
    <div className="sb-trade-map" aria-label="Price levels map">
      <div className="sb-trade-map__track">
        <span
          className="sb-trade-map__zone sb-trade-map__zone--risk"
          style={{ left: `${pos(riskLo)}%`, width: `${pos(riskHi) - pos(riskLo)}%` }}
        />
        <span
          className="sb-trade-map__pin sb-trade-map__pin--sl"
          style={{ left: `${pos(sl)}%` }}
          title="SL"
        />
        <span
          className="sb-trade-map__pin sb-trade-map__pin--entry is-active"
          style={{ left: `${pos(entry)}%` }}
          title="Entry"
        />
        <span
          className="sb-trade-map__pin sb-trade-map__pin--tp1"
          style={{ left: `${pos(tp1)}%` }}
          title="TP1"
        />
        <span
          className="sb-trade-map__pin sb-trade-map__pin--tp2"
          style={{ left: `${pos(tp2)}%` }}
          title="TP2"
        />
      </div>
      <div className="sb-trade-map__legend">
        <span>SL</span>
        <span className="is-accent">Entry</span>
        <span>TP1</span>
        <span>TP2</span>
      </div>
    </div>
  )
}

interface LadderRowProps {
  label: string
  price: number
  delta?: string
  tone?: 'up' | 'dn' | 'entry'
  delay?: number
}

function LadderRow({ label, price, delta, tone = '', delay = 0 }: LadderRowProps) {
  return (
    <div
      className={`sb-trade-ladder__row sb-trade-ladder__row--${tone}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="sb-trade-ladder__tag">{label}</span>
      <span className={`sb-trade-ladder__price ${tone}`}>{fmtP(price)}</span>
      {delta && <span className={`sb-trade-ladder__delta ${tone}`}>{delta}</span>}
    </div>
  )
}

export const TradeSetupPanel = memo(function TradeSetupPanel({ setup }: Props) {
  const [capital, setCapital] = useState(10)
  const [leverage, setLeverage] = useState(10)
  const [sizingOpen, setSizingOpen] = useState(true)
  const [explainOpen, setExplainOpen] = useState(false)

  const explainBtn = (
    <button
      type="button"
      className="sb-trade-ghost-btn"
      onClick={(e) => {
        e.stopPropagation()
        setExplainOpen(true)
      }}
      title="Giải thích chỉ báo"
      aria-label="Giải thích chỉ báo"
    >
      Explain
    </button>
  )

  if (!setup.dir) {
    return (
      <SideBlock variant="trade">
        <SideHead title="Trade Setup" subtitle="Awaiting confluence" actions={explainBtn} />
        <div className="sb-trade-empty">
          <div className="sb-trade-empty__skeleton sb-trade-empty__skeleton--hero" />
          <div className="sb-trade-empty__skeleton sb-trade-empty__skeleton--map" />
          <div className="sb-trade-empty__skeleton sb-trade-empty__skeleton--row" />
          <div className="sb-trade-empty__skeleton sb-trade-empty__skeleton--row sb-trade-empty__skeleton--short" />
          <p className="sb-trade-empty__title">No active setup</p>
          <p className="sb-trade-empty__hint">
            Need 2+ aligned signals (ML, NWE, Boucher, Lien) before limit entry, SL, and TP render.
          </p>
        </div>
        {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}
      </SideBlock>
    )
  }

  const isLong = setup.dir === 'long'
  const dirTone = isLong ? 'up' : 'dn'
  const risk = Math.abs(setup.entry - setup.sl)
  const riskPct = ((risk / setup.entry) * 100).toFixed(2)
  const positionSize = capital * leverage
  const qty = positionSize / setup.entry
  const lossAtSL = qty * risk
  const profitAtTP1 = qty * Math.abs(setup.tp1 - setup.entry)
  const rrLabel = setup.rr > 0 ? setup.rr.toFixed(1) : '2.0'
  const spotOffset = fmtSpotOffset(setup.entry, setup.spotPrice)

  const { mlCount, boucherCount, lienCount, nweCount } = countConfluenceGroups(setup.reasons)
  const tags = [
    mlCount > 0 && { label: 'ML/Ind', count: mlCount },
    boucherCount > 0 && { label: 'Boucher', count: boucherCount },
    lienCount > 0 && { label: 'Lien', count: lienCount },
    nweCount > 0 && { label: 'NWE', count: nweCount },
  ].filter(Boolean) as { label: string; count: number }[]

  return (
    <SideBlock variant="trade" tone={isLong ? 'long' : 'short'} className="sb-trade-cockpit">
      <SideHead
        title="Trade Setup"
        subtitle={`${setup.reasons.length} signals · R:R ${rrLabel}`}
        actions={explainBtn}
      />

      {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}

      <div className="sb-trade-split">
        <div className="sb-trade-split__bias">
          <span className="sb-trade-split__kicker">Bias</span>
          <span className={`sb-trade-split__dir ${dirTone}`}>{isLong ? 'LONG' : 'SHORT'}</span>
          <div
            className="sb-trade-split__meter"
            role="meter"
            aria-valuenow={setup.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`sb-trade-split__meter-fill ${dirTone}`}
              style={{ width: `${setup.confidence}%` }}
            />
          </div>
          <span className="sb-trade-split__conf">{setup.confidence}% conf</span>
        </div>

        <div className="sb-trade-split__entry">
          <span className="sb-trade-split__kicker">Limit entry</span>
          <span className="sb-trade-split__price">{fmtP(setup.entry)}</span>
          {setup.entryMethod && <span className="sb-trade-split__method">{setup.entryMethod}</span>}
          {spotOffset && setup.spotPrice > 0 && (
            <span className="sb-trade-split__spot">
              Spot {fmtP(setup.spotPrice)} · {spotOffset}
            </span>
          )}
        </div>
      </div>

      <TradeRiskMap sl={setup.sl} entry={setup.entry} tp1={setup.tp1} tp2={setup.tp2} />

      <div className="sb-trade-ladder">
        <LadderRow label="SL" price={setup.sl} delta={`-${riskPct}%`} tone="dn" delay={40} />
        <LadderRow label="Entry" price={setup.entry} tone="entry" delay={80} />
        <LadderRow
          label="TP1"
          price={setup.tp1}
          delta={pctFromEntry(setup.entry, setup.tp1)}
          tone="up"
          delay={120}
        />
        <LadderRow
          label="TP2"
          price={setup.tp2}
          delta={pctFromEntry(setup.entry, setup.tp2)}
          tone="up"
          delay={160}
        />
      </div>

      {tags.length > 0 && (
        <div className="sb-trade-tags">
          {tags.map((t) => (
            <span key={t.label} className="sb-trade-tags__item">
              <span className="sb-trade-tags__name">{t.label}</span>
              <span className="sb-trade-tags__count">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="sb-trade-sizing-toggle"
        onClick={() => setSizingOpen((o) => !o)}
        aria-expanded={sizingOpen}
      >
        <span className="sb-trade-sizing-toggle__caret" aria-hidden>
          {sizingOpen ? '−' : '+'}
        </span>
        <span>Position sizing</span>
        <span className="sb-trade-sizing-toggle__summary">
          ${positionSize.toFixed(0)} · {leverage}x
        </span>
      </button>

      {sizingOpen && (
        <SideBody className="sb-trade-sizing">
          <div className="sb-trade-inputs">
            <div className="sb-input-field">
              <label htmlFor="sb-capital">Capital (USD)</label>
              <input
                id="sb-capital"
                type="number"
                min={1}
                step={1}
                value={capital}
                onChange={(e) => setCapital(Math.max(1, +e.target.value || 1))}
              />
            </div>
            <div className="sb-input-field">
              <label htmlFor="sb-lev">Leverage</label>
              <input
                id="sb-lev"
                type="number"
                min={1}
                max={125}
                value={leverage}
                onChange={(e) => setLeverage(Math.max(1, Math.min(125, +e.target.value || 1)))}
              />
            </div>
          </div>

          <div className="sb-trade-pnl">
            <SideRow label="Size" value={`$${positionSize.toFixed(1)}`} />
            <SideRow label="Qty" value={qty.toFixed(5)} />
            <SideRow label="Risk @ SL" value={`-$${lossAtSL.toFixed(1)}`} tone="dn" />
            <SideRow label="PnL @ TP1" value={`+$${profitAtTP1.toFixed(1)}`} tone="up" />
          </div>

          <SideDivider />

          <SideNote>Reference sizing only, not investment advice</SideNote>
        </SideBody>
      )}
    </SideBlock>
  )
})
