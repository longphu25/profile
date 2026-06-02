// Cloudflare Worker — CORS proxy for Polymarket Gamma API
// Deploy: npx wrangler deploy workers/polymarket-proxy.js --name polymarket-proxy
// Then set: window.__POLYMARKET_PROXY__ = 'https://polymarket-proxy.<your>.workers.dev'

const GAMMA = 'https://gamma-api.polymarket.com'
const CLOB = 'https://clob.polymarket.com'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    // Route: /clob/* → clob.polymarket.com, everything else → gamma API
    const target = url.pathname.startsWith('/clob')
      ? CLOB + url.pathname.replace('/clob', '') + url.search
      : GAMMA + url.pathname + url.search

    const res = await fetch(target, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: request.method !== 'GET' ? request.body : undefined,
    })

    const body = await res.text()
    return new Response(body, {
      status: res.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  },
}
