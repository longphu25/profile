import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api, internal } from './_generated/api'
import { corsHeaders, jsonResponse } from './lib/cors'
import { validateTelegramInitData } from './telegram/validateInitData'

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

http.route({
  path: '/telegram/auth',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }),
})

http.route({
  path: '/telegram/auth',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return jsonResponse(request, { error: 'telegram auth not configured' }, 503)
    }

    let body: { initData?: string }
    try {
      body = (await request.json()) as { initData?: string }
    } catch {
      return jsonResponse(request, { error: 'invalid json body' }, 400)
    }

    const initData = body.initData?.trim()
    if (!initData) {
      return jsonResponse(request, { error: 'initData required' }, 400)
    }

    const parsed = await validateTelegramInitData(initData, botToken)
    if (!parsed) {
      return jsonResponse(request, { error: 'invalid initData' }, 401)
    }

    const id = typeof parsed.user.id === 'number' ? parsed.user.id : Number(parsed.user.id)
    const firstName = typeof parsed.user.first_name === 'string' ? parsed.user.first_name : ''
    if (!Number.isFinite(id) || !firstName) {
      return jsonResponse(request, { error: 'invalid user in initData' }, 401)
    }

    const session = await ctx.runMutation(internal.telegram.mutations.createTelegramSession, {
      telegramId: id,
      firstName,
      lastName: typeof parsed.user.last_name === 'string' ? parsed.user.last_name : undefined,
      username: typeof parsed.user.username === 'string' ? parsed.user.username : undefined,
      photoUrl: typeof parsed.user.photo_url === 'string' ? parsed.user.photo_url : undefined,
      languageCode:
        typeof parsed.user.language_code === 'string' ? parsed.user.language_code : undefined,
      isPremium: parsed.user.is_premium === true,
    })

    return jsonResponse(request, {
      token: session.token,
      expiresAt: session.expiresAt,
      verified: true,
      user: session.user,
    })
  }),
})

http.route({
  path: '/telegram/me',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }),
})

http.route({
  path: '/telegram/me',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const auth = request.headers.get('Authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!token) {
      return jsonResponse(request, { error: 'bearer token required' }, 401)
    }

    const session = await ctx.runQuery(api.telegram.queries.getTelegramSession, { token })
    if (!session) {
      return jsonResponse(request, { error: 'session expired or invalid' }, 401)
    }

    return jsonResponse(request, {
      verified: true,
      expiresAt: session.expiresAt,
      user: session.user,
    })
  }),
})

export default http
