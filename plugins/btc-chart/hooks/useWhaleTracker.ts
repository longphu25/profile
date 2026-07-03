// BTC Chart — Whale tracking hook

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { WHALE_TRACKER_ENABLED } from '../lib/feature-flags'
import { closeWebSocketSafe } from '../lib/chart-websocket'
import { TICKER_REFRESH_MS } from '../lib/constants'
import {
  detectWhaleTrade,
  calculateExchangeFlow,
  aggregateWhaleStats,
  type WhaleAlert,
  type ExchangeFlow,
  type WhaleStats,
} from '../lib/whale'

interface Trade {
  price: number
  quantity: number
  isBuyerMaker: boolean
  timestamp: number
}

interface UseWhaleTrackerOptions {
  enabled: boolean
  whaleThreshold?: number
  flowWindowMs?: number
  maxAlerts?: number
}

interface UseWhaleTrackerResult {
  whaleAlerts: WhaleAlert[]
  exchangeFlow: ExchangeFlow | null
  whaleStats: WhaleStats
  clearAlerts: () => void
  recentBuyVolume: number
  recentSellVolume: number
}

/**
 * Hook to track whale trades and exchange flow from Binance aggTrades stream.
 * Connects to Binance's aggregated trades WebSocket and detects large trades.
 */
const EMPTY_WHALE_STATS: WhaleStats = {
  totalBuyVolume: 0,
  totalSellVolume: 0,
  netFlow: 0,
  largeTradeCount: 0,
  avgTradeSize: 0,
  whaleAlerts: [],
}

export function useWhaleTracker(
  symbol: string,
  options: UseWhaleTrackerOptions,
): UseWhaleTrackerResult {
  const { enabled, whaleThreshold = 100000, flowWindowMs = 3600000, maxAlerts = 100 } = options
  const trackerActive = WHALE_TRACKER_ENABLED && enabled

  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([])
  const [exchangeFlow, setExchangeFlow] = useState<ExchangeFlow | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const tradesRef = useRef<Trade[]>([])
  const cancelledRef = useRef(false)

  const clearAlerts = useCallback(() => {
    setWhaleAlerts([])
    tradesRef.current = []
  }, [])

  useEffect(() => {
    if (!trackerActive) {
      if (wsRef.current) {
        closeWebSocketSafe(wsRef.current)
        wsRef.current = null
      }
      return
    }

    cancelledRef.current = false
    const sym = symbol.toLowerCase()
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@aggTrade`)
    wsRef.current = ws

    ws.onopen = () => {
      if (cancelledRef.current) closeWebSocketSafe(ws)
    }

    ws.onmessage = (ev) => {
      if (cancelledRef.current) return
      const d = JSON.parse(ev.data)
      const price = +d.p
      const quantity = +d.q
      const isBuyerMaker = d.m
      const timestamp = d.T

      // Store trade for flow calculation
      tradesRef.current.push({ price, quantity, isBuyerMaker, timestamp })

      // Keep only trades within the flow window
      const cutoff = Date.now() - flowWindowMs
      tradesRef.current = tradesRef.current.filter((t) => t.timestamp >= cutoff)

      // Detect whale trade
      const alert = detectWhaleTrade(price, quantity, isBuyerMaker, whaleThreshold)
      if (alert) {
        setWhaleAlerts((prev) => {
          const next = [alert, ...prev]
          return next.slice(0, maxAlerts)
        })
      }

      // Update exchange flow every 5 seconds to avoid excessive re-renders
      if (tradesRef.current.length % 50 === 0) {
        const flow = calculateExchangeFlow(tradesRef.current, flowWindowMs)
        setExchangeFlow(flow)
      }
    }

    ws.onerror = () => {
      /* silent */
    }
    ws.onclose = () => {
      if (!cancelledRef.current && trackerActive) {
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (!cancelledRef.current) {
            // Trigger re-render by toggling enabled - parent effect will reconnect
          }
        }, 3000)
      }
    }

    return () => {
      cancelledRef.current = true
      closeWebSocketSafe(ws)
      wsRef.current = null
    }
  }, [symbol, trackerActive, whaleThreshold, flowWindowMs, maxAlerts])

  // Periodic flow update (every 5s)
  useEffect(() => {
    if (!trackerActive) return
    const iv = setInterval(() => {
      if (tradesRef.current.length > 0) {
        const flow = calculateExchangeFlow(tradesRef.current, flowWindowMs)
        setExchangeFlow(flow)
      }
    }, TICKER_REFRESH_MS)
    return () => clearInterval(iv)
  }, [trackerActive, flowWindowMs])

  const whaleStats = useMemo(
    () => (trackerActive ? aggregateWhaleStats(whaleAlerts) : EMPTY_WHALE_STATS),
    [trackerActive, whaleAlerts],
  )
  const recentBuyVolume = useMemo(() => {
    if (!trackerActive) return 0
    return whaleAlerts
      .filter((a) => a.side === 'buy' && Date.now() - a.timestamp < 3600000)
      .reduce((sum, a) => sum + a.value, 0)
  }, [trackerActive, whaleAlerts])
  const recentSellVolume = useMemo(() => {
    if (!trackerActive) return 0
    return whaleAlerts
      .filter((a) => a.side === 'sell' && Date.now() - a.timestamp < 3600000)
      .reduce((sum, a) => sum + a.value, 0)
  }, [trackerActive, whaleAlerts])

  return {
    whaleAlerts,
    exchangeFlow,
    whaleStats,
    clearAlerts,
    recentBuyVolume,
    recentSellVolume,
  }
}
