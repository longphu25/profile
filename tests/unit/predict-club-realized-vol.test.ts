import { describe, expect, test } from 'bun:test'
import { computeRealizedVol } from '../../plugins/predict-club/application/realizedVol'

const MINUTES_PER_YEAR = 365 * 24 * 60

describe('Predict Club realized vol', () => {
  test('returns null value (not a fake zero) below the minimum sample size', () => {
    expect(computeRealizedVol([], 0).value).toBeNull()
    expect(computeRealizedVol([100], 0).value).toBeNull()
    expect(computeRealizedVol([100, 101], 2).value).toBeNull()
  })

  test('a flat series has zero realized vol', () => {
    const rv = computeRealizedVol([100, 100, 100, 100, 100], 5)
    expect(rv.value).toBe(0)
    expect(rv.sampleCount).toBe(4)
  })

  test('matches the annualized stddev of log returns for a known series', () => {
    const closes = [100, 101, 100, 102, 101, 103]
    const rv = computeRealizedVol(closes, closes.length - 1)

    // Recompute the reference independently.
    const returns: number[] = []
    for (let i = 1; i < closes.length; i += 1) returns.push(Math.log(closes[i] / closes[i - 1]))
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance =
      returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1)
    const expected = Math.sqrt(variance) * Math.sqrt(MINUTES_PER_YEAR)

    expect(rv.value).toBeCloseTo(expected, 10)
    expect(rv.sampleCount).toBe(returns.length)
  })

  test('drops non-finite and non-positive closes before estimating', () => {
    const clean = computeRealizedVol([100, 101, 102, 103], 4)
    const dirty = computeRealizedVol([100, 101, Number.NaN, 102, -5, 103], 6)
    expect(dirty.value).toBeCloseTo(clean.value ?? -1, 10)
  })

  test('reports the window length it was given for honest labeling', () => {
    expect(computeRealizedVol([100, 101, 102], 30).windowMinutes).toBe(30)
  })
})
