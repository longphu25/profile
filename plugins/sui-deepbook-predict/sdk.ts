// ── SDK / API helpers ────────────────────────────────────────────────────────────

import { PREDICT_SERVER } from './types'

/** Fetch JSON from the Predict server. Returns null on error. */
export async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PREDICT_SERVER}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Fetch BTC price from external sources for cross-venue comparison */
export async function fetchExternalBTCPrice(): Promise<{ source: string; price: number }[]> {
  const results: { source: string; price: number }[] = []

  // CoinGecko (free, no key)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    )
    const data = await res.json()
    if (data?.bitcoin?.usd) results.push({ source: 'CoinGecko', price: data.bitcoin.usd })
  } catch {
    /* silent */
  }

  // Binance
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
    const data = await res.json()
    if (data?.price) results.push({ source: 'Binance', price: parseFloat(data.price) })
  } catch {
    /* silent */
  }

  return results
}
