import { describe, expect, test } from 'bun:test'
import type { SVIParams } from '../../plugins/predict-club/domain/payoutPreview'
import {
  checkArbFree,
  checkButterfly,
  checkCalendar,
} from '../../plugins/predict-club/application/arbFreeCheck'
import type { SurfaceCell, SurfaceColumn, SurfaceGrid } from '../../plugins/predict-club/domain/volSurface'

// A real testnet SVI set: a well-formed smile, monotone digital up-probability.
const HEALTHY_SVI: SVIParams = {
  a: 257_891,
  b: 22_081_730,
  rho: 318_962_000,
  rho_negative: true,
  m: 7_193_000,
  m_negative: false,
  sigma: 49_538_110,
}

// A deliberately broken set (huge b, near -1 rho, tiny sigma): the digital
// up-probability rises with strike across part of the range, a butterfly arb.
const BUTTERFLY_SVI: SVIParams = {
  a: 20_000_000,
  b: 1_500_000_000,
  rho: 950_000_000,
  rho_negative: true,
  m: 0,
  m_negative: false,
  sigma: 50_000_000,
}

// Two flat smiles at the same moneyness where the LATER expiry has LESS total
// variance (a drops 50e-3 -> 10e-3 at k=0): a calendar arbitrage.
const CAL_NEAR_SVI: SVIParams = {
  a: 50_000_000,
  b: 1_000_000_000,
  rho: 0,
  rho_negative: false,
  m: 0,
  m_negative: false,
  sigma: 100_000_000,
}
const CAL_FAR_SVI: SVIParams = {
  a: 10_000_000,
  b: 1_000_000_000,
  rho: 0,
  rho_negative: false,
  m: 0,
  m_negative: false,
  sigma: 100_000_000,
}

const HOUR_MS = 60 * 60 * 1000

function cells(forward: number, strikes: number[]): SurfaceCell[] {
  return strikes.map((strike) => ({ strike, logMoneyness: Math.log(strike / forward), iv: 0.5 }))
}

function column(
  oracleId: string,
  expiryMs: number,
  forward: number,
  svi: SVIParams | null,
  strikes: number[],
): SurfaceColumn {
  return {
    oracleId,
    expiryMs,
    secondsToExpiry: Math.max(0, (expiryMs - 1_700_000_000_000) / 1000),
    forward,
    svi,
    degraded: svi == null,
    cells: svi == null ? strikes.map((s) => ({ strike: s, logMoneyness: 0, iv: null })) : cells(forward, strikes),
  }
}

function grid(columns: SurfaceColumn[]): SurfaceGrid {
  const strikes = [...new Set(columns.flatMap((c) => c.cells.map((cell) => cell.strike)))].sort(
    (a, b) => b - a,
  )
  return { strikes, columns, ivRange: { min: 0.4, max: 0.6 }, sampledAtMs: 1_700_000_000_000 }
}

describe('arb-free butterfly check', () => {
  test('a well-formed smile reports no butterfly violation', () => {
    const col = column('healthy', 1_700_000_000_000 + HOUR_MS, 60_000, HEALTHY_SVI, [
      50_000, 55_000, 60_000, 65_000, 70_000,
    ])
    expect(checkButterfly(col)).toEqual([])
  })

  test('a broken smile (digital prob rising with strike) is flagged', () => {
    const col = column('broken', 1_700_000_000_000 + HOUR_MS, 100, BUTTERFLY_SVI, [
      50, 60, 70, 80, 90, 100,
    ])
    const violations = checkButterfly(col)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('butterfly')
    expect(violations[0].oracleId).toBe('broken')
  })

  test('a degraded column (no SVI) is skipped, never guessed as a violation', () => {
    const col = column('dark', 1_700_000_000_000 + HOUR_MS, 60_000, null, [55_000, 60_000, 65_000])
    expect(checkButterfly(col)).toEqual([])
  })
})

describe('arb-free calendar check', () => {
  test('total variance rising with expiry reports no calendar violation', () => {
    const near = column('near', 1_700_000_000_000 + HOUR_MS, 100, CAL_FAR_SVI, [90, 100, 110])
    const far = column('far', 1_700_000_000_000 + 2 * HOUR_MS, 100, CAL_NEAR_SVI, [90, 100, 110])
    // near has LOW a, far has HIGH a -> variance grows with expiry (healthy).
    expect(checkCalendar([near, far], [90, 100, 110])).toEqual([])
  })

  test('total variance falling with expiry is flagged as calendar arbitrage', () => {
    const near = column('near', 1_700_000_000_000 + HOUR_MS, 100, CAL_NEAR_SVI, [90, 100, 110])
    const far = column('far', 1_700_000_000_000 + 2 * HOUR_MS, 100, CAL_FAR_SVI, [90, 100, 110])
    const violations = checkCalendar([near, far], [90, 100, 110])
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('calendar')
    // The violation localizes to the LATER expiry column.
    expect(violations[0].oracleId).toBe('far')
  })

  test('a single usable column cannot produce a calendar violation', () => {
    const only = column('solo', 1_700_000_000_000 + HOUR_MS, 100, CAL_FAR_SVI, [90, 100, 110])
    expect(checkCalendar([only], [90, 100, 110])).toEqual([])
  })
})

describe('checkArbFree over a grid', () => {
  test('a healthy grid reports clean with both checks run', () => {
    const report = checkArbFree(
      grid([
        column('near', 1_700_000_000_000 + HOUR_MS, 100, CAL_FAR_SVI, [90, 100, 110]),
        column('far', 1_700_000_000_000 + 2 * HOUR_MS, 100, CAL_NEAR_SVI, [90, 100, 110]),
      ]),
    )
    expect(report.violations).toEqual([])
    expect(report.butterflyChecked).toBe(true)
    expect(report.calendarChecked).toBe(true)
    expect(report.checkedColumns).toBe(2)
  })

  test('an all-degraded grid checks nothing and fabricates no violations', () => {
    const report = checkArbFree(
      grid([column('dark', 1_700_000_000_000 + HOUR_MS, 60_000, null, [55_000, 60_000, 65_000])]),
    )
    expect(report.violations).toEqual([])
    expect(report.butterflyChecked).toBe(false)
    expect(report.calendarChecked).toBe(false)
    expect(report.checkedColumns).toBe(0)
  })

  test('an empty grid is trivially clean', () => {
    const report = checkArbFree(grid([]))
    expect(report.violations).toEqual([])
    expect(report.butterflyChecked).toBe(false)
    expect(report.calendarChecked).toBe(false)
  })
})
