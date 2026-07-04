import { describe, expect, test } from 'bun:test'
import { calcTradeSetup } from '../../plugins/btc-chart/lib/trade-setup'
import type { Candle, MLResult, NWE } from '../../plugins/btc-chart/lib/types'

const BASE: Candle = {
  time: 1_700_000_000,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
}

const EMPTY_NWE: NWE = {
  mid: [null],
  upper: [null],
  lower: [null],
}

const ML_BULL: MLResult = {
  score: 0.7,
  label: 'Bullish',
  color: '#3dd68c',
  features: {},
}

describe('calcTradeSetup MA context gate', () => {
  test('blocks long plan when close is below fast EMA but keeps long bias', () => {
    const setup = calcTradeSetup([BASE], EMPTY_NWE, [30], { adx: [null] }, ML_BULL, {
      adaptiveMa: {
        fast: 101,
        slow: 99,
        fastPeriod: 9,
        slowPeriod: 21,
        label: '9/21',
      },
    })

    expect(setup.bias.dir).toBe('long')
    expect(setup.bias.bull).toBeGreaterThanOrEqual(2)
    expect(setup.dir).toBeNull()
    expect(setup.reasons).toContain('MA blocked: close below fast EMA(9)')
  })

  test('allows long plan when close is above fast EMA', () => {
    const setup = calcTradeSetup([BASE], EMPTY_NWE, [30], { adx: [null] }, ML_BULL, {
      adaptiveMa: {
        fast: 99,
        slow: 98,
        fastPeriod: 9,
        slowPeriod: 21,
        label: '9/21',
      },
    })

    expect(setup.dir).toBe('long')
    expect(setup.reasons).toContain('MA context: close above fast EMA(9)')
  })

  test('blocks short plan when close is above fast EMA', () => {
    const setup = calcTradeSetup(
      [BASE],
      EMPTY_NWE,
      [70],
      { adx: [null] },
      {
        score: 0.3,
        label: 'Bearish',
        color: '#f25757',
        features: {},
      },
      {
        adaptiveMa: {
          fast: 99,
          slow: 101,
          fastPeriod: 9,
          slowPeriod: 21,
          label: '9/21',
        },
      },
    )

    expect(setup.bias.dir).toBe('short')
    expect(setup.dir).toBeNull()
    expect(setup.reasons).toContain('MA blocked: close above fast EMA(9)')
  })
})
