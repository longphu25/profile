const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://longphu.com',
  'https://longphu25.github.io',
]

/** Allowed browser origins for HTTP actions (comma-separated env override). */
export function allowedOrigins(): readonly string[] {
  const raw = process.env.CLIENT_ORIGIN ?? process.env.ALLOWED_ORIGINS
  if (!raw) return DEFAULT_ORIGINS
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin')
  const allowed = allowedOrigins()
  const match = origin && allowed.includes(origin) ? origin : allowed[0]

  return new Headers({
    'Access-Control-Allow-Origin': match ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  })
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}
