import { describe, expect, test } from 'bun:test'
import {
  type SurfaceHistoryEntry,
  pushSurfaceHistory,
  surfaceFingerprint,
} from '../../plugins/predict-club/application/volSurfaceService'
import type { SVIParams } from '../../plugins/predict-club/domain/payoutPreview'
import type { SurfaceColumn, SurfaceGrid } from '../../plugins/predict-club/domain/volSurface'

function svi(onchain_timestamp: number): SVIParams {
  return {
    a: 257_891,
    b: 22_081_730,
    rho: 318_962_000,
    rho_negative: true,
    m: 7_193_000,
    m_negative: false,
    sigma: 49_538_110,
    onchain_timestamp,
  }
}

function column(oracleId: string, sviParams: SVIParams | null): SurfaceColumn {
  return {
    oracleId,
    expiryMs: 1_700_000_000_000,
    secondsToExpiry: 3600,
    forward: 60_000,
    svi: sviParams,
    degraded: sviParams == null,
    cells: [{ strike: 60_000, logMoneyness: 0, iv: sviParams ? 0.5 : null }],
  }
}

function grid(columns: SurfaceColumn[]): SurfaceGrid {
  return {
    strikes: [60_000],
    columns,
    ivRange: columns.some((c) => c.svi) ? { min: 0.5, max: 0.5 } : null,
    sampledAtMs: 0,
  }
}

const EMPTY: SurfaceGrid = { strikes: [], columns: [], ivRange: null, sampledAtMs: 0 }

describe('surfaceFingerprint', () => {
  test('keys on each column oracle id + its SVI onchain timestamp', () => {
    expect(surfaceFingerprint(grid([column('a', svi(100))]))).toBe('a:100')
  })

  test('changes when a column SVI updates', () => {
    const before = surfaceFingerprint(grid([column('a', svi(100))]))
    const after = surfaceFingerprint(grid([column('a', svi(200))]))
    expect(before).not.toBe(after)
  })

  test('a degraded column contributes a stable none marker', () => {
    expect(surfaceFingerprint(grid([column('a', null)]))).toBe('a:none')
  })
})

describe('pushSurfaceHistory', () => {
  test('appends a distinct surface', () => {
    const h0: SurfaceHistoryEntry[] = []
    const h1 = pushSurfaceHistory(h0, grid([column('a', svi(100))]), 1_000)
    expect(h1.length).toBe(1)
    expect(h1[0].capturedAtMs).toBe(1_000)
  })

  test('does not append when the fingerprint is unchanged (same SVI re-sample)', () => {
    const h1 = pushSurfaceHistory([], grid([column('a', svi(100))]), 1_000)
    const h2 = pushSurfaceHistory(h1, grid([column('a', svi(100))]), 2_000)
    expect(h2.length).toBe(1)
    expect(h2).toBe(h1)
  })

  test('appends when the SVI timestamp advances', () => {
    const h1 = pushSurfaceHistory([], grid([column('a', svi(100))]), 1_000)
    const h2 = pushSurfaceHistory(h1, grid([column('a', svi(200))]), 2_000)
    expect(h2.length).toBe(2)
  })

  test('never stores an empty grid', () => {
    const h = pushSurfaceHistory([], EMPTY, 1_000)
    expect(h.length).toBe(0)
  })

  test('drops the oldest beyond the cap (bounded ring buffer)', () => {
    let h: SurfaceHistoryEntry[] = []
    for (let i = 1; i <= 5; i += 1) {
      h = pushSurfaceHistory(h, grid([column('a', svi(i * 100))]), i * 1_000, 3)
    }
    expect(h.length).toBe(3)
    // Oldest two (ts 100, 200) dropped; the newest three remain in order.
    expect(h.map((e) => e.capturedAtMs)).toEqual([3_000, 4_000, 5_000])
  })
})
