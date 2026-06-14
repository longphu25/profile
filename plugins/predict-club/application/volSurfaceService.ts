import type { SVIParams } from '../domain/payoutPreview'
import type { SurfaceColumnInput, SurfaceGrid } from '../domain/volSurface'
import {
  getSnapshot,
  subscribeOracle,
  type ClubOracleSnapshot,
  type OracleEntry,
} from '../infrastructure/deepbookOracleService'
import { DEFAULT_SAMPLE_CONFIG, type SampleConfig, sampleVolSurface } from './sampleVolSurface'

/**
 * Volatility-surface service (plan 23, S1).
 *
 * Turns the live oracle list into a strike x expiry IV surface. For each live
 * oracle it fetches that oracle's latest SVI + forward (the expiry axis the base
 * oracle service does NOT fan out - it only tracks the one selected oracle), then
 * runs the pure `sampleVolSurface` builder. Exposes a subscribe/snapshot pattern
 * mirroring `deepbookOracleService` so the Studio can consume it the same way.
 *
 * The mispricing layer (S3) and arb-free checker (S4) decorate this snapshot;
 * they do not change how the IV grid is built.
 */

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
const PRICE_SCALE = 1e9
const REFRESH_INTERVAL_MS = 60_000
// Bound the fan-out: only sample this many nearest-expiry live oracles at once.
const MAX_COLUMNS = 6

export interface VolSurfaceSnapshot {
  grid: SurfaceGrid
  /** True once at least one fan-out pass has completed (so the UI can tell empty from loading). */
  loaded: boolean
  lastUpdateMs: number
}

type Listener = (snapshot: VolSurfaceSnapshot) => void

let snapshot: VolSurfaceSnapshot = {
  grid: { strikes: [], columns: [], ivRange: null, sampledAtMs: 0 },
  loaded: false,
  lastUpdateMs: 0,
}

const listeners = new Set<Listener>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let oracleUnsub: (() => void) | null = null
let inFlight = false
let sampleConfig: SampleConfig = DEFAULT_SAMPLE_CONFIG
// Track the live oracle-id set so an oracle emit only re-samples when the set of
// expiries actually changes (a new oracle rolled in), not on every price tick.
let lastOracleKey = ''

function emit() {
  for (const fn of listeners) fn(snapshot)
}

function liveOracles(oracleSnapshot: ClubOracleSnapshot): OracleEntry[] {
  const now = Date.now()
  return oracleSnapshot.oracles
    .filter((o) => o.status === 'active' && o.expiry > now)
    .sort((a, b) => a.expiry - b.expiry)
    .slice(0, MAX_COLUMNS)
}

function normalizeSVI(raw: unknown): SVIParams | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const svi: SVIParams = {
    a: Number(r.a ?? 0),
    b: Number(r.b ?? 0),
    rho: Number(r.rho ?? 0),
    rho_negative: Boolean(r.rho_negative),
    m: Number(r.m ?? 0),
    m_negative: Boolean(r.m_negative),
    sigma: Number(r.sigma ?? 0),
    onchain_timestamp: Number(r.onchain_timestamp ?? Date.now()),
  }
  return svi
}

async function fetchColumnSVI(oracleId: string): Promise<SVIParams | null> {
  try {
    const latest = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/svi/latest`)
    if (latest.ok) {
      const svi = normalizeSVI(await latest.json())
      if (svi) return svi
    }
    const history = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/svi`)
    if (!history.ok) return null
    const rows = await history.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    return normalizeSVI(rows[rows.length - 1])
  } catch {
    return null
  }
}

async function fetchColumnForward(oracleId: string): Promise<number | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/state`)
    if (!res.ok) return null
    const state = (await res.json()) as Record<string, unknown>
    const price = state.latest_price as Record<string, unknown> | null | undefined
    if (!price) return null
    const forward = Number(price.forward ?? 0) / PRICE_SCALE
    if (!Number.isFinite(forward) || forward <= 0) {
      const spot = Number(price.spot ?? 0) / PRICE_SCALE
      return Number.isFinite(spot) && spot > 0 ? spot : null
    }
    return forward
  } catch {
    return null
  }
}

async function refresh() {
  if (inFlight) return
  inFlight = true
  try {
    const oracleSnapshot = getSnapshot()
    const targets = liveOracles(oracleSnapshot)
    lastOracleKey = targets.map((o) => o.oracle_id).join(',')
    if (targets.length === 0) {
      snapshot = {
        grid: { strikes: [], columns: [], ivRange: null, sampledAtMs: Date.now() },
        loaded: true,
        lastUpdateMs: Date.now(),
      }
      emit()
      return
    }

    // Fan out SVI + forward per oracle in parallel (bounded by MAX_COLUMNS).
    const inputs: SurfaceColumnInput[] = await Promise.all(
      targets.map(async (oracle) => {
        const [svi, forward] = await Promise.all([
          fetchColumnSVI(oracle.oracle_id),
          fetchColumnForward(oracle.oracle_id),
        ])
        return {
          oracleId: oracle.oracle_id,
          expiryMs: oracle.expiry,
          forward: forward ?? 0,
          svi,
        }
      }),
    )

    const grid = sampleVolSurface(inputs, Date.now(), sampleConfig)
    snapshot = { grid, loaded: true, lastUpdateMs: Date.now() }
    emit()
  } finally {
    inFlight = false
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getVolSurfaceSnapshot(): VolSurfaceSnapshot {
  return snapshot
}

export function subscribeVolSurface(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function startVolSurfaceService() {
  refresh()
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(refresh, REFRESH_INTERVAL_MS)
  // Re-sample only when the set of live expiries changes (a new oracle rolled
  // in), not on every price tick - otherwise each oracle emit storms the fan-out.
  if (!oracleUnsub) {
    oracleUnsub = subscribeOracle((oracleSnapshot) => {
      const key = liveOracles(oracleSnapshot)
        .map((o) => o.oracle_id)
        .join(',')
      if (key !== lastOracleKey) refresh()
    })
  }
}

export function stopVolSurfaceService() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (oracleUnsub) {
    oracleUnsub()
    oracleUnsub = null
  }
  snapshot = {
    grid: { strikes: [], columns: [], ivRange: null, sampledAtMs: 0 },
    loaded: false,
    lastUpdateMs: 0,
  }
}
