// BTC Chart — Open Interest + Market Cap hooks.

import { useQuery } from '@tanstack/react-query'
import { fetchOpenInterest, fetchCirculatingSupply } from '../lib/api'

/** OI aggregated from Binance + Bybit, polled every 30s. */
export function useOpenInterest(symbol: string, price: number, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && price > 0
  return useQuery({
    queryKey: ['btc-chart', 'oi', symbol],
    queryFn: () => fetchOpenInterest(symbol, price),
    refetchInterval: 30_000,
    staleTime: 30_000,
    enabled,
  })
}

/** Circulating supply from CoinGecko (cached 24h in localStorage). */
export function useSupply(geckoId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!geckoId
  return useQuery({
    queryKey: ['btc-chart', 'supply', geckoId],
    queryFn: () => fetchCirculatingSupply(geckoId!),
    staleTime: 24 * 60 * 60 * 1000, // 24h
    enabled,
  })
}
