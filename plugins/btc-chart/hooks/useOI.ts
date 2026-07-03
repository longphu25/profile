// BTC Chart — Open Interest + Market Cap hooks.

import { useQuery } from '@tanstack/react-query'
import { fetchOpenInterest, fetchCirculatingSupply } from '../lib/api'

/** OI aggregated from Binance + Bybit, polled every 30s. */
export function useOpenInterest(symbol: string, price: number) {
  return useQuery({
    queryKey: ['btc-chart', 'oi', symbol],
    queryFn: () => fetchOpenInterest(symbol, price),
    refetchInterval: 30_000,
    staleTime: 30_000,
    enabled: price > 0,
  })
}

/** Circulating supply from CoinGecko (cached 24h in localStorage). */
export function useSupply(geckoId: string | undefined) {
  return useQuery({
    queryKey: ['btc-chart', 'supply', geckoId],
    queryFn: () => fetchCirculatingSupply(geckoId!),
    staleTime: 24 * 60 * 60 * 1000, // 24h
    enabled: !!geckoId,
  })
}
