/**
 * Turso in-browser database for btc-chart coin list.
 *
 * Uses @tursodatabase/database-wasm for local SQLite (OPFS-backed) and
 * pulls coin data from the remote Turso Cloud via HTTP /v2/pipeline.
 * This gives offline-first reads with periodic remote sync.
 *
 * Flow:
 * 1. Open local OPFS database (instant)
 * 2. Read coins from local (fast, offline-capable)
 * 3. Pull latest from remote Turso, upsert into local
 * 4. Return merged result
 */

import { connect, type Database } from '@tursodatabase/database-wasm/vite'
import type { Exchange, SymbolEntry } from './symbols'

const TURSO_URL = (import.meta.env.VITE_TURSO_DB_URL as string | undefined)?.replace(
  /^libsql:\/\//,
  'https://',
)
const TURSO_TOKEN = import.meta.env.VITE_TURSO_DB_TOKEN as string | undefined

let db: Database | null = null
let initPromise: Promise<Database> | null = null

/** Initialize the local OPFS database and ensure schema exists. */
async function initDB(): Promise<Database> {
  if (db) return db
  if (initPromise) return initPromise

  initPromise = (async () => {
    const instance = await connect('btc-chart-coins.db')
    await instance.exec(`
      CREATE TABLE IF NOT EXISTS coins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        base TEXT NOT NULL,
        quote TEXT NOT NULL,
        exchange TEXT NOT NULL DEFAULT 'binance',
        mexc_symbol TEXT,
        okx_inst_id TEXT,
        bybit_category TEXT,
        gecko_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)
    db = instance
    return instance
  })()

  return initPromise
}

/** Read enabled coins from local OPFS database. */
async function readLocal(): Promise<SymbolEntry[]> {
  const instance = await initDB()
  const stmt = await instance.prepare(
    'SELECT symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id FROM coins WHERE enabled = 1 ORDER BY sort_order ASC, id ASC',
  )
  const rows = await stmt.all()

  return (rows as Record<string, unknown>[]).map((r) => ({
    symbol: r.symbol as string,
    base: r.base as string,
    quote: r.quote as string,
    exchange: r.exchange as Exchange,
    mexcSymbol: (r.mexc_symbol as string) || undefined,
    okxInstId: (r.okx_inst_id as string) || undefined,
    bybitCategory: (r.bybit_category as string) || undefined,
    geckoId: (r.gecko_id as string) || undefined,
  }))
}

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
      }
    }
    error?: { message: string }
  }>
}

/** Pull latest coins from remote Turso and upsert into local DB. */
async function pullRemote(): Promise<boolean> {
  if (!TURSO_URL || !TURSO_TOKEN) return false

  try {
    const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id, enabled, sort_order FROM coins ORDER BY sort_order ASC, id ASC',
            },
          },
          { type: 'close' },
        ],
      }),
    })

    if (!res.ok) {
      console.warn('[turso] Remote pull failed:', res.status)
      return false
    }

    const data: TursoResponse = await res.json()
    const first = data.results[0]
    if (!first || first.type === 'error') {
      console.warn('[turso] Remote query error:', first?.error?.message)
      return false
    }

    const rows = first.response!.result.rows
    if (!rows.length) return false

    const instance = await initDB()

    // Clear and re-insert (simple full sync for small table)
    await instance.exec('DELETE FROM coins')

    const stmt = await instance.prepare(
      'INSERT INTO coins (symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )

    for (const row of rows) {
      const val = (idx: number) => {
        const cell = row[idx]
        return cell?.type === 'null' ? null : (cell?.value ?? null)
      }
      await stmt.run(val(0), val(1), val(2), val(3), val(4), val(5), val(6), val(7), val(8), val(9))
    }

    return true
  } catch (err) {
    console.warn('[turso] Remote pull error:', err)
    return false
  }
}

/** Session cache to avoid repeated async calls within the same render cycle. */
let cachedResult: SymbolEntry[] | null = null

/**
 * Fetch coins: read local first (instant), then pull remote and refresh.
 * Returns coins immediately from local cache/OPFS; remote sync happens
 * in background on first call.
 */
export async function fetchCoinsFromTurso(): Promise<SymbolEntry[] | null> {
  if (cachedResult) return cachedResult

  try {
    const instance = await initDB()

    // Check if local DB has data
    const countStmt = await instance.prepare('SELECT COUNT(*) as cnt FROM coins')
    const countRow = await countStmt.get()
    const count = (countRow as Record<string, number>)?.cnt ?? 0

    if (count > 0) {
      // Return local data immediately
      cachedResult = await readLocal()
    }

    // Pull from remote (background if we already have local data)
    const synced = await pullRemote()
    if (synced) {
      cachedResult = await readLocal()
    }

    return cachedResult && cachedResult.length > 0 ? cachedResult : null
  } catch (err) {
    console.warn('[turso] Database init failed:', err)
    return null
  }
}

/** Invalidate cache so next call re-fetches. */
export function invalidateTursoCache() {
  cachedResult = null
}
