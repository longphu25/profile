/**
 * Oracle Data Service — shared oracle state accessible by all plugins via suiHostAPI.
 *
 * Fetches and maintains: oracles list, selected oracle state, prices, vault data.
 * Other plugins read via: suiHostAPI.getSharedData('oracleData')
 *
 * This eliminates prop drilling and duplication across tabs/plugins.
 */

import { PREDICT_SERVER, PREDICT_ID } from './types'

export interface OracleData {
  oracles: any[]
  selectedOracle: string | null
  oracleState: any | null
  vaultData: any | null
  prices: any[]
  serverStatus: 'online' | 'offline' | 'checking'
  lastUpdate: number
}

const DEFAULT_DATA: OracleData = {
  oracles: [],
  selectedOracle: null,
  oracleState: null,
  vaultData: null,
  prices: [],
  serverStatus: 'checking',
  lastUpdate: 0,
}

let currentData: OracleData = { ...DEFAULT_DATA }
let hostRef: any = null
let pollInterval: ReturnType<typeof setInterval> | null = null

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function publish() {
  if (hostRef) {
    hostRef.setSharedData('oracleData', { ...currentData })
  }
}

async function refreshOracles() {
  const data = await fetchJSON<any[]>(`/predicts/${PREDICT_ID}/oracles`)
  if (data && Array.isArray(data)) {
    currentData.oracles = data
    if (!currentData.selectedOracle && data.length > 0) {
      const active = data.filter((o) => o.status === 'active' && o.expiry > Date.now())
      currentData.selectedOracle = active[0]?.oracle_id || data[0].oracle_id
    }
  }
}

async function refreshOracleState() {
  if (!currentData.selectedOracle) return
  const data = await fetchJSON<any>(`/oracles/${currentData.selectedOracle}/state`)
  if (data) currentData.oracleState = data
}

async function refreshVault() {
  const data = await fetchJSON<any>(`/predicts/${PREDICT_ID}/vault/summary`)
  if (data) currentData.vaultData = data
}

async function refreshPrices() {
  if (!currentData.selectedOracle) return
  const data = await fetchJSON<any[]>(`/oracles/${currentData.selectedOracle}/prices`)
  if (data && Array.isArray(data)) currentData.prices = data.slice(-50)
}

async function refreshAll() {
  const status = await fetchJSON<{ status: string }>('/status')
  currentData.serverStatus = status ? 'online' : 'offline'
  await Promise.all([refreshOracles(), refreshVault()])
  await Promise.all([refreshOracleState(), refreshPrices()])
  currentData.lastUpdate = Date.now()
  publish()
}

export function selectOracle(oracleId: string) {
  currentData.selectedOracle = oracleId
  refreshOracleState().then(() => refreshPrices().then(publish))
}

export function updatePrice(oracleId: string, spot: number, forward: number) {
  if (oracleId === currentData.selectedOracle && currentData.oracleState) {
    currentData.oracleState = {
      ...currentData.oracleState,
      latest_price: {
        ...currentData.oracleState.latest_price,
        spot,
        forward,
        onchain_timestamp: Date.now(),
      },
    }
    currentData.prices = [
      ...currentData.prices.slice(-49),
      { spot, forward, timestamp: Date.now() },
    ]
    publish()
  }
}

export function updateSVI(oracleId: string, svi: any) {
  if (oracleId === currentData.selectedOracle && currentData.oracleState) {
    currentData.oracleState = {
      ...currentData.oracleState,
      latest_svi: { ...svi, onchain_timestamp: Date.now() },
    }
    publish()
  }
}

export function markSettled(oracleId: string) {
  currentData.oracles = currentData.oracles.map((o) =>
    o.oracle_id === oracleId ? { ...o, status: 'settled' } : o,
  )
  publish()
}

export function initOracleService(host: any) {
  hostRef = host
  host.setSharedData('oracleData', currentData)
  refreshAll()
  // Poll every 60s as fallback (WebSocket handles real-time)
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(refreshAll, 60000)
}

export function destroyOracleService() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  hostRef = null
  currentData = { ...DEFAULT_DATA }
}

export function getOracleData(): OracleData {
  return currentData
}

export function forceRefresh() {
  return refreshAll()
}
