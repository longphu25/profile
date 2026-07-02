// BTC Chart — Trade Setup panel: Entry / SL / TP + position sizing.

import { useState, memo } from 'react'
import { fmtP, type TradeSetup } from '../lib'
import { ExplainModal } from './ExplainModal'
import {
  SideBlock,
  SideHead,
  SideBody,
  SideBadge,
  SideNote,
  SideDivider,
  SideRow,
  SideEmpty,
} from './sidebar'

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
  return `${sign}${pct.toFixed(2)}% from spot`
}

interface TradeLevelProps {
  label: string
  price: number
  delta?: string
  tone?: 'up' | 'dn' | 'entry'
  active?: boolean
}

function TradeLevel({ label, price, delta, tone, active }: TradeLevelProps) {
  const rowTone = tone === 'entry' ? 'entry' : (tone ?? '')
  return (
    <div className={`sb-trade-level sb-trade-level--${rowTone}${active ? ' is-active' : ''}`}>
      <div className="sb-trade-level__rail" aria-hidden>
        <span className="sb-trade-level__dot" />
      </div>
      <div className="sb-trade-level__main">
        <span className="sb-trade-level__label">{label}</span>
        <span className={`sb-trade-level__price ${rowTone}`}>{fmtP(price)}</span>
      </div>
      {delta && <span className={`sb-trade-level__delta ${rowTone}`}>{delta}</span>}
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
      className="sb-chip"
      onClick={(e) => {
        e.stopPropagation()
        setExplainOpen(true)
      }}
      title="Giải thích chỉ báo"
    >
      ?
    </button>
  )

  if (!setup.dir) {
    return (
      <SideBlock variant="trade">
        <SideHead title="Trade Setup" subtitle="Chờ confluence 2+ signals" actions={explainBtn} />
        <SideEmpty>
          <div className="sb-trade-wait">
            <span className="sb-trade-wait__ring" aria-hidden />
            <p className="sb-trade-wait__title">Chưa có setup</p>
            <p className="sb-trade-wait__hint">
              Cần ít nhất 2 tín hiệu đồng thuận (ML, NWE, Boucher, Lien) để hiện Entry, SL và TP.
            </p>
          </div>
        </SideEmpty>
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

  return (
    <SideBlock variant="trade" tone={isLong ? 'long' : 'short'}>
      <SideHead
        title="Trade Setup"
        subtitle={`${setup.reasons.length} confluence · R:R ${rrLabel}`}
        actions={explainBtn}
      />

      {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}

      <div className="sb-trade-hero">
        <div className="sb-trade-hero__head">
          <span className="sb-trade-hero__kicker">Direction</span>
          <SideBadge tone={dirTone}>{setup.confidence}% conf</SideBadge>
        </div>
        <div className={`sb-trade-hero__dir ${dirTone}`}>
          {isLong ? 'LONG' : 'SHORT'}
          <span className="sb-trade-hero__arrow" aria-hidden>
            {isLong ? '▲' : '▼'}
          </span>
        </div>
        <div className="sb-trade-hero__entry">
          <span className="sb-trade-hero__entry-label">Limit entry</span>
          <span className="sb-trade-hero__entry-price">{fmtP(setup.entry)}</span>
          {setup.entryMethod && (
            <span className="sb-trade-hero__entry-method">{setup.entryMethod}</span>
          )}
          {spotOffset && setup.spotPrice > 0 && (
            <span className="sb-trade-hero__entry-offset">
              Spot {fmtP(setup.spotPrice)} · {spotOffset}
            </span>
          )}
        </div>
        <div className="sb-trade-hero__meta">
          <span>R:R {rrLabel}</span>
          <span>{setup.reasons.length} signals</span>
        </div>
      </div>

      <div className="sb-trade-levels">
        <TradeLevel label="Stop Loss" price={setup.sl} delta={`-${riskPct}%`} tone="dn" />
        <TradeLevel label="Limit entry" price={setup.entry} tone="entry" active />
        <TradeLevel
          label="Take Profit 1"
          price={setup.tp1}
          delta={pctFromEntry(setup.entry, setup.tp1)}
          tone="up"
        />
        <TradeLevel
          label="Take Profit 2"
          price={setup.tp2}
          delta={pctFromEntry(setup.entry, setup.tp2)}
          tone="up"
        />
      </div>

      {(mlCount > 0 || boucherCount > 0 || lienCount > 0 || nweCount > 0) && (
        <div className="sb-trade-confluence">
          <span className="sb-trade-confluence__label">Confluence</span>
          <div className="sb-chip-row">
            {mlCount > 0 && <span className="sb-chip sb-chip--trade">ML/Ind {mlCount}</span>}
            {boucherCount > 0 && (
              <span className="sb-chip sb-chip--trade">Boucher {boucherCount}</span>
            )}
            {lienCount > 0 && <span className="sb-chip sb-chip--trade">Lien {lienCount}</span>}
            {nweCount > 0 && <span className="sb-chip sb-chip--trade">NWE {nweCount}</span>}
          </div>
        </div>
      )}

      <button
        type="button"
        className="sb-trade-sizing-toggle"
        onClick={() => setSizingOpen((o) => !o)}
        aria-expanded={sizingOpen}
      >
        <span className="sb-trade-sizing-toggle__caret" aria-hidden>
          {sizingOpen ? '▾' : '▸'}
        </span>
        <span>Position sizing</span>
        <span className="sb-trade-sizing-toggle__summary">
          ${positionSize.toFixed(0)} · {leverage}x
        </span>
      </button>

      {sizingOpen && (
        <SideBody className="sb-trade-sizing">
          <div className="sb-input-row">
            <div className="sb-input-field">
              <label htmlFor="sb-capital">Vốn (USD)</label>
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

          <div className="sb-calc-box sb-panel-grid">
            <SideRow label="Size" value={`$${positionSize.toFixed(1)}`} />
            <SideRow label="Qty" value={qty.toFixed(5)} />
            <SideRow label="Risk @ SL" value={`-$${lossAtSL.toFixed(1)}`} tone="dn" />
            <SideRow label="PnL @ TP1" value={`+$${profitAtTP1.toFixed(1)}`} tone="up" />
          </div>

          <SideDivider />

          <SideNote>Tính toán tham khảo, không phải lời khuyên đầu tư</SideNote>
        </SideBody>
      )}
    </SideBlock>
  )
})
