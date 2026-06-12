import type { Transaction } from '@mysten/sui/transactions'

/** Supported DEX identifiers */
export type DexId = 'deepbook' | 'cetus' | 'turbos' | 'sevenk' | 'bluefin'

/** Input parameters for requesting a swap quote */
export interface QuoteParams {
  fromToken: string
  toToken: string
  amount: number
  slippage: number
  sender: string | null
  network: 'mainnet' | 'testnet'
}

/** Result from a single DEX quote */
export interface RouteQuote {
  dex: DexId
  dexLabel: string
  outputAmount: number
  priceImpact: number
  fee: { amount: number; token: string }
  route: string[]
  estimatedGas: number
  buildTx?: (tx: Transaction) => void | Promise<void>
  serializedTx?: string
}

/** Aggregated result across all DEX quotes */
export interface QuoteResult {
  quotes: RouteQuote[]
  loading: boolean
  error: string | null
  bestDex: DexId | null
}

/**
 * Strategy interface — every DEX adapter must implement this.
 * Follows Open/Closed Principle: add new DEX without modifying router.
 */
export interface DexAdapter {
  readonly id: DexId
  readonly label: string
  readonly icon: string
  readonly color: string
  /** Timeout in ms for this adapter */
  readonly timeout: number
  /** Fetch a quote for the given params. Throws on failure. */
  fetchQuote(params: QuoteParams): Promise<RouteQuote>
  /** Check if this adapter supports the given token pair */
  supportsPair(from: string, to: string, network: 'mainnet' | 'testnet'): boolean
}

/** Configuration for the router orchestrator */
export interface RouterConfig {
  /** Max concurrent timeout per adapter (overrides adapter default if set) */
  globalTimeout?: number
  /** Only use these adapters (default: all registered) */
  enabledDexes?: DexId[]
}
