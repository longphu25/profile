// ── Constants & Types for DeepBook Predict Plugin ───────────────────────────────

export const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
export const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
export const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
export const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
export const PRICE_SCALE = 1e9
export const STRIKE_SCALE = 1e9
export const DUSDC_DECIMALS = 6

export type TabId = 'market' | 'surface' | 'risk' | 'trade' | 'vault' | 'strategy' | 'arb'

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
