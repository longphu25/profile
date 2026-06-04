import type { IndicatorSignal } from '../domain/types'

export interface IndicatorSignalGateway {
  fetchSignals(market: string): Promise<IndicatorSignal[]>
  checkOracleHealth(oracleId: string): Promise<{ lastUpdateMs: number; isHealthy: boolean }>
}

/** Default staleness threshold: 60 seconds (per requirement 14.2) */
const DEFAULT_STALE_THRESHOLD_MS = 60_000

export interface IndicatorSignalGatewayConfig {
  /** Oracle staleness threshold in milliseconds. Default: 60000 (60s) */
  staleThresholdMs?: number
  /** Override simulated signals per market. If not provided, uses built-in demo data. */
  signalOverrides?: Record<string, IndicatorSignal[]>
  /** Override oracle last-update timestamp (ms). If not provided, uses Date.now(). */
  oracleLastUpdateMs?: number
}

const DEMO_SIGNALS: Record<string, IndicatorSignal[]> = {
  'BTC/USD': [
    { id: 'box', name: 'Box Flip', state: 'bullish', value: 'Breakout + retest', confidence: 84 },
    { id: 'smc', name: 'Smart Money', state: 'bullish', value: 'BOS confirmed', confidence: 77 },
    { id: 'ma', name: 'MA Trend', state: 'bullish', value: 'EMA stack up', confidence: 72 },
    { id: 'rsi', name: 'RSI', state: 'neutral', value: '61.4 cooling', confidence: 55 },
    { id: 'flow', name: 'Order Flow', state: 'bullish', value: '+1.8M delta', confidence: 69 },
    { id: 'vp', name: 'Volume Profile', state: 'neutral', value: 'Near HVN', confidence: 58 },
  ],
  'ETH/USD': [
    { id: 'box', name: 'Box Flip', state: 'bearish', value: 'Range lost', confidence: 71 },
    { id: 'smc', name: 'Smart Money', state: 'bearish', value: 'CHoCH down', confidence: 68 },
    { id: 'ma', name: 'MA Trend', state: 'bearish', value: 'EMA cross down', confidence: 65 },
    { id: 'rsi', name: 'RSI', state: 'neutral', value: '42.1 weak', confidence: 50 },
    { id: 'flow', name: 'Order Flow', state: 'bearish', value: '-2.1M delta', confidence: 73 },
    { id: 'vp', name: 'Volume Profile', state: 'neutral', value: 'Below POC', confidence: 52 },
  ],
}

/** Fallback signals for unknown markets */
const DEFAULT_SIGNALS: IndicatorSignal[] = [
  { id: 'box', name: 'Box Flip', state: 'neutral', value: 'No signal', confidence: 50 },
  { id: 'smc', name: 'Smart Money', state: 'neutral', value: 'No signal', confidence: 50 },
  { id: 'ma', name: 'MA Trend', state: 'neutral', value: 'Flat', confidence: 50 },
  { id: 'rsi', name: 'RSI', state: 'neutral', value: '50.0', confidence: 50 },
  { id: 'flow', name: 'Order Flow', state: 'neutral', value: '0 delta', confidence: 50 },
  { id: 'vp', name: 'Volume Profile', state: 'neutral', value: 'At POC', confidence: 50 },
]

/**
 * Creates an IndicatorSignalGateway using configurable/simulated data for V1.
 * No live Pyth integration — returns demo data suitable for testing and development.
 */
export function createIndicatorSignalGateway(
  config: IndicatorSignalGatewayConfig = {},
): IndicatorSignalGateway {
  const staleThresholdMs = config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS

  return {
    async fetchSignals(market: string): Promise<IndicatorSignal[]> {
      // Check config overrides first
      if (config.signalOverrides?.[market]) {
        return config.signalOverrides[market]
      }

      // Normalize market key: strip timeframe suffixes like "BTC/USD 5m" → "BTC/USD"
      const baseMarket = market.split(' ')[0]

      if (config.signalOverrides?.[baseMarket]) {
        return config.signalOverrides[baseMarket]
      }

      return DEMO_SIGNALS[baseMarket] ?? DEFAULT_SIGNALS
    },

    async checkOracleHealth(
      _oracleId: string,
    ): Promise<{ lastUpdateMs: number; isHealthy: boolean }> {
      const lastUpdateMs = config.oracleLastUpdateMs ?? Date.now()
      const age = Date.now() - lastUpdateMs
      const isHealthy = age <= staleThresholdMs

      return { lastUpdateMs, isHealthy }
    },
  }
}
