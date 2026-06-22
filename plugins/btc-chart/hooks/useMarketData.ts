// BTC Chart — React Query hooks for polled market data.
// WebSocket streaming stays imperative elsewhere; only the periodic REST
// endpoints live here (ticker 5s, funding 30s, Fear & Greed 60s).

import { useQuery } from '@tanstack/react-query'
import { type SymbolEntry, fetchTicker, fetchFunding, fetchFearGreed } from '../lib'

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
