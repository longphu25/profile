import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api } from './_generated/api'
import { corsHeaders, jsonResponse } from './lib/cors'

const http = httpRouter()

http.route({
  path: '/btc-chart/market',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase()
    if (!symbol) {
      return jsonResponse(request, { error: 'symbol query param required' }, 400)
    }

    const snapshot = await ctx.runQuery(api.btcChart.queries.getLatestMarketSnapshot, { symbol })
    if (!snapshot) {
      return jsonResponse(request, { error: 'no snapshot for symbol', symbol }, 404)
    }

    return jsonResponse(request, snapshot)
  }),
})

http.route({
  path: '/btc-chart/market',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }),
})

http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    return jsonResponse(request, { ok: true, service: 'profile-functions' })
  }),
})

export default http
