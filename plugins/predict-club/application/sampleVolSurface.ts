import { type SVIParams, totalVarianceAtLogMoneyness } from '../domain/payoutPreview'
import type {
  SurfaceCell,
  SurfaceColumn,
  SurfaceColumnInput,
  SurfaceGrid,
} from '../domain/volSurface'

/**
 * Pure volatility-surface sampler (plan 23, S1).
 *
 * Given the live oracles (each an expiry column with its SVI + forward), build a
 * dense strike x expiry IV matrix. The strike axis is shared across columns so the
 * heatmap has no holes: every column is evaluated at every shared strike via its
 * own log-moneyness log(K / F_column). IV per cell is annualized:
 *   IV = sqrt(totalVariance(svi, log(K/F)) / T),  T = secondsToExpiry / year.
 *
 * This is free math over data we already receive. No contract call, no network.
 * A column whose SVI is missing degrades to null IV cells (never fabricated).
 */

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

export interface SampleConfig {
  /** Strike steps on each side of the anchor forward (total rows = 2*steps + 1). */
  steps: number
  /** Relative step size between strikes, as a fraction of the forward (0.005 = 0.5%). */
  stepFraction: number
}

export const DEFAULT_SAMPLE_CONFIG: SampleConfig = {
  steps: 6,
  stepFraction: 0.005,
}

function annualizedIv(
  svi: SVIParams,
  logMoneyness: number,
  secondsToExpiry: number,
): number | null {
  if (secondsToExpiry <= 0) return null
  const w = totalVarianceAtLogMoneyness(svi, logMoneyness)
  if (!Number.isFinite(w) || w <= 0) return null
  const t = secondsToExpiry / SECONDS_PER_YEAR
  const iv = Math.sqrt(w / t)
  return Number.isFinite(iv) ? iv : null
}

/**
 * Build the shared, descending strike axis from a reference forward. Strikes are
 * rounded to whole dollars (BTC scale) and de-duplicated; descending so high
 * strikes sit at the top of the matrix, matching how a vol grid reads.
 */
function buildStrikeAxis(referenceForward: number, config: SampleConfig): number[] {
  const strikes = new Set<number>()
  for (let i = -config.steps; i <= config.steps; i += 1) {
    const strike = Math.round(referenceForward * (1 + i * config.stepFraction))
    if (strike > 0) strikes.add(strike)
  }
  return [...strikes].sort((a, b) => b - a)
}

/**
 * Sample a full surface grid from the live oracle columns.
 *
 * @param inputs One entry per live oracle (expiry column). Columns with a
 *   non-positive forward are skipped entirely (no anchor to sample around).
 * @param nowMs Sample timestamp (passed in for deterministic tests).
 * @param config Strike-band shape.
 */
export function sampleVolSurface(
  inputs: SurfaceColumnInput[],
  nowMs: number,
  config: SampleConfig = DEFAULT_SAMPLE_CONFIG,
): SurfaceGrid {
  const usable = inputs
    .filter((input) => Number.isFinite(input.forward) && input.forward > 0)
    .sort((a, b) => a.expiryMs - b.expiryMs)

  if (usable.length === 0) {
    return { strikes: [], columns: [], ivRange: null, sampledAtMs: nowMs }
  }

  // Anchor the shared strike band on the nearest-expiry forward (the most liquid,
  // most relevant expiry). All columns are then sampled at these same strikes.
  const referenceForward = usable[0].forward
  const strikes = buildStrikeAxis(referenceForward, config)

  let ivMin = Number.POSITIVE_INFINITY
  let ivMax = Number.NEGATIVE_INFINITY

  const columns: SurfaceColumn[] = usable.map((input) => {
    const secondsToExpiry = Math.max(0, Math.floor((input.expiryMs - nowMs) / 1000))
    const degraded = input.svi == null
    const cells: SurfaceCell[] = strikes.map((strike) => {
      const logMoneyness = Math.log(strike / input.forward)
      const iv =
        input.svi && secondsToExpiry > 0
          ? annualizedIv(input.svi, logMoneyness, secondsToExpiry)
          : null
      if (iv != null) {
        if (iv < ivMin) ivMin = iv
        if (iv > ivMax) ivMax = iv
      }
      return { strike, logMoneyness, iv }
    })
    return {
      oracleId: input.oracleId,
      expiryMs: input.expiryMs,
      secondsToExpiry,
      forward: input.forward,
      svi: input.svi,
      degraded,
      cells,
    }
  })

  const ivRange =
    ivMin <= ivMax && Number.isFinite(ivMin) && Number.isFinite(ivMax)
      ? { min: ivMin, max: ivMax }
      : null

  return { strikes, columns, ivRange, sampledAtMs: nowMs }
}
