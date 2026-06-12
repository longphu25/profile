/**
 * Binance reference spot stream — OPTIONAL reference price for Oracle Flow.
 *
 * Infrastructure layer. Provides a lightweight BTCUSDT spot feed used ONLY as a
 * visual reference overlay (not the primary oracle data). Subscribers opt in;
 * the WebSocket only connects while at least one subscriber is active.
 *
 * - No CORS issues (browser WebSocket is exempt).
 * - Exponential backoff reconnect, capped.
 * - Lazy connect / auto-disconnect when the last subscriber leaves.
 */

export interface BinanceRefPoint {
  /** Unix seconds */
  time: number
  /** Spot close price (USD) */
  price: number
}

type Listener = (point: BinanceRefPoint) => void

const WS_URL = 'wss://fstream.binance.com/ws/btcusdt@kline_1m'
const REST_KLINES_URL =
  'https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=60'
const MAX_RECONNECTS = 5

const listeners = new Set<Listener>()
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let lastPoint: BinanceRefPoint | null = null

function emit(point: BinanceRefPoint): void {
  lastPoint = point
  for (const fn of listeners) fn(point)
}

function connect(): void {
  if (ws) return
  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      reconnectAttempts = 0
    }

    ws.onmessage = (ev) => {
      try {
        const k = JSON.parse(ev.data).k
        if (!k) return
        emit({ time: Math.floor(k.t / 1000), price: Number(k.c) })
      } catch {
        /* ignore malformed frame */
      }
    }

    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }

    ws.onerror = () => ws?.close()
  } catch {
    scheduleReconnect()
  }
}

function scheduleReconnect(): void {
  // Only reconnect while someone is still listening.
  if (listeners.size === 0) return
  if (reconnectAttempts >= MAX_RECONNECTS) return
  const delay = Math.min(30_000, 5_000 * 2 ** reconnectAttempts)
  reconnectAttempts++
  reconnectTimer = setTimeout(connect, delay)
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = 0
  if (ws) {
    ws.onclose = null
    ws.onerror = null
    ws.close()
    ws = null
  }
}

/**
 * Fetch recent 1m close history so the reference line has multiple points
 * immediately. The live WS only changes the current minute's candle, so without
 * seeding the chart would have a single point and draw nothing.
 */
export async function fetchBinanceRefHistory(): Promise<BinanceRefPoint[]> {
  try {
    const res = await fetch(REST_KLINES_URL)
    if (!res.ok) return []
    const rows = (await res.json()) as unknown[]
    if (!Array.isArray(rows)) return []
    // Binance kline row: [openTime, open, high, low, close, ...]
    return rows
      .map((r) => {
        const row = r as [number, string, string, string, string]
        return { time: Math.floor(Number(row[0]) / 1000), price: Number(row[4]) }
      })
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.price))
  } catch {
    return []
  }
}

/**
 * Subscribe to the Binance reference spot stream.
 * Connects lazily on first subscriber, disconnects when the last one leaves.
 * Returns an unsubscribe function.
 */
export function subscribeBinanceRef(fn: Listener): () => void {
  listeners.add(fn)
  if (lastPoint) fn(lastPoint)
  if (listeners.size === 1) connect()

  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) disconnect()
  }
}

/** Latest reference point, if any (cached across subscribers). */
export function getLastBinanceRef(): BinanceRefPoint | null {
  return lastPoint
}
