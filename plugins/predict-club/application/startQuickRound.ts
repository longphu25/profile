import type { ClubOracleSnapshot } from '../infrastructure/deepbookOracleService'
import {
  createQuickRound,
  activateRound,
  resolveATMStrike,
  type QuickRound,
  type QuickRoundConfig,
} from '../domain/quickRound'

export interface StartQuickRoundParams {
  oracleId?: string
  joinWindowSeconds?: number
  maxQuantityPerMember?: number
  strikeOverride?: number
}

/**
 * Leader starts a quick round. Resolves oracle, picks ATM strike, returns activated round.
 */
export function startQuickRound(
  oracleSnapshot: ClubOracleSnapshot,
  params: StartQuickRoundParams,
): QuickRound {
  // Pick oracle: explicit or auto-select shortest active expiry
  const oracles = oracleSnapshot.oracles.filter((o) => o.status === 'active')
  if (oracles.length === 0) throw new Error('No active oracles available')

  let selected = oracles[0]
  if (params.oracleId) {
    const found = oracles.find((o) => o.oracle_id === params.oracleId)
    if (!found) throw new Error(`Oracle ${params.oracleId} not found or not active`)
    selected = found
  } else {
    // Pick shortest expiry
    selected = oracles.reduce(
      (shortest, o) => (o.expiry < shortest.expiry ? o : shortest),
      oracles[0],
    )
  }

  // Resolve strike
  const spotPrice = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  if (spotPrice <= 0) throw new Error('No oracle price available')

  const tickSize = selected.tick_size ?? 0
  const minStrike = selected.min_strike ?? 0
  const strike = params.strikeOverride
    ? resolveATMStrike(params.strikeOverride, tickSize, minStrike)
    : resolveATMStrike(spotPrice, tickSize, minStrike)

  const config: QuickRoundConfig = {
    oracleId: selected.oracle_id,
    underlyingAsset: selected.underlying_asset,
    expiry: selected.expiry,
    strike,
    tickSize,
    minStrike,
    joinWindowSeconds: params.joinWindowSeconds ?? 30,
    maxQuantityPerMember: params.maxQuantityPerMember ?? 1,
  }

  const round = createQuickRound(config)
  return activateRound(round)
}
