export type TabId =
  | 'market'
  | 'surface'
  | 'risk'
  | 'trade'
  | 'vault'
  | 'strategy'
  | 'arb'
  | 'plphedge'
  | 'loop'
  | 'portfolio'
  | 'lending'
  | 'spot'
  | 'keeper'

export type UserIntent = 'trade' | 'analyze' | 'earn' | 'claim'
export type GuidedTradeStep = 'market' | 'prediction' | 'amount' | 'preview' | 'submit'
export type FeatureStatus = 'live' | 'simulated' | 'experimental' | 'requires-wallet'

export interface OracleEntry {
  oracle_id: string
  underlying_asset: string
  expiry: number
  min_strike: number
  tick_size: number
  status: string
  activated_at: number
  settlement_price: number | null
}

export interface SVIParams {
  a: number
  b: number
  rho: number
  rho_negative: boolean
  m: number
  m_negative: boolean
  sigma: number
  onchain_timestamp: number
}

export interface SurfacePoint {
  strike: number
  moneyness: number
  iv: number
  w: number
}

export interface SurfaceResult {
  surface: SurfacePoint[]
  forward: number
  T: number
  params: { a: number; b: number; rho: number; m: number; sigma: number }
}

export interface VaultSummary {
  vault_balance: number
  vault_value: number
  total_mtm: number
  total_max_payout: number
  available_liquidity: number
  available_withdrawal: number
  plp_total_supply: number
  plp_share_price: number
  utilization: number
  max_payout_utilization: number
  net_deposits: number
  total_supplied: number
  total_withdrawn: number
}

export interface PerformancePoint {
  timestamp_ms: number
  share_price: number
  vault_value: number
  total_shares: number
}

export interface ButterflyViolation {
  strike: number
  iv: number
  expected: number
}

export interface ManagerRecord {
  manager_id: string
  owner: string
}

export interface ManagerPortfolioSnapshot {
  summary: Record<string, unknown> | null
  positions: Record<string, unknown>[]
  ranges: Record<string, unknown>[]
  pnlPoints: Record<string, unknown>[]
}

export type PositionOverlayStatus = 'open' | 'awaiting-settlement' | 'settled' | 'claimable'

export interface PositionOverlay {
  id: string
  kind: 'binary' | 'range'
  oracleId: string
  quantity: number
  status: PositionOverlayStatus
  strike?: number
  isUp?: boolean
  lowerStrike?: number
  upperStrike?: number
}
