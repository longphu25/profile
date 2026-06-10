/**
 * Standalone DeepBook Oracle Service for predict-club.
 * Does NOT depend on sui-deepbook-predict plugin.
 * Fetches oracle data directly, maintains local state, emits events.
 */

import { MIN_SAFE_EXPIRY_MINUTES } from '../domain/policies'
import type { SVIParams } from '../domain/payoutPreview'

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
  min_strike?: number
  tick_size?: number
  settlement_price: number | null
  latest_price: OraclePrice | null
  latest_svi?: SVIParams | null
}

export interface OracleEntry {
  oracle_id: string
  underlying_asset: string
  expiry: number
  status: string
  min_strike?: number
  tick_size?: number
  settlement_price: number | null
}

export interface ClubOracleSnapshot {
  selectedOracleId: string | null
  selectionMode: 'auto' | 'manual'
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
  selectionMode: 'auto',
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
    const all: OracleEntry[] = oracles.map((o: any) => ({
      oracle_id: o.oracle_id,
      underlying_asset: o.underlying_asset ?? 'BTC/USD',
      expiry: o.expiry,
      status: o.status,
      min_strike: o.min_strike != null ? Number(o.min_strike) : undefined,
      tick_size: o.tick_size != null ? Number(o.tick_size) : undefined,
      settlement_price:
        o.settlement_price != null ? Number(o.settlement_price) / PRICE_SCALE : null,
    }))
    const target = selectBestOracle(all) ?? all[0]
    return {
      oracle: {
        oracle_id: target.oracle_id,
        underlying_asset: target.underlying_asset ?? 'BTC/USD',
        expiry: target.expiry,
        status: target.status,
        min_strike: target.min_strike,
        tick_size: target.tick_size,
        settlement_price:
          target.settlement_price != null ? Number(target.settlement_price) / PRICE_SCALE : null,
        latest_price: null,
        latest_svi: null,
      },
      all,
    }
  } catch {
    return null
  }
}

function selectBestOracle(oracles: OracleEntry[]): OracleEntry | null {
  const now = Date.now()
  const minSafeExpiryMs = MIN_SAFE_EXPIRY_MINUTES * 60_000
  const activeOracles = oracles
    .filter((oracle) => oracle.status === 'active' && oracle.expiry > now)
    .sort((a, b) => a.expiry - b.expiry)

  return (
    activeOracles.find((oracle) => oracle.expiry > now + minSafeExpiryMs) ??
    activeOracles[0] ??
    null
  )
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

function normalizePrice(rawPrice: any): OraclePrice | null {
  if (!rawPrice) return null
  const spot = Number(rawPrice.spot ?? 0) / PRICE_SCALE
  const forward = Number(rawPrice.forward ?? 0) / PRICE_SCALE
  if (!Number.isFinite(spot) || !Number.isFinite(forward) || spot <= 0 || forward <= 0) {
    return null
  }
  return {
    spot,
    forward,
    timestamp: Number(rawPrice.onchain_timestamp ?? rawPrice.checkpoint_timestamp_ms ?? Date.now()),
  }
}

async function fetchPrices(oracleId: string): Promise<OraclePrice[]> {
  try {
    const res = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/prices`)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data
      .slice(0, 50)
      .map(normalizePrice)
      .filter((price): price is OraclePrice => Boolean(price))
  } catch {
    return []
  }
}

function normalizeSVI(rawSVI: any): SVIParams | null {
  if (!rawSVI) return null
  return {
    ...rawSVI,
    a: Number(rawSVI.a ?? 0),
    b: Number(rawSVI.b ?? 0),
    rho: Number(rawSVI.rho ?? 0),
    m: Number(rawSVI.m ?? 0),
    sigma: Number(rawSVI.sigma ?? 0),
    rho_negative: Boolean(rawSVI.rho_negative),
    m_negative: Boolean(rawSVI.m_negative),
    onchain_timestamp: Number(rawSVI.onchain_timestamp ?? Date.now()),
  }
}

async function fetchLatestSVI(oracleId: string): Promise<SVIParams | null> {
  try {
    const latestRes = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/svi/latest`)
    if (latestRes.ok) {
      const latest = normalizeSVI(await latestRes.json())
      if (latest) return latest
    }

    const historyRes = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/svi`)
    if (!historyRes.ok) return null
    const history = await historyRes.json()
    if (!Array.isArray(history) || history.length === 0) return null
    return normalizeSVI(history[history.length - 1])
  } catch {
    return null
  }
}

async function refresh() {
  const result = await fetchActiveOracle()
  if (result) {
    if (!snapshot.selectedOracleId || snapshot.selectionMode === 'auto') {
      snapshot = {
        ...snapshot,
        selectedOracleId: result.oracle.oracle_id,
        oracleState: result.oracle,
        oracles: result.all,
      }
    } else {
      const selectedEntry = result.all.find(
        (oracle) => oracle.oracle_id === snapshot.selectedOracleId,
      )
      snapshot = {
        ...snapshot,
        oracleState:
          snapshot.oracleState ??
          (selectedEntry
            ? {
                oracle_id: selectedEntry.oracle_id,
                underlying_asset: selectedEntry.underlying_asset,
                expiry: selectedEntry.expiry,
                status: selectedEntry.status,
                min_strike: selectedEntry.min_strike,
                tick_size: selectedEntry.tick_size,
                settlement_price: selectedEntry.settlement_price,
                latest_price: null,
                latest_svi: null,
              }
            : snapshot.oracleState),
        oracles: result.all,
      }
    }
  }

  if (!snapshot.selectedOracleId) return

  const oracleId = snapshot.selectedOracleId
  const [state, prices, latestSVIFromHistory] = await Promise.all([
    fetchOracleState(oracleId),
    fetchPrices(oracleId),
    fetchLatestSVI(oracleId),
  ])

  if (state && snapshot.oracleState) {
    const stateOracle = (state as any).oracle
    const rawPrice = (state as any).latest_price
    const rawSVI = (state as any).latest_svi
    const latestPrice: OraclePrice | null =
      normalizePrice(rawPrice) ?? prices[0] ?? snapshot.oracleState.latest_price
    const latestSVI: SVIParams | null =
      normalizeSVI(rawSVI) ?? latestSVIFromHistory ?? snapshot.oracleState.latest_svi ?? null

    snapshot = {
      ...snapshot,
      oracleState: {
        ...snapshot.oracleState,
        oracle_id: stateOracle?.oracle_id ?? snapshot.oracleState.oracle_id,
        underlying_asset: stateOracle?.underlying_asset ?? snapshot.oracleState.underlying_asset,
        expiry: Number(stateOracle?.expiry ?? snapshot.oracleState.expiry),
        status: stateOracle?.status ?? snapshot.oracleState.status,
        min_strike:
          stateOracle?.min_strike != null
            ? Number(stateOracle.min_strike)
            : snapshot.oracleState.min_strike,
        tick_size:
          stateOracle?.tick_size != null
            ? Number(stateOracle.tick_size)
            : snapshot.oracleState.tick_size,
        settlement_price:
          stateOracle?.settlement_price != null
            ? Number(stateOracle.settlement_price) / PRICE_SCALE
            : snapshot.oracleState.settlement_price,
        latest_price: latestPrice,
        latest_svi: latestSVI,
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
        } else if (type.includes('OracleSVIUpdated')) {
          if (snapshot.oracleState) {
            const latestSVI = normalizeSVI(parsed)
            snapshot = {
              ...snapshot,
              oracleState: {
                ...snapshot.oracleState,
                latest_svi: latestSVI ?? snapshot.oracleState.latest_svi,
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

export function selectOracle(oracleId: string): boolean {
  const selectedEntry = snapshot.oracles.find((oracle) => oracle.oracle_id === oracleId)
  if (!selectedEntry) return false

  snapshot = {
    ...snapshot,
    selectedOracleId: selectedEntry.oracle_id,
    selectionMode: 'manual',
    oracleState: {
      oracle_id: selectedEntry.oracle_id,
      underlying_asset: selectedEntry.underlying_asset,
      expiry: selectedEntry.expiry,
      status: selectedEntry.status,
      min_strike: selectedEntry.min_strike,
      tick_size: selectedEntry.tick_size,
      settlement_price: selectedEntry.settlement_price,
      latest_price: null,
      latest_svi: null,
    },
    prices: [],
    lastUpdateMs: 0,
    isHealthy: false,
  }
  emit()
  refresh()
  return true
}

export function selectAutoOracle() {
  snapshot = {
    ...snapshot,
    selectedOracleId: null,
    selectionMode: 'auto',
    oracleState: null,
    prices: [],
    lastUpdateMs: 0,
    isHealthy: false,
  }
  emit()
  refresh()
}

export function startOracleService() {
  refresh()
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(refresh, 60_000)
  connectWS()
}

let fastPollTimer: ReturnType<typeof setInterval> | null = null

/**
 * Enable fast polling (every 3s) for live quick rounds.
 * Call stopFastPoll() when the round ends.
 */
export function startFastPoll() {
  if (fastPollTimer) return
  fastPollTimer = setInterval(refresh, 3_000)
}

export function stopFastPoll() {
  if (fastPollTimer) {
    clearInterval(fastPollTimer)
    fastPollTimer = null
  }
}

export function stopOracleService() {
  stopFastPoll()
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
    selectionMode: 'auto',
    oracleState: null,
    oracles: [],
    prices: [],
    lastUpdateMs: 0,
    isHealthy: false,
  }
  listeners.clear()
}
