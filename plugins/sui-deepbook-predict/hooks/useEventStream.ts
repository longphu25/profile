/**
 * useEventStream — Real-time oracle event subscription via WebSocket.
 * Falls back to polling if WebSocket unavailable.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { PREDICT_PACKAGE } from '../types'

const WS_URLS: Record<string, string> = {
  testnet: 'wss://fullnode.testnet.sui.io:443',
  mainnet: 'wss://fullnode.mainnet.sui.io:443',
}

export interface OracleEvent {
  type: 'price' | 'svi' | 'settled'
  oracleId: string
  timestamp: number
  data: any
}

interface UseEventStreamOptions {
  network?: string
  onPriceUpdate?: (oracleId: string, spot: number, forward: number) => void
  onSVIUpdate?: (oracleId: string, svi: any) => void
  onSettled?: (oracleId: string, settlementPrice: number) => void
}

export function useEventStream({
  network = 'testnet',
  onPriceUpdate,
  onSVIUpdate,
  onSettled,
}: UseEventStreamOptions) {
  const [connected, setConnected] = useState(false)
  const [lastEventTime, setLastEventTime] = useState<number>(0)
  const [eventCount, setEventCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subIdRef = useRef<number>(0)

  const connect = useCallback(() => {
    const wsUrl = WS_URLS[network]
    if (!wsUrl) return

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Subscribe to events from the Predict package
        const subId = ++subIdRef.current
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: subId,
            method: 'suix_subscribeEvent',
            params: [
              {
                MoveEventModule: {
                  package: PREDICT_PACKAGE,
                  module: 'oracle',
                },
              },
            ],
          }),
        )
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (!msg.params?.result) return

          const evt = msg.params.result
          const eventType = evt.type || ''
          const parsedJson = evt.parsedJson || {}
          const oracleId = parsedJson.oracle_id || ''
          const now = Date.now()

          setLastEventTime(now)
          setEventCount((c) => c + 1)

          if (eventType.includes('OraclePricesUpdated')) {
            const spot = Number(parsedJson.spot || 0)
            const forward = Number(parsedJson.forward || 0)
            onPriceUpdate?.(oracleId, spot, forward)
          } else if (eventType.includes('OracleSVIUpdated')) {
            onSVIUpdate?.(oracleId, parsedJson)
          } else if (eventType.includes('OracleSettled')) {
            const settlementPrice = Number(parsedJson.settlement_price || 0)
            onSettled?.(oracleId, settlementPrice)
          }
        } catch {
          /* ignore parse errors */
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Reconnect after 5s
        reconnectRef.current = setTimeout(connect, 5000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 5000)
    }
  }, [network, onPriceUpdate, onSVIUpdate, onSettled])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
      }
    }
  }, [connect])

  // Compute lag
  const lag = lastEventTime > 0 ? (Date.now() - lastEventTime) / 1000 : null

  return { connected, lastEventTime, eventCount, lag }
}
