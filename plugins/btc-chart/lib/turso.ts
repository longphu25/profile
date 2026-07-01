/**
 * Turso HTTP client for btc-chart coin list.
 *
 * Uses the /v2/pipeline endpoint with a read-only token exposed via
 * VITE_TURSO_DB_TOKEN. This is acceptable for public read data (coin list).
 * No write operations are performed from the client.
 */

import type { Exchange, SymbolEntry } from './symbols'

const TURSO_URL = import.meta.env.VITE_TURSO_DB_URL as string | undefined
const TURSO_TOKEN = import.meta.env.VITE_TURSO_DB_TOKEN as string | undefined

interface TursoRow {
  type: 'text' | 'integer' | 'float' | 'null'
  value?: string
}

interface TursoResponse {
  results: Array<{
    type: 'ok' | 'error'
    response?: {
      type: 'execute'
      result: {
        cols: Array<{ name: string }>
        rows: TursoRow[][]
        affected_row_count: number
      }
    }
    error?: { message: string }
  }>
}

/** Cache to avoid repeated fetches during a session. */
let cachedCoins: SymbolEntry[] | null = null
let fetchPromise: Promise<SymbolEntry[]> | null = null

/**
 * Fetch enabled coins from Turso. Returns null if Turso is not configured,
 * allowing the caller to fall back to the hardcoded list.
 */
export async function fetchCoinsFromTurso(): Promise<SymbolEntry[] | null> {
  if (!TURSO_URL || !TURSO_TOKEN) return null
  if (cachedCoins) return cachedCoins

  // Deduplicate concurrent calls
  if (fetchPromise) return fetchPromise

  fetchPromise = _doFetch()
  try {
    const result = await fetchPromise
    cachedCoins = result
    return result
  } finally {
    fetchPromise = null
  }
}

async function _doFetch(): Promise<SymbolEntry[]> {
  const url = `${TURSO_URL}/v2/pipeline`
  const body = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: 'SELECT symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id FROM coins WHERE enabled = 1 ORDER BY sort_order ASC, id ASC',
        },
      },
      { type: 'close' },
    ],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.warn('[turso] Failed to fetch coins:', res.status, res.statusText)
    return []
  }

  const data: TursoResponse = await res.json()
  const first = data.results[0]
  if (!first || first.type === 'error') {
    console.warn('[turso] Query error:', first?.error?.message)
    return []
  }

  const result = first.response!.result
  return result.rows.map((row) => {
    const val = (idx: number) => {
      const cell = row[idx]
      return cell?.type === 'null' ? undefined : cell?.value
    }
    return {
      symbol: val(0)!,
      base: val(1)!,
      quote: val(2)!,
      exchange: val(3) as Exchange,
      mexcSymbol: val(4),
      okxInstId: val(5),
      bybitCategory: val(6),
      geckoId: val(7),
    } as SymbolEntry
  })
}

/** Invalidate cache so next call re-fetches from Turso. */
export function invalidateTursoCache() {
  cachedCoins = null
}
