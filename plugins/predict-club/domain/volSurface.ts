import type { SVIParams } from './payoutPreview'

/**
 * Volatility-surface domain types for the Surface Studio (plan 23).
 *
 * The surface is sampled from the live oracle SVI params: each live oracle is an
 * expiry column, and a symmetric band of strikes around that oracle's forward is
 * the row axis. IV per cell comes from the SVI total-variance curve, so the whole
 * grid is pure math over data we already receive (no contract call). Contract-side
 * mispricing (S3) decorates this grid; it does not define it.
 */

/** One expiry's worth of inputs: the SVI curve plus its anchor (forward + expiry). */
export interface SurfaceColumnInput {
  oracleId: string
  expiryMs: number
  forward: number
  svi: SVIParams | null
}

/** A single sampled cell: implied vol at a strike for one expiry. */
export interface SurfaceCell {
  strike: number
  /** Log-moneyness log(K / F). 0 at the forward. */
  logMoneyness: number
  /** Annualized implied vol (sqrt(totalVariance / T)), or null when SVI is missing. */
  iv: number | null
}

/** One expiry column: its anchor plus the sampled cells (one per strike row). */
export interface SurfaceColumn {
  oracleId: string
  expiryMs: number
  /** Seconds until expiry at sample time (for the column header). */
  secondsToExpiry: number
  forward: number
  /** The column's SVI curve, retained so the mispricing ladder (S3) and arb-free
   * checker (S4) can compute fair value per strike. Null when the column is degraded. */
  svi: SVIParams | null
  /** True when this column has no usable SVI: cells carry null IV (degraded, not faked). */
  degraded: boolean
  cells: SurfaceCell[]
}

/**
 * The assembled surface. Strikes are a shared row axis (the union of every
 * column's strike band, sorted descending so high strikes sit at the top of the
 * heatmap, matching how a vol matrix reads). Columns are sorted by expiry ascending.
 */
export interface SurfaceGrid {
  /** Shared, descending strike rows. */
  strikes: number[]
  /** Expiry columns, ascending by expiry. */
  columns: SurfaceColumn[]
  /** Min/max IV across all non-null cells, for the color ramp. Null when empty. */
  ivRange: { min: number; max: number } | null
  sampledAtMs: number
}

/** Annualized realized vol estimate from a short spot window (S2). */
export interface RealizedVol {
  /** Annualized realized vol as a fraction (0.45 = 45%), or null when unavailable. */
  value: number | null
  /** Number of returns used (window length minus one). */
  sampleCount: number
  /** Window length in minutes, for honest labeling. */
  windowMinutes: number
}

/**
 * One strike's mispricing (plan 23, S3): the contract-implied win probability
 * (from a real devInspect quote) against the SVI fair-value probability. Edge is
 * the signed difference; positive means the contract is pricing the outcome richer
 * than the model (a sell-side edge), negative means cheaper (a buy-side edge).
 */
export interface MispriceCell {
  oracleId: string
  strike: number
  /** SVI fair-value win probability for the UP side (model). */
  fairProbability: number | null
  /** Contract-implied win probability for the UP side (devInspect quote). */
  contractProbability: number | null
  /** Contract-implied win probability for the DOWN side (a second devInspect quote);
   * needed to measure the house margin the UP price alone cannot reveal. */
  contractProbabilityDown: number | null
  /** pUpContract + pDownContract - 1: the house margin (overround) baked into both
   * prices. Null until both sides are quoted; an edge smaller than this is mostly vig. */
  overround: number | null
  /** Edge after removing the overround: devigUp - fairProbability, where
   * devigUp = pUp / (pUp + pDown). The part of the gap that is real mispricing rather
   * than the house margin. Null when either contract side or the fair value is missing. */
  netEdge: number | null
  /** contractProbability - fairProbability, or null when either side is missing. The
   * raw gap (NOT net of vig); kept unchanged so the heatmap caret reads as before. */
  edge: number | null
  /** Defined reason when the contract quote could not be obtained (degraded, not faked). */
  reason?: string
}
