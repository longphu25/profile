/**
 * Standalone DeepBook Oracle Service for predict-club.
 * Does NOT depend on sui-deepbook-predict plugin.
 * Fetches oracle data directly, maintains local state, emits events.
 */

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PRICE_SCALE = 1e9

export interface OraclePrice {
  spot: number
  forward: number
  timestamp: number
}

export interface OracleState {
  oracle_id: string
  underlying_asset: string
  expiry: number
  status: string
  settlement_price: number | null
  latest_price: OraclePrice | null
}

export interface OracleEntry {
  oracle_id: string
  underlying_asset: string
  expiry: number
  status: string
  settlement_price: number | null
}

export interface ClubOracleSnapshot {
  selectedOracleId: string | null
  oracleState: OracleState | null
  oracles: OracleEntry[]
  prices: OraclePrice[]
  lastUpdateMs: number
  isHealthy: boolean
}

type Listener = (snapshot: ClubOracleSnapshot) => void

const STALE_THRESHOLD_MS = 60_000
const WS_URL = 'wss://fullnode.testnet.sui.io:443'

let snapshot: ClubOracleSnapshot = {
  selectedOracleId: null,
  oracleState: null,
  oracles: [],
  prices: [],
  lastUpdateMs: 0,
  isHealthy: false,
}

const listeners = new Set<Listener>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

function emit() {
  for (const fn of listeners) fn({ ...snapshot })
}

function updateHealth() {
  snapshot = {
    ...snapshot,
    isHealthy: snapshot.lastUpdateMs > 0 && Date.now() - snapshot.lastUpdateMs < STALE_THRESHOLD_MS,
  }
}

async function fetchActiveOracle(): Promise<{ oracle: OracleState; all: OracleEntry[] } | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}/predicts/${PREDICT_ID}/oracles`)
    if (!res.ok) return null
    const oracles = await res.json()
    if (!Array.isArray(oracles) || oracles.length === 0) return null
    const active = oracles.find((o: any) => o.status === 'active' && o.expiry > Date.now())
    const target = active ?? oracles[0]
    const all: OracleEntry[] = oracles.map((o: any) => ({
      oracle_id: o.oracle_id,
      underlying_asset: o.underlying_asset ?? 'BTC/USD',
      expiry: o.expiry,
      status: o.status,
      settlement_price:
        o.settlement_price != null ? Number(o.settlement_price) / PRICE_SCALE : null,
    }))
    return {
      oracle: {
        oracle_id: target.oracle_id,
        underlying_asset: target.underlying_asset ?? 'BTC/USD',
        expiry: target.expiry,
        status: target.status,
        settlement_price:
          target.settlement_price != null ? Number(target.settlement_price) / PRICE_SCALE : null,
        latest_price: null,
      },
      all,
    }
  } catch {
    return null
  }
}

async function fetchOracleState(oracleId: string): Promise<Partial<OracleState> | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/state`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchPrices(oracleId: string): Promise<OraclePrice[]> {
  try {
    const res = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/prices`)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(-50).map((p: any) => ({
      spot: Number(p.spot ?? 0) / PRICE_SCALE,
      forward: Number(p.forward ?? 0) / PRICE_SCALE,
      timestamp: Number(p.onchain_timestamp ?? Date.now()),
    }))
  } catch {
    return []
  }
}

async function refresh() {
  if (!snapshot.selectedOracleId) {
    const result = await fetchActiveOracle()
    if (!result) return
    snapshot = {
      ...snapshot,
      selectedOracleId: result.oracle.oracle_id,
      oracleState: result.oracle,
      oracles: result.all,
    }
  }

  const oracleId = snapshot.selectedOracleId!
  const [state, prices] = await Promise.all([fetchOracleState(oracleId), fetchPrices(oracleId)])

  if (state && snapshot.oracleState) {
    const rawPrice = (state as any).latest_price
    const latestPrice: OraclePrice | null = rawPrice
      ? {
          spot: Number(rawPrice.spot ?? 0) / PRICE_SCALE,
          forward: Number(rawPrice.forward ?? 0) / PRICE_SCALE,
          timestamp: Number(rawPrice.onchain_timestamp ?? Date.now()),
        }
      : snapshot.oracleState.latest_price

    snapshot = {
      ...snapshot,
      oracleState: {
        ...snapshot.oracleState,
        ...(state as Partial<OracleState>),
        latest_price: latestPrice,
      },
      prices: prices.length > 0 ? prices : snapshot.prices,
      lastUpdateMs: Date.now(),
    }
  }

  updateHealth()
  emit()
}

// ── WebSocket for real-time events ─────────────────────────────────────────────

function connectWS() {
  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      ws!.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_subscribeEvent',
          params: [{ MoveEventModule: { package: PREDICT_PACKAGE, module: 'oracle' } }],
        }),
      )
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        const parsed = msg?.params?.result?.parsedJson
        if (!parsed) return
        const oracleId = parsed.oracle_id ?? ''
        if (oracleId !== snapshot.selectedOracleId) return

        const type: string = msg.params.result.type ?? ''

        if (type.includes('OraclePricesUpdated')) {
          const price: OraclePrice = {
            spot: Number(parsed.spot ?? 0) / PRICE_SCALE,
            forward: Number(parsed.forward ?? 0) / PRICE_SCALE,
            timestamp: Date.now(),
          }
          if (snapshot.oracleState) {
            snapshot = {
              ...snapshot,
              oracleState: { ...snapshot.oracleState, latest_price: price },
              prices: [...snapshot.prices.slice(-49), price],
              lastUpdateMs: Date.now(),
            }
            updateHealth()
            emit()
          }
        } else if (type.includes('OracleSettled')) {
          const settlementPrice = Number(parsed.settlement_price ?? 0) / PRICE_SCALE
          if (snapshot.oracleState) {
            snapshot = {
              ...snapshot,
              oracleState: {
                ...snapshot.oracleState,
                status: 'settled',
                settlement_price: settlementPrice,
              },
              lastUpdateMs: Date.now(),
            }
            updateHealth()
            emit()
          }
        }
      } catch {
        /* ignore */
      }
    }

    ws.onclose = () => {
      ws = null
      wsReconnectTimer = setTimeout(connectWS, 5000)
    }

    ws.onerror = () => ws?.close()
  } catch {
    wsReconnectTimer = setTimeout(connectWS, 5000)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSnapshot(): ClubOracleSnapshot {
  return snapshot
}

export function subscribeOracle(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function startOracleService() {
  refresh()
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(refresh, 60_000)
  connectWS()
}

export function stopOracleService() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
  snapshot = {
    selectedOracleId: null,
    oracleState: null,
    oracles: [],
    prices: [],
    lastUpdateMs: 0,
    isHealthy: false,
  }
  listeners.clear()
}
