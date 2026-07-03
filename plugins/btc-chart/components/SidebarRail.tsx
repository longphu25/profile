import { Suspense } from 'react'
import type { Interval } from '../lib/constants'
import type { FundingState } from '../lib/types'
import type { BoucherResult } from '../lib/boucher-scalping'
import type { ICTResult } from '../lib/ict-sessions'
import type { LienResult } from '../lib/lien-reversal'
import type { LiquidityResult } from '../lib/liquidity'
import type { LuxNweResult } from '../lib/chart-render-context'
import type { SignalConfig } from '../lib/signal-config'
import type { Candle, SidebarState } from '../lib/types'
import type { SymbolId } from '../lib/symbols'
import type { MobileRailTab } from '../lib/mobile-rail-tabs'
import type { UsePositions } from '../hooks/usePositions'
import { RailSection } from './sidebar/SidebarBlocks'
import {
  FundingNwePanelLazy,
  LiquidityPanelLazy,
  ReversalPanel,
  ScalpingPanel,
  SessionsPanelLazy,
  SignalPanelLazy,
  TradeSetupPanelLazy,
} from '../lib/lazy-panels'

export interface SidebarRailProps {
  readonly variant: 'desktop' | 'mobile'
  readonly mobileTab?: MobileRailTab
  readonly sidebar: SidebarState
  readonly signalConfig: SignalConfig
  readonly onSignalConfigChange: (cfg: SignalConfig) => void
  readonly positions: UsePositions['positions']
  readonly showPosForm: boolean
  readonly setShowPosForm: UsePositions['setShowForm']
  readonly posForm: UsePositions['form']
  readonly setPosForm: UsePositions['setForm']
  readonly onAddPosition: UsePositions['addPosition']
  readonly onRemovePosition: UsePositions['removePosition']
  readonly onUpdatePosition: UsePositions['updatePosition']
  readonly markPrice: number | null
  readonly posSuggestions: Record<string, { sl: number; tp1: number; tp2: number; tp3: number }>
  readonly funding: FundingState
  readonly luxNweResult: LuxNweResult
  readonly panelCandles: Candle[]
  readonly symbol: SymbolId
  readonly ictResult: ICTResult
  readonly liquidityResult: LiquidityResult
  readonly boucherScalp: BoucherResult
  readonly lienReversal: LienResult
  readonly interval: Interval
  readonly boucherEnabled: boolean
  readonly lienEnabled: boolean
  readonly onToggleBoucher: () => void
  readonly onToggleLien: () => void
}

function SignalAndSetupPanels({
  sidebar,
  signalConfig,
  onSignalConfigChange,
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
}: Pick<
  SidebarRailProps,
  | 'sidebar'
  | 'signalConfig'
  | 'onSignalConfigChange'
  | 'positions'
  | 'showPosForm'
  | 'setShowPosForm'
  | 'posForm'
  | 'setPosForm'
  | 'onAddPosition'
  | 'onRemovePosition'
  | 'onUpdatePosition'
  | 'markPrice'
  | 'posSuggestions'
>) {
  return (
    <>
      <Suspense fallback={<div className="sb-empty">Loading signal…</div>}>
        <SignalPanelLazy
          ml={sidebar.ml}
          setup={sidebar.tradeSetup}
          signalConfig={signalConfig}
          onSignalConfigChange={onSignalConfigChange}
        />
      </Suspense>
      <Suspense fallback={<div className="sb-empty">Loading setup…</div>}>
        <TradeSetupPanelLazy
          setup={sidebar.tradeSetup}
          positions={positions}
          showPosForm={showPosForm}
          setShowPosForm={setShowPosForm}
          posForm={posForm}
          setPosForm={setPosForm}
          onAddPosition={onAddPosition}
          onRemovePosition={onRemovePosition}
          onUpdatePosition={onUpdatePosition}
          markPrice={markPrice}
          posSuggestions={posSuggestions}
        />
      </Suspense>
    </>
  )
}

function ContextPanels({
  ictResult,
  liquidityResult,
}: Pick<SidebarRailProps, 'ictResult' | 'liquidityResult'>) {
  return (
    <>
      <Suspense fallback={<div className="sb-empty">Loading sessions…</div>}>
        <SessionsPanelLazy ict={ictResult} />
      </Suspense>
      <Suspense fallback={<div className="sb-empty">Loading liquidity…</div>}>
        <LiquidityPanelLazy liquidity={liquidityResult} />
      </Suspense>
    </>
  )
}

function StrategyPanels({
  boucherScalp,
  lienReversal,
  interval,
  boucherEnabled,
  lienEnabled,
  onToggleBoucher,
  onToggleLien,
}: Pick<
  SidebarRailProps,
  | 'boucherScalp'
  | 'lienReversal'
  | 'interval'
  | 'boucherEnabled'
  | 'lienEnabled'
  | 'onToggleBoucher'
  | 'onToggleLien'
>) {
  return (
    <>
      <Suspense fallback={<div className="sb-empty">Loading scalping…</div>}>
        <ScalpingPanel
          scalp={boucherScalp}
          interval={interval}
          enabled={boucherEnabled}
          onToggle={onToggleBoucher}
        />
      </Suspense>
      <Suspense fallback={<div className="sb-empty">Loading reversal…</div>}>
        <ReversalPanel lien={lienReversal} enabled={lienEnabled} onToggle={onToggleLien} />
      </Suspense>
    </>
  )
}

function FundingPanel({
  funding,
  luxNweResult,
  panelCandles,
  symbol,
}: Pick<SidebarRailProps, 'funding' | 'luxNweResult' | 'panelCandles' | 'symbol'>) {
  return (
    <Suspense fallback={<div className="sb-empty">Loading funding…</div>}>
      <FundingNwePanelLazy
        funding={funding}
        nwe={luxNweResult}
        candles={panelCandles}
        symbol={symbol}
      />
    </Suspense>
  )
}

/** Shared sidebar rail panels for desktop sections and mobile tabs. */
export function SidebarRail(props: SidebarRailProps) {
  if (props.variant === 'desktop') {
    return (
      <>
        <RailSection label="Signals">
          <SignalAndSetupPanels {...props} />
          <FundingPanel {...props} />
        </RailSection>
        <RailSection label="Context">
          <ContextPanels {...props} />
        </RailSection>
        <RailSection label="Strategies">
          <StrategyPanels {...props} />
        </RailSection>
      </>
    )
  }

  const tab = props.mobileTab ?? 'setup'
  if (tab === 'setup') {
    return <SignalAndSetupPanels {...props} />
  }
  if (tab === 'funding') {
    return <FundingPanel {...props} />
  }
  if (tab === 'context') {
    return <ContextPanels {...props} />
  }
  return <StrategyPanels {...props} />
}
