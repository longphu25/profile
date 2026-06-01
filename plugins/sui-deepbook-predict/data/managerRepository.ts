import type { ManagerPortfolioSnapshot, ManagerRecord } from '../domain/types'
import { netOpenRanges } from '../domain/positions'
import { fetchPredictJSON } from './predictRepository'

export async function getManagers(): Promise<ManagerRecord[]> {
  const data = await fetchPredictJSON<ManagerRecord[]>('/managers')
  return Array.isArray(data) ? data : []
}

export async function getManagersByOwner(owner: string): Promise<ManagerRecord[]> {
  const managers = await getManagers()
  return managers.filter((manager) => manager.owner === owner)
}

export async function getManagerSummary(
  managerId: string,
): Promise<Record<string, unknown> | null> {
  return fetchPredictJSON<Record<string, unknown>>(`/managers/${managerId}/summary`)
}

export async function getManagerPositions(managerId: string): Promise<Record<string, unknown>[]> {
  const data = await fetchPredictJSON<Record<string, unknown>[]>(
    `/managers/${managerId}/positions/summary`,
  )
  return Array.isArray(data) ? data : []
}

export async function getManagerMintedRanges(
  managerId: string,
): Promise<Record<string, unknown>[]> {
  const data = await fetchPredictJSON<Record<string, unknown>[]>(
    `/ranges/minted?manager_id=${managerId}`,
  )
  return Array.isArray(data) ? data : []
}

export async function getManagerRedeemedRanges(
  managerId: string,
): Promise<Record<string, unknown>[]> {
  const data = await fetchPredictJSON<Record<string, unknown>[]>(
    `/ranges/redeemed?manager_id=${managerId}`,
  )
  return Array.isArray(data) ? data : []
}

export async function getManagerPnl(
  managerId: string,
): Promise<{ points?: Record<string, unknown>[] } | null> {
  return fetchPredictJSON<{ points?: Record<string, unknown>[] }>(
    `/managers/${managerId}/pnl?range=ALL`,
  )
}

export async function getPortfolioSnapshot(
  managerIds: string[],
): Promise<ManagerPortfolioSnapshot> {
  const results = await Promise.all(
    managerIds.map(async (managerId) => {
      const [summary, positions, mintedRanges, redeemedRanges, pnl] = await Promise.all([
        getManagerSummary(managerId),
        getManagerPositions(managerId),
        getManagerMintedRanges(managerId),
        getManagerRedeemedRanges(managerId),
        getManagerPnl(managerId),
      ])
      return { summary, positions, mintedRanges, redeemedRanges, pnl }
    }),
  )

  let summary: Record<string, unknown> | null = null
  let positions: Record<string, unknown>[] = []
  let mintedRanges: Record<string, unknown>[] = []
  let redeemedRanges: Record<string, unknown>[] = []
  let pnlPoints: Record<string, unknown>[] = []

  for (const result of results) {
    if (result.summary && !summary) {
      summary = { ...result.summary }
    } else if (result.summary && summary) {
      summary.account_value =
        Number(summary.account_value || 0) + Number(result.summary.account_value || 0)
      summary.trading_balance =
        Number(summary.trading_balance || 0) + Number(result.summary.trading_balance || 0)
      summary.unrealized_pnl =
        Number(summary.unrealized_pnl || 0) + Number(result.summary.unrealized_pnl || 0)
      summary.realized_pnl =
        Number(summary.realized_pnl || 0) + Number(result.summary.realized_pnl || 0)
      summary.open_positions =
        Number(summary.open_positions || 0) + Number(result.summary.open_positions || 0)
    }

    positions = positions.concat(result.positions)
    mintedRanges = mintedRanges.concat(result.mintedRanges)
    redeemedRanges = redeemedRanges.concat(result.redeemedRanges)
    if (result.pnl?.points) pnlPoints = pnlPoints.concat(result.pnl.points)
  }

  return {
    summary,
    positions: positions.filter((position) => Number(position.open_quantity) > 0),
    ranges: netOpenRanges(mintedRanges, redeemedRanges),
    pnlPoints,
  }
}
