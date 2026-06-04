// Cloudflare Worker — MEXC Contract API CORS Proxy
// Deploy: wrangler deploy
// URL: https://mexc-proxy.<your-subdomain>.workers.dev/api/v1/contract/...

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = 'https://contract.mexc.com' + url.pathname + url.search

    const resp = await fetch(target, {
      method: request.method,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const headers = new Headers(resp.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    return new Response(resp.body, { status: resp.status, headers })
  },
}
