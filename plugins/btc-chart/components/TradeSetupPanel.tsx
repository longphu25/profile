// BTC Chart — Trade Setup panel: limit plan + position sizing.

import { useState, memo } from 'react'
import { fmtP, type TradeSetup } from '../lib'
import { ExplainModal } from './ExplainModal'
import { SideBlock, SideHead, SideBody, SideNote, SideDivider, SideRow, SideBadge } from './sidebar'

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
  if (Math.abs(pct) < 0.01) return 'at spot'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}% vs spot`
}

interface PlanRowProps {
  label: string
  price: number
  delta?: string
  hint?: string
  tone: 'sl' | 'entry' | 'tp'
}

function PlanRow({ label, price, delta, hint, tone }: PlanRowProps) {
  return (
    <div className={`sb-trade-plan__row sb-trade-plan__row--${tone}`}>
      <div className="sb-trade-plan__rail" aria-hidden>
        <span className="sb-trade-plan__dot" />
      </div>
      <div className="sb-trade-plan__body">
        <div className="sb-trade-plan__top">
          <span className="sb-trade-plan__label">{label}</span>
          {delta && (
            <span className={`sb-trade-plan__delta sb-trade-plan__delta--${tone}`}>{delta}</span>
          )}
        </div>
        <span className={`sb-trade-plan__price sb-trade-plan__price--${tone}`}>{fmtP(price)}</span>
        {hint && <span className="sb-trade-plan__hint">{hint}</span>}
      </div>
    </div>
  )
}

export const TradeSetupPanel = memo(function TradeSetupPanel({ setup }: Props) {
  const [capital, setCapital] = useState(10)
  const [leverage, setLeverage] = useState(10)
  const [open, setOpen] = useState(false)
  const [sizingOpen, setSizingOpen] = useState(false)
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
      ?
    </button>
  )

  if (!setup.dir) {
    return (
      <SideBlock variant="trade">
        <SideHead title="Trade Setup" subtitle="Chờ confluence" actions={explainBtn} />
        <div className="sb-trade-empty">
          <p className="sb-trade-empty__title">Chưa có setup</p>
          <p className="sb-trade-empty__hint">
            Cần ít nhất 2 tín hiệu đồng thuận để hiện mức limit entry, SL và TP.
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
  const chips = [
    mlCount > 0 && `ML ${mlCount}`,
    boucherCount > 0 && `Boucher ${boucherCount}`,
    lienCount > 0 && `Lien ${lienCount}`,
    nweCount > 0 && `NWE ${nweCount}`,
  ].filter(Boolean) as string[]

  const entryHint = [
    setup.entryMethod,
    spotOffset && setup.spotPrice > 0 ? `${fmtP(setup.spotPrice)} ${spotOffset}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const compactMeta = `R:R ${rrLabel} · Risk ${riskPct}% · ${setup.reasons.length} signals`

  return (
    <SideBlock variant="trade" tone={isLong ? 'long' : 'short'} className="sb-trade-cockpit">
      <SideHead
        title="Trade Setup"
        subtitle={open ? 'Limit plan' : setup.entryMethod}
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open ? (
            <SideBadge tone={isLong ? 'up' : 'dn'}>{isLong ? 'LONG' : 'SHORT'}</SideBadge>
          ) : undefined
        }
        actions={explainBtn}
      />

      {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}

      {!open && (
        <div className={`sb-trade-compact sb-trade-compact--${dirTone}`}>
          <div className="sb-trade-compact__hero">
            <span className={`sb-trade-compact__dir ${dirTone}`}>{isLong ? 'LONG' : 'SHORT'}</span>
            <span className="sb-trade-compact__entry">{fmtP(setup.entry)}</span>
            <span className="sb-trade-compact__conf">{setup.confidence}%</span>
          </div>
          <p className="sb-trade-compact__meta">{compactMeta}</p>
        </div>
      )}

      {open && (
        <>
          <div className={`sb-trade-verdict sb-trade-verdict--${dirTone}`}>
            <span className={`sb-trade-verdict__dir ${dirTone}`}>{isLong ? 'LONG' : 'SHORT'}</span>
            <span
              className="sb-trade-verdict__meter"
              role="meter"
              aria-valuenow={setup.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className={`sb-trade-verdict__meter-fill ${dirTone}`}
                style={{ width: `${setup.confidence}%` }}
              />
            </span>
            <span className="sb-trade-verdict__conf">{setup.confidence}%</span>
            <div className="sb-trade-verdict__stats">
              <span className="sb-trade-verdict__stat">R:R {rrLabel}</span>
              <span className="sb-trade-verdict__stat">Risk {riskPct}%</span>
            </div>
          </div>

          <div className="sb-trade-plan">
            <PlanRow label="Stop loss" price={setup.sl} delta={`-${riskPct}%`} tone="sl" />
            <PlanRow
              label="Limit entry"
              price={setup.entry}
              hint={entryHint || undefined}
              tone="entry"
            />
            <PlanRow
              label="Take profit 1"
              price={setup.tp1}
              delta={pctFromEntry(setup.entry, setup.tp1)}
              tone="tp"
            />
            <PlanRow
              label="Take profit 2"
              price={setup.tp2}
              delta={pctFromEntry(setup.entry, setup.tp2)}
              tone="tp"
            />
          </div>

          {chips.length > 0 && (
            <div className="sb-trade-chips" aria-label="Confluence groups">
              {chips.map((chip) => (
                <span key={chip} className="sb-trade-chips__item">
                  {chip}
                </span>
              ))}
              <span className="sb-trade-chips__total">{setup.reasons.length} signals</span>
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

              <div className="sb-trade-pnl">
                <SideRow label="Size" value={`$${positionSize.toFixed(1)}`} />
                <SideRow label="Qty" value={qty.toFixed(5)} />
                <SideRow label="Risk @ SL" value={`-$${lossAtSL.toFixed(1)}`} tone="dn" />
                <SideRow label="PnL @ TP1" value={`+$${profitAtTP1.toFixed(1)}`} tone="up" />
              </div>

              <SideDivider />

              <SideNote>Tính toán tham khảo, không phải lời khuyên đầu tư</SideNote>
            </SideBody>
          )}
        </>
      )}
    </SideBlock>
  )
})
