// BTC Chart — Trade Setup panel: limit plan + position sizing + positions drawer.

import { useState, memo, useCallback, type ReactNode } from 'react'
import { Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtP } from '../lib/format'
import type { PosForm, Position } from '../lib/positions'
import type { TradeSetup } from '../lib/trade-setup'
import { parseBoundedInt } from '../lib/numeric-field'
import type { PositionPatch } from '../hooks/usePositions'
import { ExplainModal } from './ExplainModal'
import { NumericFieldInput } from './NumericFieldInput'
import { PositionsBody, type PosSuggestion } from './PositionsPanel'
import { SideBlock, SideHead, SideNote, SideBadge } from './sidebar/SidebarBlocks'

export interface TradeSetupPanelProps {
  setup: TradeSetup
  positions: Position[]
  showPosForm: boolean
  setShowPosForm: React.Dispatch<React.SetStateAction<boolean>>
  posForm: PosForm
  setPosForm: React.Dispatch<React.SetStateAction<PosForm>>
  onAddPosition: () => void
  onRemovePosition: (id: string) => void
  onUpdatePosition: (id: string, patch: PositionPatch) => void
  markPrice: number | null
  posSuggestions?: Record<string, PosSuggestion>
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
  const smcCount = reasons.filter((r) => r.startsWith('SMC ')).length
  const ictCount = reasons.filter(
    (r) =>
      r.startsWith('Judas') ||
      r.startsWith('VOL confirms') ||
      r.startsWith('In ') ||
      r.startsWith('Liquidity Sweep') ||
      r.startsWith('Sweep in') ||
      r.startsWith('Discount +') ||
      r.startsWith('Premium +'),
  ).length
  return { mlCount, boucherCount, lienCount, nweCount, smcCount, ictCount }
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

interface SizingTopProps {
  capital: number
  leverage: number
  onCapital: (v: number) => void
  onLeverage: (v: number) => void
  positionSize: number
  lossAtSL: number
  profitAtTP1: number
  profitAtTP2: number
}

function SizingTop({
  capital,
  leverage,
  onCapital,
  onLeverage,
  positionSize,
  lossAtSL,
  profitAtTP1,
  profitAtTP2,
}: SizingTopProps) {
  return (
    <div className="sb-trade-sizing-top">
      <div className="sb-trade-pnl-hero" aria-live="polite">
        <div className="sb-trade-pnl-hero__item sb-trade-pnl-hero__item--risk">
          <span className="sb-trade-pnl-hero__label">Risk @ SL</span>
          <span className="sb-trade-pnl-hero__value dn">-${lossAtSL.toFixed(1)}</span>
        </div>
        <div className="sb-trade-pnl-hero__item sb-trade-pnl-hero__item--tp1">
          <span className="sb-trade-pnl-hero__label">PnL @ TP1</span>
          <span className="sb-trade-pnl-hero__value up">+${profitAtTP1.toFixed(1)}</span>
        </div>
        <div className="sb-trade-pnl-hero__item sb-trade-pnl-hero__item--tp2">
          <span className="sb-trade-pnl-hero__label">PnL @ TP2</span>
          <span className="sb-trade-pnl-hero__value up">+${profitAtTP2.toFixed(1)}</span>
        </div>
      </div>

      <div className="sb-trade-inputs">
        <NumericFieldInput
          id="sb-capital"
          label="Vốn (USD)"
          value={capital}
          onChange={onCapital}
          min={1}
          step={1}
          parse={(raw, fallback) => parseBoundedInt(raw, fallback, 1, 1_000_000_000)}
        />
        <NumericFieldInput
          id="sb-lev"
          label="Leverage"
          value={leverage}
          onChange={onLeverage}
          min={1}
          max={125}
          parse={(raw, fallback) => parseBoundedInt(raw, fallback, 1, 125)}
        />
      </div>

      <p className="sb-trade-sizing-top__meta">
        Size ${positionSize.toFixed(0)} · {leverage}x
      </p>
    </div>
  )
}

/** Collapsed: entry + SL only for fast order placement. */
function QuickLevels({
  dir,
  dirTone,
  entry,
  sl,
}: {
  dir: 'long' | 'short'
  dirTone: 'up' | 'dn'
  entry: number
  sl: number
}) {
  return (
    <div className={`sb-trade-quick sb-trade-quick--${dirTone}`}>
      <span className={`sb-trade-quick__dir ${dirTone}`}>{dir === 'long' ? 'LONG' : 'SHORT'}</span>
      <div className="sb-trade-quick__grid">
        <div className="sb-trade-quick__cell sb-trade-quick__cell--entry">
          <span className="sb-trade-quick__label">Entry</span>
          <span className="sb-trade-quick__price">{fmtP(entry)}</span>
        </div>
        <div className="sb-trade-quick__cell sb-trade-quick__cell--sl">
          <span className="sb-trade-quick__label">SL</span>
          <span className="sb-trade-quick__price">{fmtP(sl)}</span>
        </div>
      </div>
    </div>
  )
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

function HeadIconGroup({
  positionsOpen,
  positionsCount,
  onTogglePositions,
  explainBtn,
}: {
  positionsOpen: boolean
  positionsCount: number
  onTogglePositions: () => void
  explainBtn: ReactNode
}) {
  return (
    <div className="sb-head__icon-group">
      <button
        type="button"
        className={cn('sb-head__icon-btn', positionsOpen && 'is-on')}
        onClick={(e) => {
          e.stopPropagation()
          onTogglePositions()
        }}
        aria-expanded={positionsOpen}
        aria-label="Vị thế"
        title={`Vị thế (${positionsCount})`}
      >
        <Briefcase size={13} strokeWidth={2} aria-hidden />
        {positionsCount > 0 && <span className="sb-head__icon-badge">{positionsCount}</span>}
      </button>
      {explainBtn}
    </div>
  )
}

export const TradeSetupPanel = memo(function TradeSetupPanel({
  setup,
  positions,
  showPosForm,
  setShowPosForm,
  posForm,
  setPosForm,
  onAddPosition,
  onRemovePosition,
  onUpdatePosition,
  markPrice,
  posSuggestions,
}: TradeSetupPanelProps) {
  const [capital, setCapital] = useState(10)
  const [leverage, setLeverage] = useState(10)
  const [open, setOpen] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const [positionsOpen, setPositionsOpen] = useState(false)

  const fillFromSetup = useCallback(() => {
    if (!setup.dir) return
    setPosForm((f) => ({
      ...f,
      side: setup.dir!,
      entry: String(setup.entry),
      sl: String(setup.sl),
      margin: String(capital),
      leverage: String(leverage),
    }))
    setShowPosForm(true)
    setPositionsOpen(true)
  }, [setup.dir, setup.entry, setup.sl, capital, leverage, setPosForm, setShowPosForm])

  const positionsDrawer = positionsOpen ? (
    <div className="sb-trade-positions">
      <PositionsBody
        positions={positions}
        showForm={showPosForm}
        setShowForm={setShowPosForm}
        form={posForm}
        setForm={setPosForm}
        onAdd={onAddPosition}
        onRemove={onRemovePosition}
        onUpdate={onUpdatePosition}
        markPrice={markPrice}
        suggestions={posSuggestions}
        setup={setup}
        onFillFromSetup={setup.dir ? fillFromSetup : undefined}
      />
    </div>
  ) : null

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

  const headActions = (
    <HeadIconGroup
      positionsOpen={positionsOpen}
      positionsCount={positions.length}
      onTogglePositions={() => setPositionsOpen((o) => !o)}
      explainBtn={explainBtn}
    />
  )

  if (!setup.dir) {
    return (
      <SideBlock variant="trade">
        <SideHead title="Trade Setup" subtitle="Chờ confluence" actions={headActions} />
        {positionsDrawer}
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
  const profitAtTP2 = qty * Math.abs(setup.tp2 - setup.entry)
  const rrLabel = setup.rr > 0 ? setup.rr.toFixed(1) : '2.0'
  const spotOffset = fmtSpotOffset(setup.entry, setup.spotPrice)

  const { mlCount, boucherCount, lienCount, nweCount, smcCount, ictCount } = countConfluenceGroups(
    setup.reasons,
  )
  const chips = [
    mlCount > 0 && `ML ${mlCount}`,
    smcCount > 0 && `SMC ${smcCount}`,
    ictCount > 0 && `ICT ${ictCount}`,
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

  const quickSubtitle = `${fmtP(setup.entry)} · SL ${fmtP(setup.sl)}`

  return (
    <SideBlock variant="trade" tone={isLong ? 'long' : 'short'} className="sb-trade-cockpit">
      <SideHead
        title="Trade Setup"
        subtitle={open ? 'Chi tiết' : quickSubtitle}
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open ? (
            <SideBadge tone={isLong ? 'up' : 'dn'}>{isLong ? 'LONG' : 'SHORT'}</SideBadge>
          ) : undefined
        }
        actions={headActions}
      />

      {positionsDrawer}

      {explainOpen && <ExplainModal setup={setup} onClose={() => setExplainOpen(false)} />}

      {!open && <QuickLevels dir={setup.dir} dirTone={dirTone} entry={setup.entry} sl={setup.sl} />}

      {open && (
        <>
          <SizingTop
            capital={capital}
            leverage={leverage}
            onCapital={setCapital}
            onLeverage={setLeverage}
            positionSize={positionSize}
            lossAtSL={lossAtSL}
            profitAtTP1={profitAtTP1}
            profitAtTP2={profitAtTP2}
          />

          <div className={`sb-trade-verdict sb-trade-verdict--${dirTone}`}>
            <span className={`sb-trade-verdict__dir ${dirTone}`}>{isLong ? 'LONG' : 'SHORT'}</span>
            <meter
              className={`sb-trade-verdict__meter sb-trade-verdict__meter--${dirTone}`}
              value={setup.confidence}
              min={0}
              max={100}
              aria-label={`Độ tin cậy ${setup.confidence}%`}
            />
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

          <SideNote>Tính toán tham khảo, không phải lời khuyên đầu tư</SideNote>
        </>
      )}
    </SideBlock>
  )
})
