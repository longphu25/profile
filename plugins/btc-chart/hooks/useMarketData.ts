// BTC Chart — React Query hooks for polled market data.
// WebSocket streaming stays imperative elsewhere; ticker polls at LIVE_REFRESH_MS.

import { useQuery } from '@tanstack/react-query'
import { TICKER_REFRESH_MS, type Interval } from '../lib/constants'
import type { SymbolEntry } from '../lib/symbols'
import { fetchTicker, fetchFunding, fetchFearGreed, fetchKlines } from '../lib/api'

export function useTicker(symbol: string, info: SymbolEntry) {
  return useQuery({
    queryKey: ['btc-chart', 'ticker', symbol],
    queryFn: () => fetchTicker(symbol, info),
    refetchInterval: TICKER_REFRESH_MS,
    staleTime: TICKER_REFRESH_MS,
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
export function useKlines(
  symbol: string,
  interval: Interval,
  info: SymbolEntry,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['btc-chart', 'klines', info.exchange, symbol, interval],
    queryFn: () => fetchKlines(symbol, interval, info),
    staleTime: 15_000,
    retry: 0,
    enabled: options?.enabled ?? true,
  })
}
