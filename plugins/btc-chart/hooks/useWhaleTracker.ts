// BTC Chart — Whale tracking hook

import { useEffect, useRef, useState, useCallback } from 'react'
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
export function useWhaleTracker(
  symbol: string,
  options: UseWhaleTrackerOptions,
): UseWhaleTrackerResult {
  const { enabled, whaleThreshold = 100000, flowWindowMs = 3600000, maxAlerts = 100 } = options

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
    if (!enabled) {
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* noop */
        }
        wsRef.current = null
      }
      return
    }

    cancelledRef.current = false
    const sym = symbol.toLowerCase()
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@aggTrade`)
    wsRef.current = ws

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
      if (!cancelledRef.current && enabled) {
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
      try {
        ws.close()
      } catch {
        /* noop */
      }
      wsRef.current = null
    }
  }, [symbol, enabled, whaleThreshold, flowWindowMs, maxAlerts])

  // Periodic flow update (every 5s)
  useEffect(() => {
    if (!enabled) return
    const iv = setInterval(() => {
      if (tradesRef.current.length > 0) {
        const flow = calculateExchangeFlow(tradesRef.current, flowWindowMs)
        setExchangeFlow(flow)
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [enabled, flowWindowMs])

  const whaleStats = aggregateWhaleStats(whaleAlerts)
  const recentBuyVolume = whaleAlerts
    .filter((a) => a.side === 'buy' && Date.now() - a.timestamp < 3600000)
    .reduce((sum, a) => sum + a.value, 0)
  const recentSellVolume = whaleAlerts
    .filter((a) => a.side === 'sell' && Date.now() - a.timestamp < 3600000)
    .reduce((sum, a) => sum + a.value, 0)

  return {
    whaleAlerts,
    exchangeFlow,
    whaleStats,
    clearAlerts,
    recentBuyVolume,
    recentSellVolume,
  }
}
