// Extended Host API types for SUI Dashboard
// Plugins receive shared wallet context instead of creating their own DAppKit

import type { HostAPI } from '../plugins/types'

/** Account info stored in shared context */
export interface SuiAccountInfo {
  /** Wallet address */
  address: string
  /** Which wallet this account belongs to */
  walletName: string
  /** Wallet icon URL */
  walletIcon?: string
}

/** Shared Sui context that the dashboard provides to all plugins */
export interface SuiContext {
  /** Currently active wallet address, or null if not connected */
  address: string | null
  /** Current network: mainnet | testnet | devnet */
  network: string
  /** Whether a wallet is currently connected */
  isConnected: boolean
  /** All authorized accounts from all connected wallets */
  accounts: SuiAccountInfo[]
}

/** Callback for context changes */
export type SuiContextListener = (ctx: SuiContext) => void

/** Extended Host API with shared Sui wallet context */
export interface SuiHostAPI extends HostAPI {
  /** Get current shared Sui context (wallet, network) */
  getSuiContext: () => SuiContext
  /** Subscribe to context changes. Returns unsubscribe function. */
  onSuiContextChange: (listener: SuiContextListener) => () => void
  /** Request wallet connection (triggers dashboard-level connect flow) */
  requestConnect: () => void
  /** Request wallet disconnection */
  requestDisconnect: () => void
  /** Request network switch */
  requestNetworkSwitch: (network: string) => void
  /** Shared data store: set a value visible to all plugins */
  setSharedData: (key: string, value: unknown) => void
  /** Shared data store: get a value set by any plugin */
  getSharedData: (key: string) => unknown
  /** Subscribe to shared data changes. Returns unsubscribe function. */
  onSharedDataChange: (key: string, listener: (value: unknown) => void) => () => void
}

/** SUI Plugin interface — same lifecycle, but init receives SuiHostAPI */
export interface SuiPlugin {
  name: string
  version: string
  styleUrls?: string[]
  init: (host: SuiHostAPI) => void
  mount?: () => void
  update?: () => void
  unmount?: () => void
}

/** Type guard: check if a HostAPI is actually a SuiHostAPI (shared context mode) */
export function isSuiHostAPI(host: unknown): host is SuiHostAPI {
  return (
    typeof host === 'object' &&
    host !== null &&
    'getSuiContext' in host &&
    typeof (host as SuiHostAPI).getSuiContext === 'function'
  )
}
