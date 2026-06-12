export function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

const QUOTE_CACHE_TTL = 5000
const quoteCache = new Map<string, { data: unknown; ts: number }>()

export function getCached<T>(key: string): T | null {
  const entry = quoteCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > QUOTE_CACHE_TTL) {
    quoteCache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(key: string, data: unknown): void {
  quoteCache.set(key, { data, ts: Date.now() })
}

export function cacheKey(from: string, to: string, amount: number, dex: string): string {
  return `${dex}:${from}:${to}:${amount}`
}

export function formatPrice(v: number): string {
  if (v === 0) return '—'
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

export function formatNum(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
  return v.toFixed(4)
}
