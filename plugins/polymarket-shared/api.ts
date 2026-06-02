// Polymarket API URL resolver
// Dev: Vite proxy /api/polymarket → gamma-api.polymarket.com (avoids CORS)
// Prod: Cloudflare Worker proxy or direct (if deployed on same domain)
//
// For production static deploy, set window.__POLYMARKET_PROXY__ to your proxy URL
// e.g. window.__POLYMARKET_PROXY__ = 'https://your-worker.workers.dev'
// The proxy should forward requests to gamma-api.polymarket.com with CORS headers

declare global {
  interface Window {
    __POLYMARKET_PROXY__?: string
  }
}

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

/** Gamma API base (market discovery, events, tags) */
export function gammaApi(): string {
  if (isDev) return '/api/polymarket'
  if (window.__POLYMARKET_PROXY__) return window.__POLYMARKET_PROXY__
  // Fallback: direct call (works if page is served from polymarket.com
  // or behind a reverse proxy that adds CORS headers)
  return 'https://gamma-api.polymarket.com'
}

/** CLOB API base (trading, orderbook) */
export function clobApi(): string {
  if (isDev) return '/api/polymarket'
  return 'https://clob.polymarket.com'
}
