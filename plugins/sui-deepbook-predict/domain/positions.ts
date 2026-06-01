import type { PositionOverlay, PositionOverlayStatus } from './types'

type RangeLike = Record<string, unknown>

function rangeKey(row: RangeLike): string {
  return [row.manager_id, row.oracle_id, row.expiry, row.lower_strike, row.higher_strike].join('|')
}

export function netOpenRanges(minted: RangeLike[] = [], redeemed: RangeLike[] = []): RangeLike[] {
  const net = new Map<string, { row: RangeLike; qty: number }>()

  for (const row of minted) {
    const key = rangeKey(row)
    const cur = net.get(key)
    const quantity = Number(row.quantity)
    if (cur) cur.qty += quantity
    else net.set(key, { row, qty: quantity })
  }

  for (const row of redeemed) {
    const key = rangeKey(row)
    const cur = net.get(key)
    if (cur) cur.qty -= Number(row.quantity)
  }

  return [...net.values()]
    .filter((entry) => entry.qty > 0)
    .map((entry) => ({ ...entry.row, open_quantity: entry.qty }))
}

export function inferOverlayStatus(row: RangeLike): PositionOverlayStatus {
  const status = String(row.status || '')
  if (status === 'settled') return 'claimable'
  if (status === 'awaiting_settlement') return 'awaiting-settlement'
  return 'open'
}

export function toRangeOverlays(ranges: RangeLike[] = []): PositionOverlay[] {
  return ranges.map((row) => ({
    id: rangeKey(row),
    kind: 'range',
    oracleId: String(row.oracle_id || ''),
    quantity: Number(row.open_quantity ?? row.quantity ?? 0),
    status: inferOverlayStatus(row),
    lowerStrike: Number(row.lower_strike),
    upperStrike: Number(row.higher_strike),
  }))
}

export function toBinaryOverlays(positions: RangeLike[] = []): PositionOverlay[] {
  return positions.map((row) => ({
    id: [row.manager_id, row.oracle_id, row.expiry, row.strike, row.is_up].join('|'),
    kind: 'binary',
    oracleId: String(row.oracle_id || ''),
    quantity: Number(row.open_quantity ?? row.quantity ?? 0),
    status: inferOverlayStatus(row),
    strike: Number(row.strike),
    isUp: Boolean(row.is_up),
  }))
}

/** Merge binary + (already netted) range positions into overlays for one oracle. */
export function mergeOverlays(
  snapshot: { positions?: RangeLike[]; ranges?: RangeLike[] },
  oracleId: string | null,
): PositionOverlay[] {
  if (!oracleId) return []
  return [...toBinaryOverlays(snapshot.positions), ...toRangeOverlays(snapshot.ranges)].filter(
    (overlay) => overlay.oracleId === oracleId && overlay.quantity > 0,
  )
}
