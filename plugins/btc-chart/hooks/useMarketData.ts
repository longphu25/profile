// BTC Chart — React Query hooks for polled market data.
// WebSocket streaming stays imperative elsewhere; only the periodic REST
// endpoints live here (ticker 5s, funding 30s, Fear & Greed 60s).

import { useQuery } from '@tanstack/react-query'
import type { Interval } from '../lib/constants'
import type { SymbolEntry } from '../lib/symbols'
import { fetchTicker, fetchFunding, fetchFearGreed, fetchKlines } from '../lib/api'

export function useTicker(symbol: string, info: SymbolEntry) {
  return useQuery({
    queryKey: ['btc-chart', 'ticker', symbol],
    queryFn: () => fetchTicker(symbol, info),
    refetchInterval: 5_000,
    staleTime: 5_000,
  })
}

export function useFunding(symbol: string, info: SymbolEntry) {
  return useQuery({
    queryKey: ['btc-chart', 'funding', symbol],
    queryFn: () => fetchFunding(symbol, info),
    refetchInterval: 30_000,
    staleTime: 30_000,
  })
}

export function useFearGreed() {
  return useQuery({
    queryKey: ['btc-chart', 'fng'],
    queryFn: fetchFearGreed,
    refetchInterval: 60_000,
    staleTime: 60_000,
  })
}

/**
 * Initial historical candles. One-shot per symbol/interval (no polling) —
 * live updates arrive over the WebSocket, kept imperative for performance.
 */
export function useKlines(symbol: string, interval: Interval, info: SymbolEntry) {
  return useQuery({
    queryKey: ['btc-chart', 'klines', info.exchange, symbol, interval],
    queryFn: () => fetchKlines(symbol, interval, info),
    staleTime: 15_000,
    retry: 0,
  })
}
