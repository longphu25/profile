import { lazy } from 'react'

/** Code-split heavier sidebar panels for initial load performance. */
export const ScalpingPanel = lazy(() =>
  import('../components/ScalpingPanel').then((m) => ({ default: m.ScalpingPanel })),
)
export const ReversalPanel = lazy(() =>
  import('../components/ReversalPanel').then((m) => ({ default: m.ReversalPanel })),
)
export const FundingNwePanelLazy = lazy(() =>
  import('../components/FundingNwePanel').then((m) => ({ default: m.FundingNwePanel })),
)
export const SessionsPanelLazy = lazy(() =>
  import('../components/SessionsPanel').then((m) => ({ default: m.SessionsPanel })),
)
export const LiquidityPanelLazy = lazy(() =>
  import('../components/LiquidityPanel').then((m) => ({ default: m.LiquidityPanel })),
)
export const SignalPanelLazy = lazy(() =>
  import('../components/SignalPanel').then((m) => ({ default: m.SignalPanel })),
)
export const TradeSetupPanelLazy = lazy(() =>
  import('../components/TradeSetupPanel').then((m) => ({ default: m.TradeSetupPanel })),
)
