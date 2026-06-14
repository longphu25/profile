import { describe, expect, test } from 'bun:test'
import {
  type SVIParams,
  totalVarianceAtLogMoneyness,
} from '../../plugins/predict-club/domain/payoutPreview'
import {
  DEFAULT_SAMPLE_CONFIG,
  sampleVolSurface,
} from '../../plugins/predict-club/application/sampleVolSurface'
import type { SurfaceColumnInput } from '../../plugins/predict-club/domain/volSurface'

const SVI_FROM_TESTNET: SVIParams = {
  a: 257_891,
  b: 22_081_730,
  rho: 318_962_000,
  rho_negative: true,
  m: 7_193_000,
  m_negative: false,
  sigma: 49_538_110,
}

const NOW = 1_700_000_000_000
const HOUR_MS = 60 * 60 * 1000
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

function column(oracleId: string, expiryMs: number, forward: number, svi: SVIParams | null): SurfaceColumnInput {
  return { oracleId, expiryMs, forward, svi }
}

describe('sampleVolSurface', () => {
  test('builds a dense grid: every column sampled at every shared strike', () => {
    const grid = sampleVolSurface(
      [
        column('a', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('b', NOW + 2 * HOUR_MS, 60_000, SVI_FROM_TESTNET),
      ],
      NOW,
    )

    const expectedRows = 2 * DEFAULT_SAMPLE_CONFIG.steps + 1
    expect(grid.strikes.length).toBe(expectedRows)
    expect(grid.columns.length).toBe(2)
    for (const col of grid.columns) {
      expect(col.cells.length).toBe(expectedRows)
    }
  })

  test('strikes are sorted descending (high strikes at the top of the matrix)', () => {
    const grid = sampleVolSurface([column('a', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET)], NOW)
    const sorted = [...grid.strikes].sort((x, y) => y - x)
    expect(grid.strikes).toEqual(sorted)
  })

  test('IV matches sqrt(totalVariance / T) at a known strike', () => {
    const forward = 60_000
    const expiryMs = NOW + HOUR_MS
    const grid = sampleVolSurface([column('a', expiryMs, forward, SVI_FROM_TESTNET)], NOW)

    const col = grid.columns[0]
    // ATM cell: the strike closest to the forward.
    const atm = col.cells.reduce((best, c) =>
      Math.abs(c.strike - forward) < Math.abs(best.strike - forward) ? c : best,
    )
    expect(atm.iv).not.toBeNull()

    const k = Math.log(atm.strike / forward)
    const w = totalVarianceAtLogMoneyness(SVI_FROM_TESTNET, k)
    const t = col.secondsToExpiry / SECONDS_PER_YEAR
    const expectedIv = Math.sqrt(w / t)
    expect(atm.iv as number).toBeCloseTo(expectedIv, 6)
  })

  test('columns ascend by expiry regardless of input order', () => {
    const grid = sampleVolSurface(
      [
        column('far', NOW + 3 * HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('near', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('mid', NOW + 2 * HOUR_MS, 60_000, SVI_FROM_TESTNET),
      ],
      NOW,
    )
    expect(grid.columns.map((c) => c.oracleId)).toEqual(['near', 'mid', 'far'])
  })

  test('a column with no SVI degrades to null IV cells, not fabricated numbers', () => {
    const grid = sampleVolSurface(
      [
        column('live', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('dark', NOW + 2 * HOUR_MS, 60_000, null),
      ],
      NOW,
    )
    const dark = grid.columns.find((c) => c.oracleId === 'dark')
    expect(dark?.degraded).toBe(true)
    expect(dark?.cells.every((c) => c.iv === null)).toBe(true)
  })

  test('an expired column (T <= 0) yields null IV, never a divide-by-zero', () => {
    const grid = sampleVolSurface(
      [
        column('live', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('expired', NOW - 1000, 60_000, SVI_FROM_TESTNET),
      ],
      NOW,
    )
    const expired = grid.columns.find((c) => c.oracleId === 'expired')
    expect(expired?.cells.every((c) => c.iv === null)).toBe(true)
  })

  test('columns with a non-positive forward are dropped (no anchor to sample)', () => {
    const grid = sampleVolSurface(
      [
        column('ok', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('bad', NOW + 2 * HOUR_MS, 0, SVI_FROM_TESTNET),
      ],
      NOW,
    )
    expect(grid.columns.map((c) => c.oracleId)).toEqual(['ok'])
  })

  test('empty input yields an empty grid with a null IV range', () => {
    const grid = sampleVolSurface([], NOW)
    expect(grid.strikes).toEqual([])
    expect(grid.columns).toEqual([])
    expect(grid.ivRange).toBeNull()
  })

  test('ivRange spans the min and max of all non-null cells', () => {
    const grid = sampleVolSurface(
      [
        column('a', NOW + HOUR_MS, 60_000, SVI_FROM_TESTNET),
        column('b', NOW + 4 * HOUR_MS, 60_000, SVI_FROM_TESTNET),
      ],
      NOW,
    )
    const allIvs = grid.columns
      .flatMap((c) => c.cells)
      .map((c) => c.iv)
      .filter((v): v is number => v != null)
    expect(grid.ivRange).not.toBeNull()
    expect(grid.ivRange?.min).toBeCloseTo(Math.min(...allIvs), 9)
    expect(grid.ivRange?.max).toBeCloseTo(Math.max(...allIvs), 9)
  })
})
