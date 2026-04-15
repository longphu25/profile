/**
 * Market data hooks — price, orderbook, markets, pool metadata.
 */

import { useCallback, useState } from 'react'
import type { OBLevel, PoolMarketData } from '../types'
import { INDEXER } from '../types'

export function useMarketData(network: string, pool: string) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [markets, setMarkets] = useState<PoolMarketData[]>([])
  const [marketsLoading, setMarketsLoading] = useState(false)
  const [obBids, setObBids] = useState<OBLevel[]>([])
  const [obAsks, setObAsks] = useState<OBLevel[]>([])

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER[network]}/ticker`)
      const data: Record<string, { last_price: number }> = await res.json()
      if (data[pool]?.last_price) setCurrentPrice(data[pool].last_price)
    } catch { /* silent */ }
  }, [network, pool])

  const fetchMarkets = useCallback(async () => {
    setMarketsLoading(true)
    try {
      const [summaryRes, tickerRes] = await Promise.all([
        fetch(`${INDEXER[network]}/summary`).then(r => r.json()),
        fetch(`${INDEXER[network]}/ticker`).then(r => r.json()),
      ])
      const summary = summaryRes as { trading_pairs: string; price_change_percent_24h: number; quote_volume: number; highest_bid: number; lowest_ask: number }[]
      const ticker = tickerRes as Record<string, { last_price: number }>
      setMarkets(
        summary
          .filter((s) => ticker[s.trading_pairs])
          .map((s) => ({
            pool: s.trading_pairs,
            price: ticker[s.trading_pairs].last_price,
            change24h: s.price_change_percent_24h,
            volume: s.quote_volume,
            spread: s.highest_bid && s.lowest_ask ? ((s.lowest_ask - s.highest_bid) / s.highest_bid) * 100 : 0,
          }))
          .sort((a, b) => b.volume - a.volume),
      )
    } catch { /* silent */ }
    setMarketsLoading(false)
  }, [network])

  const fetchOrderbook = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER[network]}/orderbook/${pool}?level=2&depth=20`)
      const data: { bids: [string, string][]; asks: [string, string][] } = await res.json()
      const parse = (levels: [string, string][]) => {
        let total = 0
        return levels.slice(0, 15).map(([p, s]) => {
          total += parseFloat(s)
          return { price: parseFloat(p), size: parseFloat(s), total }
        })
      }
      setObBids(parse(data.bids))
      setObAsks(parse(data.asks))
    } catch { /* silent */ }
  }, [network, pool])

  return {
    currentPrice, setCurrentPrice,
    markets, marketsLoading, fetchMarkets,
    obBids, obAsks, fetchOrderbook,
    fetchPrice,
  }
}
