import { describe, expect, test } from 'bun:test'
import {
  buildMarketSnapshot,
  MarketSnapshotOrchestrator,
  type ExchangeMarketAdapter,
  type ExchangeVenueSnapshot,
  type SymbolRoutingContext,
} from '@profile/market-core'

function mockAdapter(
  venue: ExchangeVenueSnapshot['venue'],
  data: Partial<Omit<ExchangeVenueSnapshot, 'venue'>>,
): ExchangeMarketAdapter {
  return {
    venue,
    async fetchSnapshot() {
      return {
        venue,
        fundingPct: data.fundingPct ?? null,
        oiUsd: data.oiUsd ?? null,
        markPrice: data.markPrice ?? null,
        lastPrice: data.lastPrice ?? null,
        quoteVolume24h: data.quoteVolume24h ?? null,
      }
    },
  }
}

describe('functions btc-chart market snapshot', () => {
  test('buildMarketSnapshot aggregates funding, OI, and mark', () => {
    const ts = 1_700_000_000_000
    const snap = buildMarketSnapshot('BTCUSDT', ts, [
      {
        venue: 'binance',
        fundingPct: 0.01,
        oiUsd: 1_000_000_000,
        markPrice: 100_000,
        lastPrice: 100_000,
        quoteVolume24h: 5_000_000_000,
      },
      {
        venue: 'bybit',
        fundingPct: 0.02,
        oiUsd: 500_000_000,
        markPrice: 100_050,
        lastPrice: 100_050,
        quoteVolume24h: 2_000_000_000,
      },
    ])

    expect(snap.symbol).toBe('BTCUSDT')
    expect(snap.funding.avg).toBeCloseTo(0.015, 5)
    expect(snap.funding.spread).toBeCloseTo(0.01, 5)
    expect(snap.oiUsd.total).toBe(1_500_000_000)
    expect(snap.oiUsd.binance).toBe(1_000_000_000)
    expect(snap.mark.median).toBeGreaterThan(100_000)
    expect(snap.meta.venuesReporting).toEqual(['binance', 'bybit'])
  })

  test('MarketSnapshotOrchestrator uses Promise.allSettled and ignores failed adapters', async () => {
    const ok = mockAdapter('binance', { fundingPct: 0.05, markPrice: 50_000 })
    const fail: ExchangeMarketAdapter = {
      venue: 'okx',
      async fetchSnapshot() {
        throw new Error('network')
      },
    }
    const nullAdapter: ExchangeMarketAdapter = {
      venue: 'mexc',
      async fetchSnapshot() {
        return null
      },
    }

    const orchestrator = new MarketSnapshotOrchestrator([ok, fail, nullAdapter])
    const ctx: SymbolRoutingContext = { symbol: 'BTCUSDT' }
    const snap = await orchestrator.collect(ctx)

    expect(snap.symbol).toBe('BTCUSDT')
    expect(snap.funding.binance).toBe(0.05)
    expect(snap.funding.okx).toBeUndefined()
    expect(snap.meta.venuesReporting).toEqual(['binance'])
  })
})
