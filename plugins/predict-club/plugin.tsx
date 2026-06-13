import type { ComponentType } from 'react'
import type { HostAPI, Plugin } from '../../src/plugins/types'
import { isSuiHostAPI, type SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { startOracleService, stopOracleService } from './infrastructure/deepbookOracleService'
import { initIndicatorWasm } from './infrastructure/indicatorWasm'
import { PredictClubProvider } from './presentation/PredictClubContext'
import { DecisionStripPanel } from './presentation/DecisionStripPanel'
import { ClubPanel } from './presentation/ClubPanel'
import { PredictionRoomPanel } from './presentation/PredictionRoomPanel'
import { RiskPanel } from './presentation/RiskPanel'
import { FundingRouterPanel } from './presentation/FundingRouterPanel'
import { EscrowOffersPanel } from './presentation/EscrowOffersPanel'
import { RoundHistoryPanel } from './presentation/RoundHistoryPanel'
import { ModalLayer } from './presentation/ModalLayer'
import { QuickPredictPanelWrapper } from './presentation/QuickPredictPanelWrapper'
import { PredictClubRoot } from './presentation/PredictClubRoot'
import { NextShell } from './presentation/next/NextShell'
import { CockpitShell } from './presentation/next/CockpitShell'
import './style.css'

let activeHost: SuiHostAPI | null = null

/**
 * Wrapper that provides shared context to any panel component.
 * Used when mounting individual panels into HTML slots.
 */
function withProvider<P extends object>(Panel: ComponentType<P>): ComponentType<unknown> {
  const Wrapped = (props: P) => (
    <PredictClubProvider host={activeHost}>
      <Panel {...props} />
    </PredictClubProvider>
  )
  Wrapped.displayName = `WithProvider(${Panel.displayName || Panel.name})`
  return Wrapped as unknown as ComponentType<unknown>
}

/**
 * Full monolithic root (backward compatible with single-slot mode).
 */
const PredictClubComponent = (() => <PredictClubRoot host={activeHost} />) as ComponentType<unknown>

const PredictClubPlugin: Plugin = {
  name: 'PredictClub',
  version: '2.0.0',
  styleUrls: ['/plugins/predict-club/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) {
      activeHost = host
    }
    startOracleService()
    initIndicatorWasm()

    // Register monolithic component (backward compatible)
    host.registerComponent('PredictClub', PredictClubComponent)

    // Register individual panel components for multi-slot mounting
    host.registerComponent('PredictClub.DecisionStrip', withProvider(DecisionStripPanel))
    host.registerComponent('PredictClub.ClubPanel', withProvider(ClubPanel))
    host.registerComponent('PredictClub.PredictionRoom', withProvider(PredictionRoomPanel))
    host.registerComponent('PredictClub.RiskPanel', withProvider(RiskPanel))
    host.registerComponent('PredictClub.FundingRouter', withProvider(FundingRouterPanel))
    host.registerComponent('PredictClub.EscrowOffers', withProvider(EscrowOffersPanel))
    host.registerComponent('PredictClub.RoundHistory', withProvider(RoundHistoryPanel))
    host.registerComponent('PredictClub.QuickPredict', withProvider(QuickPredictPanelWrapper))
    host.registerComponent('PredictClub.ModalLayer', withProvider(ModalLayer))

    // Redesign (Next) surface — React-owned region grid, shares the same context
    host.registerComponent('PredictClub.Next.Shell', withProvider(NextShell))

    // Cockpit rebuild (story 22, chart-king) — replaces Next.Shell at cutover.
    host.registerComponent('PredictClub.Next.Cockpit', withProvider(CockpitShell))

    host.log('PredictClub plugin v2 initialized (multi-slot)')
  },

  mount() {
    activeHost?.log('PredictClub mounted')
  },

  unmount() {
    stopOracleService()
    activeHost = null
  },
}

export default PredictClubPlugin
