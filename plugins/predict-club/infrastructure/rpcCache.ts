/**
 * Browser RPC cache — TTL caching + in-flight request coalescing for JSON-RPC.
 *
 * Infrastructure layer utility. Reduces redundant fullnode calls:
 *  - Identical requests within `ttlMs` return the cached result.
 *  - Concurrent identical requests share a single in-flight promise.
 *
 * Pure transport helper — no domain logic.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL_MS = 15_000

// ── Circuit breaker ──────────────────────────────────────────────────────────
// When an endpoint fails repeatedly (CORS, dead WS, network down), stop hammering
// it. After OPEN_MS the breaker half-opens and allows one probe.
const FAILURE_THRESHOLD = 3
const OPEN_MS = 30_000

interface BreakerState {
  failures: number
  openUntil: number
}
const breakers = new Map<string, BreakerState>()

function breakerFor(url: string): BreakerState {
  let b = breakers.get(url)
  if (!b) {
    b = { failures: 0, openUntil: 0 }
    breakers.set(url, b)
  }
  return b
}

function recordSuccess(url: string): void {
  const b = breakerFor(url)
  b.failures = 0
  b.openUntil = 0
}

function recordFailure(url: string): void {
  const b = breakerFor(url)
  b.failures++
  if (b.failures >= FAILURE_THRESHOLD) {
    b.openUntil = Date.now() + OPEN_MS
  }
}

/** True when the breaker is open (endpoint considered down). */
export function isEndpointDown(url: string): boolean {
  const b = breakers.get(url)
  if (!b) return false
  if (b.openUntil === 0) return false
  if (Date.now() >= b.openUntil) {
    // half-open: allow one probe
    b.openUntil = 0
    b.failures = FAILURE_THRESHOLD - 1
    return false
  }
  return true
}

/** Build a stable cache key from an RPC endpoint + JSON-RPC method + params. */
export function rpcKey(url: string, method: string, params: unknown): string {
  return `${url}|${method}|${JSON.stringify(params ?? null)}`
}

/**
 * Cached JSON-RPC POST.
 *
 * @param url     Fullnode RPC endpoint.
 * @param method  JSON-RPC method name.
 * @param params  JSON-RPC params array.
 * @param ttlMs   Cache lifetime in ms (default 15s). Pass 0 to bypass cache read.
 */
export async function cachedRpc<T = unknown>(
  url: string,
  method: string,
  params: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const key = rpcKey(url, method, params)
  const now = Date.now()

  if (ttlMs > 0) {
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now) {
      return hit.value as T
    }
  }

  // Stop hammering an endpoint that's repeatedly failing
  if (isEndpointDown(url)) {
    throw new Error(`RPC endpoint unavailable (circuit open): ${url}`)
  }

  // Coalesce concurrent identical requests
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const promise = (async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) throw new Error(`RPC ${method}: ${res.status}`)
      const data = await res.json()
      recordSuccess(url)
      if (ttlMs > 0) {
        cache.set(key, { value: data, expiresAt: Date.now() + ttlMs })
      }
      return data as T
    } catch (err) {
      recordFailure(url)
      throw err
    }
  })()

  inflight.set(key, promise)
  try {
    return (await promise) as T
  } finally {
    inflight.delete(key)
  }
}

/** Invalidate cached entries. Pass a method to scope, or omit to clear all. */
export function invalidateRpc(method?: string): void {
  if (!method) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.includes(`|${method}|`)) cache.delete(key)
  }
}
