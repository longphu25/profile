import type { IndicatorSignal } from '../domain/types'
import type { OraclePrice } from './deepbookOracleService'

export interface IndicatorSignalGateway {
  fetchSignals(market: string): Promise<IndicatorSignal[]>
  checkOracleHealth(oracleId: string): Promise<{ lastUpdateMs: number; isHealthy: boolean }>
}

const DEFAULT_STALE_THRESHOLD_MS = 60_000

export interface IndicatorSignalGatewayConfig {
  staleThresholdMs?: number
}

// ── Indicator computations from price array ────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function computeMA(prices: number[], short = 5, long = 20) {
  if (prices.length < 2) return null
  const maShort = avg(prices.slice(-short))
  const maLong = avg(prices.slice(-long))
  return { maShort, maLong }
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  const changes = prices
    .slice(-period - 1)
    .map((v, i, a) => (i > 0 ? v - a[i - 1] : 0))
    .slice(1)
  const gains = changes.filter((c) => c > 0)
  const losses = changes.filter((c) => c < 0).map(Math.abs)
  const avgGain = avg(gains) || 0
  const avgLoss = avg(losses) || 0
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function computeOrderFlowDelta(prices: OraclePrice[]): { delta: number; label: string } {
  // Momentum proxy: sum of signed price changes over last 10 ticks
  if (prices.length < 2) return { delta: 0, label: '0' }
  const ticks = prices.slice(-10)
  let delta = 0
  for (let i = 1; i < ticks.length; i++) {
    delta += ticks[i].spot - ticks[i - 1].spot
  }
  const label = `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`
  return { delta, label }
}

function computeBasis(prices: OraclePrice[]): {
  basis: number
  label: string
  state: 'bullish' | 'bearish' | 'neutral'
} {
  // Basis = forward - spot (contango = bullish pressure, backwardation = bearish)
  if (prices.length === 0) return { basis: 0, label: '—', state: 'neutral' }
  const last = prices[prices.length - 1]
  const basis = last.forward - last.spot
  const basisPct = last.spot > 0 ? (basis / last.spot) * 100 : 0
  const state = basisPct > 0.005 ? 'bullish' : basisPct < -0.005 ? 'bearish' : 'neutral'
  const sign = basis >= 0 ? '+' : ''
  const label = `${sign}${basis.toFixed(0)} (${sign}${basisPct.toFixed(3)}%)`
  return { basis, label, state }
}

function priceToState(
  value: number,
  bullThreshold: number,
  bearThreshold: number,
): 'bullish' | 'bearish' | 'neutral' {
  if (value > bullThreshold) return 'bullish'
  if (value < bearThreshold) return 'bearish'
  return 'neutral'
}

export function deriveSignalsFromPrices(prices: OraclePrice[]): IndicatorSignal[] {
  const spotPrices = prices.map((p) => p.spot)

  const ma = computeMA(spotPrices)
  const maState = ma ? priceToState(ma.maShort - ma.maLong, 10, -10) : 'neutral'
  const maValue = ma ? `${ma.maShort.toFixed(0)} / ${ma.maLong.toFixed(0)}` : 'Insufficient data'
  const maConfidence = ma
    ? Math.min(95, 50 + Math.abs(((ma.maShort - ma.maLong) / (ma.maLong || 1)) * 2000))
    : 50

  const rsi = computeRSI(spotPrices)
  const rsiState: 'bullish' | 'bearish' | 'neutral' =
    rsi === null ? 'neutral' : rsi > 60 ? 'bullish' : rsi < 40 ? 'bearish' : 'neutral'
  const rsiValue = rsi !== null ? `${rsi.toFixed(1)}` : 'Insufficient data'
  const rsiConfidence = rsi !== null ? Math.min(90, 40 + Math.abs(rsi - 50)) : 50

  const { delta, label: flowLabel } = computeOrderFlowDelta(prices)
  const flowState = priceToState(delta, 5, -5)
  const flowValue = `${flowLabel} momentum`
  const flowConfidence = Math.min(90, 50 + Math.min(Math.abs(delta), 50))

  // Box Flip: price broke above/below recent range
  let boxState: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  let boxValue = 'No signal'
  if (prices.length >= 10) {
    const recent = spotPrices.slice(-10)
    const rangeHigh = Math.max(...recent.slice(0, -1))
    const rangeLow = Math.min(...recent.slice(0, -1))
    const last = spotPrices[spotPrices.length - 1]
    if (last > rangeHigh) {
      boxState = 'bullish'
      boxValue = 'Breakout'
    } else if (last < rangeLow) {
      boxState = 'bearish'
      boxValue = 'Breakdown'
    } else {
      boxValue = 'Range'
    }
  }

  // SMC: higher highs / lower lows
  let smcState: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  let smcValue = 'No signal'
  if (prices.length >= 6) {
    const last3 = spotPrices.slice(-3)
    const prev3 = spotPrices.slice(-6, -3)
    if (last3[2] > prev3[2] && last3[0] > prev3[0]) {
      smcState = 'bullish'
      smcValue = 'HH structure'
    } else if (last3[2] < prev3[2] && last3[0] < prev3[0]) {
      smcState = 'bearish'
      smcValue = 'LL structure'
    } else {
      smcValue = 'Mixed'
    }
  }

  // Basis replaces Volume Profile — uses real forward/spot data from oracle
  const { label: basisLabel, state: basisState } = computeBasis(prices)

  return [
    { id: 'box', name: 'Box Flip', state: boxState, value: boxValue, confidence: 76 },
    { id: 'smc', name: 'Smart Money', state: smcState, value: smcValue, confidence: 72 },
    {
      id: 'ma',
      name: 'MA Trend',
      state: maState,
      value: maValue,
      confidence: Math.round(maConfidence),
    },
    {
      id: 'rsi',
      name: 'RSI',
      state: rsiState,
      value: rsiValue,
      confidence: Math.round(rsiConfidence),
    },
    {
      id: 'flow',
      name: 'Momentum',
      state: flowState,
      value: flowValue,
      confidence: Math.round(flowConfidence),
    },
    { id: 'basis', name: 'Basis (Fwd-Spot)', state: basisState, value: basisLabel, confidence: 80 },
  ]
}

const DEFAULT_SIGNALS: IndicatorSignal[] = [
  { id: 'box', name: 'Box Flip', state: 'neutral', value: 'No signal', confidence: 50 },
  { id: 'smc', name: 'Smart Money', state: 'neutral', value: 'No signal', confidence: 50 },
  { id: 'ma', name: 'MA Trend', state: 'neutral', value: 'Flat', confidence: 50 },
  { id: 'rsi', name: 'RSI', state: 'neutral', value: '50.0', confidence: 50 },
  { id: 'flow', name: 'Order Flow', state: 'neutral', value: '0 delta', confidence: 50 },
  { id: 'vp', name: 'Volume Profile', state: 'neutral', value: 'At POC', confidence: 50 },
]

/**
 * Creates an IndicatorSignalGateway backed by the oracle price stream.
 * Pass `getPrices` to allow the gateway to read live prices from deepbookOracleService.
 */
export function createIndicatorSignalGateway(
  getPrices: () => OraclePrice[],
  getLastUpdateMs: () => number,
  config: IndicatorSignalGatewayConfig = {},
): IndicatorSignalGateway {
  const staleThresholdMs = config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS

  return {
    async fetchSignals(_market: string): Promise<IndicatorSignal[]> {
      const prices = getPrices()
      if (prices.length < 3) return DEFAULT_SIGNALS
      return deriveSignalsFromPrices(prices)
    },

    async checkOracleHealth(_oracleId: string) {
      const lastUpdateMs = getLastUpdateMs()
      const isHealthy = lastUpdateMs > 0 && Date.now() - lastUpdateMs < staleThresholdMs
      return { lastUpdateMs, isHealthy }
    },
  }
}
