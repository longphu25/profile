// BTC Chart — Whale tracking and exchange flow analysis

export interface WhaleAlert {
  id: string
  timestamp: number
  symbol: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  value: number
  exchange?: string
}

export interface ExchangeFlow {
  timestamp: number
  symbol: string
  exchangeInflow: number
  exchangeOutflow: number
  netFlow: number
  largeTrades: number
}

export interface WhaleStats {
  totalBuyVolume: number
  totalSellVolume: number
  netFlow: number
  largeTradeCount: number
  avgTradeSize: number
  whaleAlerts: WhaleAlert[]
}

/**
 * Detect whale trades from Binance aggTrades stream
 * Threshold: trades > $100k USD value
 */
export function detectWhaleTrade(
  price: number,
  quantity: number,
  isBuyerMaker: boolean,
  threshold = 100000,
): WhaleAlert | null {
  const value = price * quantity
  if (value < threshold) return null

  return {
    id: `whale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    symbol: 'BTC',
    side: isBuyerMaker ? 'sell' : 'buy',
    amount: quantity,
    price,
    value,
    exchange: 'Binance',
  }
}

/**
 * Calculate exchange flow metrics from recent trades
 * Positive netFlow = more outflow (bullish)
 * Negative netFlow = more inflow (bearish)
 */
export function calculateExchangeFlow(
  trades: Array<{ price: number; quantity: number; isBuyerMaker: boolean; timestamp: number }>,
  windowMs = 3600000,
): ExchangeFlow {
  const now = Date.now()
  const cutoff = now - windowMs

  // Filter trades within window and >$10k value
  const filtered = trades.filter((t) => {
    const value = t.price * t.quantity
    return value > 10000 && t.timestamp >= cutoff
  })

  let inflow = 0
  let outflow = 0
  let largeTradeCount = 0

  for (const trade of filtered) {
    const value = trade.price * trade.quantity
    if (trade.isBuyerMaker) {
      // Sell = inflow to exchange
      inflow += value
    } else {
      // Buy = outflow from exchange
      outflow += value
    }
    if (value > 100000) largeTradeCount++
  }

  return {
    timestamp: now,
    symbol: 'BTC',
    exchangeInflow: inflow,
    exchangeOutflow: outflow,
    netFlow: outflow - inflow,
    largeTrades: largeTradeCount,
  }
}

/**
 * Aggregate whale statistics from alerts
 */
export function aggregateWhaleStats(alerts: WhaleAlert[]): WhaleStats {
  const buyAlerts = alerts.filter((a) => a.side === 'buy')
  const sellAlerts = alerts.filter((a) => a.side === 'sell')

  const totalBuyVolume = buyAlerts.reduce((sum, a) => sum + a.value, 0)
  const totalSellVolume = sellAlerts.reduce((sum, a) => sum + a.value, 0)

  return {
    totalBuyVolume,
    totalSellVolume,
    netFlow: totalBuyVolume - totalSellVolume,
    largeTradeCount: alerts.length,
    avgTradeSize: alerts.length > 0 ? (totalBuyVolume + totalSellVolume) / alerts.length : 0,
    whaleAlerts: alerts,
  }
}

/**
 * Format large numbers for display
 */
export function formatWhaleValue(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

/**
 * Determine whale sentiment from net flow
 */
export function getWhaleSentiment(netFlow: number): {
  label: string
  tone: 'bullish' | 'bearish' | 'neutral'
  color: string
} {
  if (netFlow > 5000000) {
    return { label: 'Strong Buy', tone: 'bullish', color: '#34d8a4' }
  }
  if (netFlow > 1000000) {
    return { label: 'Buy', tone: 'bullish', color: '#34d8a4' }
  }
  if (netFlow < -5000000) {
    return { label: 'Strong Sell', tone: 'bearish', color: '#ff7a85' }
  }
  if (netFlow < -1000000) {
    return { label: 'Sell', tone: 'bearish', color: '#ff7a85' }
  }
  return { label: 'Neutral', tone: 'neutral', color: '#888' }
}
