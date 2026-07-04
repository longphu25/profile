// BTC Chart — Trade Setup panel: limit plan + position sizing + positions drawer.

import { useState, memo, useCallback, type ReactNode } from 'react'
import { Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtP } from '../lib/format'
import type { PosForm, Position } from '../lib/positions'
import { maContextBlockHint } from '../lib/ma-adaptive'
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

const PLAN_VOTES_REQUIRED = 2

interface BiasLiveHeroProps {
  dir: 'long' | 'short'
  confidence: number
  bull: number
  bear: number
  reasons: string[]
}

/** Prominent live bias when plan is not locked yet (1 vote threshold). */
function BiasLiveHero({ dir, confidence, bull, bear, reasons }: BiasLiveHeroProps) {
  const tone = dir === 'long' ? 'up' : 'dn'
  const leadVotes = dir === 'long' ? bull : bear
  const opposeVotes = dir === 'long' ? bear : bull
  const votesToPlan = Math.max(0, PLAN_VOTES_REQUIRED - leadVotes)
  const { nweCount, smcCount, mlCount } = countConfluenceGroups(reasons)
  const previewChips = [
    nweCount > 0 && `Lux ${nweCount}`,
    smcCount > 0 && `SMC ${smcCount}`,
    mlCount > 0 && `ML ${mlCount}`,
  ].filter(Boolean) as string[]
  const topReasons = reasons.slice(0, 3)

  return (
    <div
      className={cn('sb-trade-bias-live', `sb-trade-bias-live--${tone}`)}
      aria-live="polite"
      aria-label={`Bias live ${dir}, ${confidence} percent`}
    >
      <div className="sb-trade-bias-live__head">
        <span className="sb-trade-bias-live__kicker">Bias live</span>
        <span className={cn('sb-trade-bias-live__dir', tone)}>
          {dir === 'long' ? 'LONG' : 'SHORT'}
        </span>
        <span className="sb-trade-bias-live__conf">{confidence}%</span>
      </div>
      <meter
        className={cn('sb-trade-verdict__meter', `sb-trade-verdict__meter--${tone}`)}
        value={confidence}
        min={0}
        max={100}
        aria-hidden
      />
      <p className="sb-trade-bias-live__votes">
        <span className="sb-trade-bias-live__votes-now">
          {leadVotes}/{PLAN_VOTES_REQUIRED} vote khóa plan
        </span>
        {votesToPlan > 0 && (
          <span className="sb-trade-bias-live__votes-need">
            Cần thêm {votesToPlan} tín hiệu cùng hướng
          </span>
        )}
        {opposeVotes > 0 && (
          <span className="sb-trade-bias-live__votes-oppose">Đối nghịch: {opposeVotes} vote</span>
        )}
      </p>
      {previewChips.length > 0 && (
        <div className="sb-trade-bias-live__chips" aria-label="Nhóm tín hiệu">
          {previewChips.map((chip) => (
            <span key={chip} className="sb-trade-bias-live__chip">
              {chip}
            </span>
          ))}
        </div>
      )}
      {topReasons.length > 0 && (
        <ul className="sb-trade-bias-live__reasons">
          {topReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
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
  profitAtTP3: number
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
  profitAtTP3,
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
        <div className="sb-trade-pnl-hero__item sb-trade-pnl-hero__item--tp3">
          <span className="sb-trade-pnl-hero__label">PnL @ TP3</span>
          <span className="sb-trade-pnl-hero__value up">+${profitAtTP3.toFixed(1)}</span>
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

  const biasDir = setup.bias?.dir ?? null
  const biasConf = setup.bias?.confidence ?? setup.confidence
  const biasReasons = setup.bias?.reasons ?? setup.reasons

  if (!setup.dir) {
    const biasTone = biasDir === 'long' ? 'long' : biasDir === 'short' ? 'short' : undefined
    const maHint = maContextBlockHint(biasReasons)
    return (
      <SideBlock
        variant="trade"
        tone={biasTone}
        className={biasDir ? 'sb-trade-awaiting' : undefined}
      >
        <SideHead
          title="Trade Setup"
          subtitle={
            biasDir
              ? `Bias ${biasDir === 'long' ? 'LONG' : 'SHORT'} · chưa khóa plan`
              : 'Chờ plan khóa'
          }
          badges={
            biasDir ? (
              <SideBadge tone={biasDir === 'long' ? 'up' : 'dn'}>
                BIAS {biasDir === 'long' ? 'LONG' : 'SHORT'}
              </SideBadge>
            ) : undefined
          }
          actions={headActions}
        />
        {positionsDrawer}
        {biasDir && setup.bias && (
          <BiasLiveHero
            dir={biasDir}
            confidence={biasConf}
            bull={setup.bias.bull}
            bear={setup.bias.bear}
            reasons={biasReasons}
          />
        )}
        <div className="sb-trade-empty">
          <p className="sb-trade-empty__title">Chưa có plan</p>
          {maHint && <p className="sb-trade-empty__ma">{maHint}</p>}
          <p className="sb-trade-empty__hint">
            Plan khóa entry, SL và TP khi có ít nhất {PLAN_VOTES_REQUIRED} vote cùng hướng (đến khi
            invalidation). Mặc định: Lux (vùng giá) + SMC (cấu trúc). EMA nhanh theo khung là bối
            cảnh (không vote). Bias live là hướng sớm, chưa có mức giá.
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
  const profitAtTP3 = qty * Math.abs(setup.tp3 - setup.entry)
  const rrLabel = setup.rr > 0 ? setup.rr.toFixed(1) : '2.0'
  const spotOffset = fmtSpotOffset(setup.entry, setup.spotPrice)

  const biasMismatch = biasDir != null && biasDir !== setup.dir
  const { mlCount, boucherCount, lienCount, nweCount, smcCount, ictCount } =
    countConfluenceGroups(biasReasons)
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
        subtitle={open ? 'Plan khóa · chi tiết' : `Plan · ${quickSubtitle}`}
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open ? (
            <>
              <SideBadge tone={isLong ? 'up' : 'dn'}>PLAN {isLong ? 'LONG' : 'SHORT'}</SideBadge>
              {biasMismatch && (
                <SideBadge tone={biasDir === 'long' ? 'up' : 'dn'}>
                  Bias {biasDir === 'long' ? 'LONG' : 'SHORT'}
                </SideBadge>
              )}
            </>
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
            profitAtTP3={profitAtTP3}
          />

          <div className={`sb-trade-verdict sb-trade-verdict--${dirTone}`}>
            <span className={`sb-trade-verdict__dir ${dirTone}`}>{isLong ? 'LONG' : 'SHORT'}</span>
            <meter
              className={`sb-trade-verdict__meter sb-trade-verdict__meter--${dirTone}`}
              value={biasConf}
              min={0}
              max={100}
              aria-label={`Bias live ${biasConf}%`}
            />
            <span className="sb-trade-verdict__conf">Bias {biasConf}%</span>
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
            <PlanRow
              label="Take profit 3"
              price={setup.tp3}
              delta={pctFromEntry(setup.entry, setup.tp3)}
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
              <span className="sb-trade-chips__total">{biasReasons.length} signals</span>
            </div>
          )}

          {biasMismatch && (
            <SideNote>
              Bias live lệch plan: giữ hướng plan đến khi nến đóng hoặc SL bị phá.
            </SideNote>
          )}
          {setup.planStatus === 'active' && !biasMismatch && (
            <SideNote>Plan khóa đến đóng nến hoặc khi giá chạm SL.</SideNote>
          )}

          <SideNote>Tính toán tham khảo, không phải lời khuyên đầu tư</SideNote>
        </>
      )}
    </SideBlock>
  )
})
