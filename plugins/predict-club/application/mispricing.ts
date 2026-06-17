import { computeFairValue, type SVIParams } from '../domain/payoutPreview'
import type { MispriceCell } from '../domain/volSurface'
import { quoteBinaryStrike } from '../infrastructure/deepbookPredictPricingService'

/**
 * Mispricing layer (plan 23, S3): contract-implied vs SVI-fair win probability.
 *
 * The IV heatmap is free SVI math; mispricing is the one part that costs a real
 * devInspect quote per strike. So this module is deliberately frugal:
 *   - only the caller's chosen strikes are quoted (the ATM band by default),
 *   - every quote is cached by (oracleId, strike) with a short TTL,
 *   - concurrent quotes are bounded so a hover sweep cannot storm testnet RPC.
 *
 * Edge = contractProbability - fairProbability. Positive = the contract prices the
 * UP outcome richer than the model (sell-side edge); negative = cheaper (buy-side).
 * That raw edge does NOT subtract the house margin, so each cell also carries an
 * overround (from quoting both sides) and a net-of-vig edge: the raw edge is the
 * headline, the net edge is the part actually worth trading.
 */

const CACHE_TTL_MS = 20_000
const MAX_CONCURRENCY = 3

interface CacheEntry {
  cell: MispriceCell
  ts: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<MispriceCell>>()

export function mispriceCacheKey(oracleId: string, strike: number): string {
  return `${oracleId}|${strike}`
}

/** Visible for testing: clear the module cache between cases. */
export function _clearMispriceCache(): void {
  cache.clear()
  inflight.clear()
}

/** Pure: assemble a cell from a fair probability and both contract sides. The raw
 * `edge` keeps its original definition (contract UP minus model) so the heatmap caret
 * is unchanged; `overround` and `netEdge` are added only when the DOWN side is also
 * quoted, so we can separate the house margin from real mispricing without guessing. */
export function buildMispriceCell(
  oracleId: string,
  strike: number,
  fairProbability: number | null,
  contractProbability: number | null,
  contractProbabilityDown: number | null = null,
  reason?: string,
): MispriceCell {
  const edge =
    fairProbability != null && contractProbability != null
      ? contractProbability - fairProbability
      : null
  // The overround is the amount both contract prices sum above a fair 1.0; it is the
  // house margin. devigUp renormalizes the UP side so the two sides sum to 1, and the
  // net edge measures that de-vigged probability against the model. Both need a real
  // quote on each side, so they stay null on a one-sided read rather than fake a value.
  const bothSides =
    contractProbability != null &&
    contractProbabilityDown != null &&
    contractProbability + contractProbabilityDown > 0
  const overround = bothSides ? contractProbability + contractProbabilityDown - 1 : null
  const netEdge =
    bothSides && fairProbability != null
      ? contractProbability / (contractProbability + contractProbabilityDown) - fairProbability
      : null
  return {
    oracleId,
    strike,
    fairProbability,
    contractProbability,
    contractProbabilityDown,
    overround,
    netEdge,
    edge,
    reason,
  }
}

function fairProbabilityUp(
  svi: SVIParams | null,
  forward: number,
  expiryMs: number,
  strike: number,
) {
  if (!svi || forward <= 0) return null
  const p = computeFairValue(svi, forward, expiryMs, strike, 0)
  return Number.isFinite(p) && p > 0 ? p : null
}

/**
 * Quote one strike's mispricing, served from cache when fresh. Concurrent callers
 * for the same key share one in-flight promise. The contract quote is the only
 * network cost; the fair side is computed locally from the column's SVI.
 */
export async function getMispriceCell(params: {
  oracleId: string
  expiryMs: number
  strike: number
  forward: number
  svi: SVIParams | null
  tickSize?: number
  minStrike?: number
  walletAddress?: string | null
  nowMs?: number
}): Promise<MispriceCell> {
  const now = params.nowMs ?? Date.now()
  const key = mispriceCacheKey(params.oracleId, params.strike)

  const cached = cache.get(key)
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.cell

  const existing = inflight.get(key)
  if (existing) return existing

  const fair = fairProbabilityUp(params.svi, params.forward, params.expiryMs, params.strike)

  const promise = (async (): Promise<MispriceCell> => {
    // Quote both sides: the UP price alone cannot reveal the house margin, so DOWN is
    // quoted too. Each worker now issues two devInspect calls (MAX_CONCURRENCY=3, so up
    // to 6 in flight); the ATM band is small and cached, so this stays bounded.
    const [up, down] = await Promise.all([
      quoteBinaryStrike({
        oracleId: params.oracleId,
        expiry: params.expiryMs,
        strikeUsd: params.strike,
        isUp: true,
        tickSize: params.tickSize,
        minStrike: params.minStrike,
        walletAddress: params.walletAddress,
      }),
      quoteBinaryStrike({
        oracleId: params.oracleId,
        expiry: params.expiryMs,
        strikeUsd: params.strike,
        isUp: false,
        tickSize: params.tickSize,
        minStrike: params.minStrike,
        walletAddress: params.walletAddress,
      }),
    ])
    const cell = buildMispriceCell(
      params.oracleId,
      params.strike,
      fair,
      up.impliedProbability,
      down.impliedProbability,
      up.impliedProbability == null ? up.reason : undefined,
    )
    cache.set(key, { cell, ts: now })
    inflight.delete(key)
    return cell
  })()

  inflight.set(key, promise)
  return promise
}

/**
 * Quote a band of strikes with bounded concurrency. Returns one cell per input
 * strike (cache hits resolve instantly). Used for the ATM band on column select
 * and extended lazily as the user hovers wider.
 */
export async function getMispriceBand(params: {
  oracleId: string
  expiryMs: number
  strikes: number[]
  forward: number
  svi: SVIParams | null
  tickSize?: number
  minStrike?: number
  walletAddress?: string | null
}): Promise<MispriceCell[]> {
  const out: MispriceCell[] = new Array(params.strikes.length)
  let cursor = 0

  async function worker() {
    while (cursor < params.strikes.length) {
      const index = cursor
      cursor += 1
      out[index] = await getMispriceCell({
        oracleId: params.oracleId,
        expiryMs: params.expiryMs,
        strike: params.strikes[index],
        forward: params.forward,
        svi: params.svi,
        tickSize: params.tickSize,
        minStrike: params.minStrike,
        walletAddress: params.walletAddress,
      })
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, params.strikes.length) }, worker)
  await Promise.all(workers)
  return out
}

/** Select the strikes nearest the forward (the ATM band) from a column's strike axis. */
export function atmBandStrikes(strikes: number[], forward: number, bandRadius: number): number[] {
  return [...strikes]
    .sort((a, b) => Math.abs(a - forward) - Math.abs(b - forward))
    .slice(0, bandRadius * 2 + 1)
    .sort((a, b) => b - a)
}
