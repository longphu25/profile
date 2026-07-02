import { describe, expect, test } from 'bun:test'
import { collectSmcConfluenceVotes } from '../../plugins/btc-chart/lib/smc-signals'
import type { Candle } from '../../plugins/btc-chart/lib/types'
import type { LiquidityResult } from '../../plugins/btc-chart/lib/liquidity'
import type { SMCResult } from '../../plugins/btc-chart/smc'

function candle(time: number, o: number, h: number, l: number, c: number): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: 1 }
}

const baseData: Candle[] = [
  candle(100, 10, 10.5, 9.8, 10.2),
  candle(200, 10.2, 10.4, 10, 10.1),
  candle(300, 10.1, 10.3, 9.9, 10),
  candle(400, 10, 10.2, 9.7, 9.9),
]

describe('collectSmcConfluenceVotes', () => {
  test('votes recent BOS bull', () => {
    const smc: SMCResult = {
      structures: [
        {
          time: 100,
          price: 9.5,
          endTime: 400,
          type: 'BOS',
          bias: 'bull',
        },
      ],
      orderBlocks: [],
      fvgs: [],
    }
    const result = collectSmcConfluenceVotes(baseData, smc)
    expect(result.bull).toBe(1)
    expect(result.reasons).toContain('SMC BOS Bull')
  })

  test('votes recent CHoCH bear', () => {
    const smc: SMCResult = {
      structures: [
        {
          time: 200,
          price: 10.5,
          endTime: 400,
          type: 'CHoCH',
          bias: 'bear',
        },
      ],
      orderBlocks: [],
      fvgs: [],
    }
    const result = collectSmcConfluenceVotes(baseData, smc)
    expect(result.bear).toBe(1)
    expect(result.reasons).toContain('SMC CHoCH Bear')
  })

  test('ignores structure outside lookback window', () => {
    const data = [
      ...baseData,
      candle(500, 9.9, 10.1, 9.8, 10),
    ]
    const smc: SMCResult = {
      structures: [
        {
          time: 50,
          price: 9,
          endTime: 100,
          type: 'BOS',
          bias: 'bull',
        },
      ],
      orderBlocks: [],
      fvgs: [],
    }
    const result = collectSmcConfluenceVotes(data, smc)
    expect(result.bull).toBe(0)
    expect(result.reasons).toHaveLength(0)
  })

  test('votes bull order block touch on current bar', () => {
    const smc: SMCResult = {
      structures: [],
      orderBlocks: [
        {
          startTime: 200,
          high: 10.15,
          low: 9.95,
          bias: 'bull',
          broken: false,
        },
      ],
      fvgs: [],
    }
    const data = [...baseData]
    data[data.length - 1] = candle(400, 10, 10.1, 9.98, 10.05)
    const result = collectSmcConfluenceVotes(data, smc)
    expect(result.bull).toBe(1)
    expect(result.reasons).toContain('SMC Bull OB touch')
  })

  test('votes CHoCH after bullish liquidity sweep', () => {
    const smc: SMCResult = {
      structures: [
        {
          time: 300,
          price: 9.6,
          endTime: 400,
          type: 'CHoCH',
          bias: 'bull',
        },
      ],
      orderBlocks: [],
      fvgs: [],
    }
    const liquidity: LiquidityResult = {
      range: null,
      levels: [],
      inverseFvgs: [],
      sweeps: [
        {
          time: 300,
          index: 2,
          level: 9.5,
          side: 'low',
          type: 'bullish',
          inKillzone: false,
          confidence: 70,
        },
      ],
      nextTarget: null,
    }
    const result = collectSmcConfluenceVotes(baseData, smc, liquidity)
    expect(result.bull).toBeGreaterThanOrEqual(1)
    expect(result.reasons).toContain('SMC CHoCH after sweep')
  })
})