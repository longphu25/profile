// BTC Chart — polled market data via React Query + whale tracker.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { VisFlags } from '../storage'
import { statsFromTicker, DEFAULT_STATS, DEFAULT_FUNDING, DEFAULT_FNG } from '../lib/api'
import { fmtP, fmtV } from '../lib/format'
import type { Interval } from '../lib/constants'
import { HTF_MAP } from '../lib/liquidity'
import { SYMBOLS, loadSymbols, type SymbolEntry, type SymbolId } from '../lib/symbols'
import type { FundingState, FngState, StatsState } from '../lib/types'
import { useTicker, useFunding, useFearGreed, useKlines } from './useMarketData'
import { useOpenInterest, useSupply } from './useOI'
import { useWhaleTracker } from './useWhaleTracker'

export interface UseBtcChartMarketParams {
  symbol: SymbolId
  interval: Interval
  customSymbols: SymbolEntry[]
  vis: VisFlags
  setPrice: React.Dispatch<React.SetStateAction<{ cur: string; chg: string; up: boolean }>>
  setMarkPrice: React.Dispatch<React.SetStateAction<number | null>>
  setOhlcv: React.Dispatch<
    React.SetStateAction<{ o: string; h: string; l: string; c: string; v: string }>
  >
  htfRef: React.MutableRefObject<import('../lib/types').Candle[] | null>
}

export interface UseBtcChartMarket {
  remoteSymbols: readonly SymbolEntry[]
  allSymbols: SymbolEntry[]
  symbolInfo: SymbolEntry
  symbolInfoRef: React.MutableRefObject<SymbolEntry>
  tickerQuery: ReturnType<typeof useTicker>
  fundingQuery: ReturnType<typeof useFunding>
  fngQuery: ReturnType<typeof useFearGreed>
  klinesQuery: ReturnType<typeof useKlines>
  htfQuery: ReturnType<typeof useKlines>
  oiQuery: ReturnType<typeof useOpenInterest>
  supplyQuery: ReturnType<typeof useSupply>
  stats: StatsState
  funding: FundingState
  fng: FngState
  mcap: number | null
  whaleTracker: ReturnType<typeof useWhaleTracker>
}

/** React Query market data, remote symbol list, and ticker-driven price sync. */
export function useBtcChartMarket(params: UseBtcChartMarketParams): UseBtcChartMarket {
  const { symbol, interval, customSymbols, vis, setPrice, setMarkPrice, setOhlcv, htfRef } = params

  const [remoteSymbols, setRemoteSymbols] = useState<readonly SymbolEntry[]>(SYMBOLS)

  const allSymbols = useMemo<SymbolEntry[]>(
    () => [
      ...remoteSymbols,
      ...customSymbols.filter((c) => !remoteSymbols.some((s) => s.symbol === c.symbol)),
    ],
    [remoteSymbols, customSymbols],
  )

  const symbolInfo: SymbolEntry = useMemo(() => {
    return (
      allSymbols.find((s) => s.symbol === symbol) || {
        symbol,
        base: symbol.replace(/USDT$/, ''),
        quote: 'USDT',
        exchange: 'binance' as const,
      }
    )
  }, [allSymbols, symbol])

  const symbolInfoRef = useRef(symbolInfo)
  useEffect(() => {
    symbolInfoRef.current = symbolInfo
  }, [symbolInfo])

  const tickerQuery = useTicker(symbol, symbolInfo)
  const fundingQuery = useFunding(symbol, symbolInfo)
  const fngQuery = useFearGreed()
  const klinesQuery = useKlines(symbol, interval, symbolInfo)
  const htfInterval = HTF_MAP[interval as Interval]
  const htfQuery = useKlines(symbol, htfInterval ?? (interval as Interval), symbolInfo)

  const stats: StatsState = tickerQuery.data ? statsFromTicker(tickerQuery.data) : DEFAULT_STATS
  const funding: FundingState = fundingQuery.data ?? DEFAULT_FUNDING
  const fng: FngState = fngQuery.data ?? DEFAULT_FNG

  const currentPrice = tickerQuery.data?.price ?? 0
  const oiQuery = useOpenInterest(symbol, currentPrice)
  const supplyQuery = useSupply(symbolInfo.geckoId)
  const mcap = supplyQuery.data != null ? supplyQuery.data * currentPrice : null

  const whaleTracker = useWhaleTracker(symbol, {
    enabled: vis.whale,
    whaleThreshold: 100000,
    flowWindowMs: 3600000,
    maxAlerts: 100,
  })

  useEffect(() => {
    loadSymbols().then((list) => setRemoteSymbols(list))
  }, [])

  useEffect(() => {
    const t = tickerQuery.data
    if (!t) return
    setPrice({
      cur: fmtP(t.price),
      chg: (t.chg >= 0 ? '+' : '') + t.chg.toFixed(2) + '%',
      up: t.up,
    })
    setMarkPrice(t.price)
    setOhlcv((o) => ({
      ...o,
      o: fmtP(t.low),
      h: fmtP(t.high),
      l: fmtP(t.low),
      c: fmtP(t.price),
      v: fmtV(t.vol),
    }))
  }, [tickerQuery.data, setPrice, setMarkPrice, setOhlcv])

  useEffect(() => {
    htfRef.current = htfQuery.data?.candles ?? null
  }, [htfQuery.data, htfRef])

  return {
    remoteSymbols,
    allSymbols,
    symbolInfo,
    symbolInfoRef,
    tickerQuery,
    fundingQuery,
    fngQuery,
    klinesQuery,
    htfQuery,
    oiQuery,
    supplyQuery,
    stats,
    funding,
    fng,
    mcap,
    whaleTracker,
  }
}
