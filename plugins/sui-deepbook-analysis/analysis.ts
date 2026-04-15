// DeepBook Trend Detection & Analysis Engine
// Analyzes orderbook + OHLCV data to generate trading signals
// Designed for future WASM port (pure functions, no DOM/React)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Candle {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderbookSnapshot {
  bids: { price: number; size: number }[]
  asks: { price: number; size: number }[]
  midPrice: number
  spread: number
  spreadPct: number
}

export type Signal = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'

export interface AnalysisResult {
  signal: Signal
  confidence: number // 0-100
  indicators: {
    ema_trend: number // -1 to 1 (negative = downtrend)
    rsi: number // 0-100
    ob_imbalance: number // -1 to 1 (positive = buy pressure)
    momentum: number // -1 to 1
    volatility: number // 0-1 (0 = flat, 1 = very volatile)
    vwap_deviation: number // % deviation from VWAP
  }
  recommendation: {
    longPct: number // 0-100, how much to allocate to long
    shortPct: number // 0-100, how much to allocate to short
  }
}

// ── Indicators ─────────────────────────────────────────────────────────────────

/** Exponential Moving Average */
export function ema(prices: number[], period: number): number[] {
  if (prices.length === 0) return []
  const k = 2 / (period + 1)
  const result = [prices[0]]
  for (let i = 1; i < prices.length; i++) {
    result.push(prices[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

/** Relative Strength Index (0-100) */
export function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50 // neutral
  let gains = 0
  let losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

/** Volume Weighted Average Price */
export function vwap(candles: Candle[]): number {
  let sumPV = 0
  let sumV = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    sumPV += typical * c.volume
    sumV += c.volume
  }
  return sumV > 0 ? sumPV / sumV : 0
}

/** Price momentum: rate of change over N periods */
export function momentum(prices: number[], period = 10): number {
  if (prices.length < period + 1) return 0
  const current = prices[prices.length - 1]
  const past = prices[prices.length - 1 - period]
  return past > 0 ? (current - past) / past : 0
}

/** Volatility: standard deviation of returns */
export function volatility(prices: number[]): number {
  if (prices.length < 2) return 0
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance)
}

/** Orderbook imbalance: -1 (sell pressure) to +1 (buy pressure) */
export function orderbookImbalance(ob: OrderbookSnapshot, depth = 5): number {
  const bidVol = ob.bids.slice(0, depth).reduce((s, l) => s + l.size, 0)
  const askVol = ob.asks.slice(0, depth).reduce((s, l) => s + l.size, 0)
  const total = bidVol + askVol
  return total > 0 ? (bidVol - askVol) / total : 0
}

/** Detect support/resistance walls in orderbook */
export function detectWalls(
  ob: OrderbookSnapshot,
  threshold = 3,
): { bidWalls: { price: number; size: number }[]; askWalls: { price: number; size: number }[] } {
  const avgBidSize = ob.bids.reduce((s, l) => s + l.size, 0) / Math.max(ob.bids.length, 1)
  const avgAskSize = ob.asks.reduce((s, l) => s + l.size, 0) / Math.max(ob.asks.length, 1)
  return {
    bidWalls: ob.bids.filter((l) => l.size > avgBidSize * threshold),
    askWalls: ob.asks.filter((l) => l.size > avgAskSize * threshold),
  }
}

// ── Main Analysis ──────────────────────────────────────────────────────────────

/** Run full analysis on candles + orderbook → trading signal */
export function analyze(candles: Candle[], ob: OrderbookSnapshot): AnalysisResult {
  const closes = candles.map((c) => c.close)
  if (closes.length < 5) {
    return {
      signal: 'neutral',
      confidence: 0,
      indicators: { ema_trend: 0, rsi: 50, ob_imbalance: 0, momentum: 0, volatility: 0, vwap_deviation: 0 },
      recommendation: { longPct: 50, shortPct: 50 },
    }
  }

  // Calculate indicators
  const ema8 = ema(closes, 8)
  const ema21 = ema(closes, 21)
  const currentEma8 = ema8[ema8.length - 1]
  const currentEma21 = ema21[ema21.length - 1]
  const emaTrend = currentEma21 > 0 ? (currentEma8 - currentEma21) / currentEma21 : 0
  const emaTrendNorm = Math.max(-1, Math.min(1, emaTrend * 100)) // normalize to -1..1

  const currentRsi = rsi(closes, 14)
  const rsiNorm = (currentRsi - 50) / 50 // -1 to 1

  const obImbalance = orderbookImbalance(ob)

  const mom = momentum(closes, 10)
  const momNorm = Math.max(-1, Math.min(1, mom * 50))

  const vol = volatility(closes)
  const volNorm = Math.min(1, vol * 100) // 0 to 1

  const currentVwap = vwap(candles.slice(-20))
  const currentPrice = closes[closes.length - 1]
  const vwapDev = currentVwap > 0 ? ((currentPrice - currentVwap) / currentVwap) * 100 : 0

  // Composite score: weighted sum of indicators
  const score =
    emaTrendNorm * 0.25 + // EMA crossover trend
    rsiNorm * 0.15 + // RSI overbought/oversold
    obImbalance * 0.25 + // Orderbook pressure
    momNorm * 0.2 + // Price momentum
    (vwapDev > 0 ? 0.15 : -0.15) * Math.min(1, Math.abs(vwapDev)) // VWAP deviation

  // Determine signal
  let signal: Signal
  if (score > 0.3) signal = 'strong_buy'
  else if (score > 0.1) signal = 'buy'
  else if (score < -0.3) signal = 'strong_sell'
  else if (score < -0.1) signal = 'sell'
  else signal = 'neutral'

  const confidence = Math.min(100, Math.round(Math.abs(score) * 200))

  // Recommendation: how to split between long/short
  // neutral = 50/50, strong_buy = 70/30, strong_sell = 30/70
  const longPct = Math.round(50 + score * 30) // 20-80 range
  const shortPct = 100 - longPct

  return {
    signal,
    confidence,
    indicators: {
      ema_trend: emaTrendNorm,
      rsi: currentRsi,
      ob_imbalance: obImbalance,
      momentum: momNorm,
      volatility: volNorm,
      vwap_deviation: vwapDev,
    },
    recommendation: {
      longPct: Math.max(20, Math.min(80, longPct)),
      shortPct: Math.max(20, Math.min(80, shortPct)),
    },
  }
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

const INDEXER: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

/** Fetch OHLCV candles from DeepBook indexer */
export async function fetchCandles(
  pool: string,
  network: string,
  resolution = 5,
  limit = 50,
): Promise<Candle[]> {
  const res = await fetch(
    `${INDEXER[network]}/ohclv/${pool}?resolution=${resolution}&limit=${limit}`,
  )
  const data: { candles: [number, number, number, number, number, number][] } = await res.json()
  return (data.candles ?? [])
    .map(([ts, open, high, low, close, volume]) => ({ ts, open, high, low, close, volume }))
    .reverse() // oldest first
}

/** Fetch orderbook snapshot */
export async function fetchOrderbookSnapshot(
  pool: string,
  network: string,
  depth = 20,
): Promise<OrderbookSnapshot> {
  const res = await fetch(
    `${INDEXER[network]}/orderbook/${pool}?level=2&depth=${depth * 2}`,
  )
  const data: { bids: [string, string][]; asks: [string, string][] } = await res.json()
  const bids = data.bids.map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
  const asks = data.asks.map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
  const midPrice = bids[0] && asks[0] ? (bids[0].price + asks[0].price) / 2 : 0
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0
  return { bids, asks, midPrice, spread, spreadPct }
}

/** Run full analysis pipeline: fetch data → analyze → return result */
export async function runAnalysis(pool: string, network: string): Promise<AnalysisResult> {
  const [candles, ob] = await Promise.all([
    fetchCandles(pool, network),
    fetchOrderbookSnapshot(pool, network),
  ])
  return analyze(candles, ob)
}
