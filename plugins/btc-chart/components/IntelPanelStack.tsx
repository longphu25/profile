// BTC Chart — Intel drawer panel bodies (active tab only, isolated from chart re-renders).

import { memo, Suspense, lazy } from 'react'
import type { IntelTab } from '../lib/intel-panels'
import { intelKeywordsFor } from '../lib/intel-panels'
import type { AlertKind, AlertRule } from '../alerts'
import type { VisFlags } from '../storage'
import type { FngState, OiDeltaPct, OiHistoryPoint, SidebarState, StatsState } from '../lib'
import type { WhaleAlert, ExchangeFlow, WhaleStats } from '../lib/whale'
import { SidebarAccordion } from './SidebarAccordion'
import { AlertsPanel } from './AlertsPanel'
import { StatsPanel, FearGreedPanel } from './MarketPanels'
import { VolumeSpikePanel } from './VolumeSpikePanel'

const VolumeProfilePanel = lazy(() =>
  import('./IndicatorReadouts').then((m) => ({ default: m.VolumeProfilePanel })),
)
const OrderFlowPanel = lazy(() =>
  import('./IndicatorReadouts').then((m) => ({ default: m.OrderFlowPanel })),
)
const BoxFlipPanelLazy = lazy(() =>
  import('./IndicatorReadouts').then((m) => ({ default: m.BoxFlipPanel })),
)
const MHBandPanelLazy = lazy(() =>
  import('./IndicatorReadouts').then((m) => ({ default: m.MHBandPanel })),
)
const WhalePanel = lazy(() => import('./WhalePanel').then((m) => ({ default: m.WhalePanel })))
const OIPanelLazy = lazy(() => import('./OIPanel').then((m) => ({ default: m.OIPanel })))
const TechnicalsPanelLazy = lazy(() =>
  import('./TechnicalsPanel').then((m) => ({ default: m.TechnicalsPanel })),
)
const FeatureWeightsPanelLazy = lazy(() =>
  import('./SignalPanel').then((m) => ({ default: m.FeatureWeightsPanel })),
)

export interface IntelPanelStackProps {
  tab: IntelTab
  search: string
  vis: VisFlags
  onToggleVis: (key: keyof VisFlags) => void
  sidebar: SidebarState
  stats: StatsState
  fng: FngState
  oiUsd: number | null
  oiBreakdown: { exchange: string; usd: number }[] | undefined
  oiHistory: OiHistoryPoint[] | undefined
  oiDeltaPct: OiDeltaPct | undefined
  mcap: number | null
  whaleAlerts: WhaleAlert[]
  whaleExchangeFlow: ExchangeFlow | null
  whaleStats: WhaleStats
  whaleRecentBuy: number
  whaleRecentSell: number
  onClearWhale: () => void
  alerts: AlertRule[]
  onAddAlert: (kind: AlertKind, value: number, label?: string) => void
  onRemoveAlert: (id: string) => void
  onToggleAlert: (id: string) => void
  onResetAlert: (id: string) => void
  lastCandleClose: number | null
  spikeMult: number
  onSpikeMultChange: (val: number) => void
}

function panelFallback(label = 'Loading…') {
  return <div className="sb-empty">{label}</div>
}

function TradeTab() {
  return (
    <p className="sb-empty sb-empty--hint">
      Vị thế quản lý tại icon <span className="sb-empty__mono">briefcase</span> trên block Trade
      Setup.
    </p>
  )
}

function MarketTab({
  search,
  oiUsd,
  mcap,
  oiBreakdown,
  oiHistory,
  oiDeltaPct,
  stats,
  fng,
  whaleAlerts,
  whaleExchangeFlow,
  whaleStats,
  whaleRecentBuy,
  whaleRecentSell,
  onClearWhale,
  vis,
  onToggleVis,
}: IntelPanelStackProps) {
  return (
    <>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('market', 'Open Interest')}
        title="Open Interest"
      >
        <Suspense fallback={panelFallback()}>
          <OIPanelLazy
            oi={oiUsd}
            mcap={mcap}
            breakdown={oiBreakdown}
            history={oiHistory}
            deltaPct={oiDeltaPct}
          />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('market', 'Whale Tracker')}
        title="Whale Tracker"
        onToggle={(open) => {
          if (open && !vis.whale) onToggleVis('whale')
        }}
      >
        <Suspense fallback={panelFallback('Loading whale…')}>
          <WhalePanel
            whaleAlerts={whaleAlerts}
            exchangeFlow={whaleExchangeFlow}
            whaleStats={whaleStats}
            recentBuyVolume={whaleRecentBuy}
            recentSellVolume={whaleRecentSell}
            onClear={onClearWhale}
          />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('market', '24h Stats')}
        title="24h Stats"
      >
        <Suspense fallback={panelFallback()}>
          <StatsPanel stats={stats} />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('market', 'Fear & Greed')}
        title="Fear & Greed"
      >
        <Suspense fallback={panelFallback()}>
          <FearGreedPanel fng={fng} />
        </Suspense>
      </SidebarAccordion>
    </>
  )
}

function FlowTab({
  search,
  sidebar,
  vis,
  onToggleVis,
  spikeMult,
  onSpikeMultChange,
}: IntelPanelStackProps) {
  return (
    <>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('flow', 'Order Flow')}
        title="Order Flow"
        onToggle={(open) => {
          if (open && !vis.of) onToggleVis('of')
        }}
      >
        <Suspense fallback={panelFallback()}>
          <OrderFlowPanel ofLog={sidebar.ofLog} />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('flow', 'Box Flip')}
        title="Box Flip"
        onToggle={(open) => {
          if (open && !vis.boxFlip) onToggleVis('boxFlip')
        }}
      >
        <Suspense fallback={panelFallback()}>
          <BoxFlipPanelLazy boxFlip={sidebar.boxFlip} />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('flow', 'Volume Spike')}
        title="Volume Spike"
        onToggle={(open) => {
          if (open && !vis.volSpike) onToggleVis('volSpike')
        }}
      >
        <Suspense fallback={panelFallback()}>
          <VolumeSpikePanel
            enabled={vis.volSpike}
            onToggle={() => onToggleVis('volSpike')}
            spikeMult={spikeMult}
            onChange={onSpikeMultChange}
          />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('flow', 'Volume Profile')}
        title="Volume Profile"
        onToggle={(open) => {
          if (open && !vis.vp) onToggleVis('vp')
        }}
      >
        <Suspense fallback={panelFallback()}>
          <VolumeProfilePanel vp={sidebar.vp} vpHvn={sidebar.vpHvn} />
        </Suspense>
      </SidebarAccordion>
    </>
  )
}

function AlertsTab({
  search,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  onResetAlert,
  lastCandleClose,
  sidebar,
}: IntelPanelStackProps) {
  return (
    <SidebarAccordion
      flat
      lightweight
      filterQuery={search}
      filterKeywords={intelKeywordsFor('alerts', 'Alerts')}
      title="Alerts"
    >
      <AlertsPanel
        alerts={alerts}
        onAdd={onAddAlert}
        onRemove={onRemoveAlert}
        onToggle={onToggleAlert}
        onReset={onResetAlert}
        currentPrice={lastCandleClose}
        currentRsi={sidebar.rsiNow}
      />
    </SidebarAccordion>
  )
}

function MlTab({ search, sidebar, vis, onToggleVis }: IntelPanelStackProps) {
  return (
    <>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('ml', 'MH Band')}
        title="MH Band"
        onToggle={(open) => {
          if (open && !vis.nwe) onToggleVis('nwe')
        }}
      >
        <Suspense fallback={panelFallback()}>
          <MHBandPanelLazy sidebar={sidebar} />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('ml', 'Technicals')}
        title="Technicals"
      >
        <Suspense fallback={panelFallback()}>
          <TechnicalsPanelLazy sidebar={sidebar} />
        </Suspense>
      </SidebarAccordion>
      <SidebarAccordion
        flat
        lightweight
        filterQuery={search}
        filterKeywords={intelKeywordsFor('ml', 'Feature Weights')}
        title="Feature Weights"
      >
        <Suspense fallback={panelFallback()}>
          <FeatureWeightsPanelLazy ml={sidebar.ml} />
        </Suspense>
      </SidebarAccordion>
    </>
  )
}

export const IntelPanelStack = memo(function IntelPanelStack(props: IntelPanelStackProps) {
  switch (props.tab) {
    case 'trade':
      return <TradeTab />
    case 'market':
      return <MarketTab {...props} />
    case 'flow':
      return <FlowTab {...props} />
    case 'alerts':
      return <AlertsTab {...props} />
    case 'ml':
      return <MlTab {...props} />
    default:
      return null
  }
})
