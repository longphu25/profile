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
