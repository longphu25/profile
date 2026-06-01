import { PREDICT_ID, PREDICT_SERVER } from '../domain/constants'
import type { OracleEntry, PerformancePoint, SVIParams, VaultSummary } from '../domain/types'

export async function fetchPredictJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getServerStatus(): Promise<'online' | 'offline'> {
  const data = await fetchPredictJSON<{ status: string }>('/status')
  return data ? 'online' : 'offline'
}

export async function getOracles(predictId = PREDICT_ID): Promise<OracleEntry[]> {
  const data = await fetchPredictJSON<OracleEntry[]>(`/predicts/${predictId}/oracles`)
  return Array.isArray(data) ? data : []
}

export async function getOracleState(oracleId: string): Promise<Record<string, unknown> | null> {
  return fetchPredictJSON<Record<string, unknown>>(`/oracles/${oracleId}/state`)
}

export async function getOraclePrices(
  oracleId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const data = await fetchPredictJSON<Record<string, unknown>[]>(`/oracles/${oracleId}/prices`)
  return Array.isArray(data) ? data.slice(-limit) : []
}

export async function getOracleSVIHistory(oracleId: string): Promise<SVIParams[]> {
  const data = await fetchPredictJSON<SVIParams[]>(`/oracles/${oracleId}/svi`)
  return Array.isArray(data) ? data : []
}

export async function getVaultSummary(predictId = PREDICT_ID): Promise<VaultSummary | null> {
  return fetchPredictJSON<VaultSummary>(`/predicts/${predictId}/vault/summary`)
}

export async function getVaultPerformance(predictId = PREDICT_ID): Promise<{
  points?: PerformancePoint[]
} | null> {
  return fetchPredictJSON<{ points?: PerformancePoint[] }>(
    `/predicts/${predictId}/vault/performance?range=ALL`,
  )
}
