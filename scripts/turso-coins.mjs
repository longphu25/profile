#!/usr/bin/env node
/**
 * Turso coins table admin CLI for btc-chart.
 *
 * Manages the `coins` table used by plugins/btc-chart to load its symbol
 * list from Turso. Requires a full-access (read+write) token — NOT the
 * read-only token used by the frontend.
 *
 * Setup:
 *   turso db tokens create <db-name>                # read-only (frontend, VITE_TURSO_DB_TOKEN)
 *   turso db tokens create <db-name> --read-write    # full-access (this script, TURSO_ADMIN_TOKEN)
 *
 * Env (or pass via flags):
 *   TURSO_DB_URL      libsql://<db>-<org>.turso.io  (or https://)
 *   TURSO_ADMIN_TOKEN read-write token
 *
 * Usage:
 *   bun scripts/turso-coins.mjs init
 *   bun scripts/turso-coins.mjs seed
 *   bun scripts/turso-coins.mjs list
 *   bun scripts/turso-coins.mjs add SYMBOL=DOGEUSDT BASE=DOGE QUOTE=USDT EXCHANGE=binance GECKO_ID=dogecoin
 *   bun scripts/turso-coins.mjs enable DOGEUSDT
 *   bun scripts/turso-coins.mjs disable DOGEUSDT
 *   bun scripts/turso-coins.mjs remove DOGEUSDT
 */

const RAW_URL = process.env.TURSO_DB_URL
const TOKEN = process.env.TURSO_ADMIN_TOKEN

const args = process.argv.slice(2)
const cmd = args[0]

function usage() {
  console.log(`Usage: bun scripts/turso-coins.mjs <command> [args]

Commands:
  init                          Create the coins table if it doesn't exist
  seed                          Seed table with the current hardcoded symbol list
  list                          List all coins (id, symbol, enabled, sort_order)
  add KEY=VAL ...                Insert a coin. Keys: SYMBOL BASE QUOTE EXCHANGE
                                 MEXC_SYMBOL OKX_INST_ID BYBIT_CATEGORY GECKO_ID SORT_ORDER
  enable <SYMBOL>                Set enabled=1 for a coin
  disable <SYMBOL>               Set enabled=0 for a coin
  remove <SYMBOL>                Delete a coin row

Env:
  TURSO_DB_URL       e.g. libsql://btc-chart-longphu.aws-ap-northeast-1.turso.io
  TURSO_ADMIN_TOKEN  read-write token (turso db tokens create <db> --read-write)
`)
}

if (!cmd || cmd === '-h' || cmd === '--help') {
  usage()
  process.exit(cmd ? 0 : 1)
}

if (!RAW_URL || !TOKEN) {
  console.error('Missing TURSO_DB_URL or TURSO_ADMIN_TOKEN env vars.\n')
  usage()
  process.exit(1)
}

const BASE_URL = RAW_URL.replace(/^libsql:\/\//, 'https://')

/** Execute one or more statements against Turso via the /v2/pipeline endpoint. */
async function exec(statements) {
  const res = await fetch(`${BASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [...statements.map((stmt) => ({ type: 'execute', stmt })), { type: 'close' }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso HTTP ${res.status}: ${text}`)
  }

  const data = await res.json()
  for (const r of data.results) {
    if (r.type === 'error') {
      throw new Error(`Turso query error: ${r.error?.message}`)
    }
  }
  return data.results
}

function arg(name) {
  const val = (cell) => (cell?.type === 'null' ? null : cell?.value ?? null)
  return val(name)
}

function toBindArg(value) {
  if (value === undefined || value === null) return { type: 'null' }
  if (typeof value === 'number') return { type: 'integer', value: String(value) }
  return { type: 'text', value: String(value) }
}

async function cmdInit() {
  await exec([
    {
      sql: `CREATE TABLE IF NOT EXISTS coins (
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
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    },
  ])
  console.log('✓ coins table ready')
}

/** Mirrors plugins/btc-chart/lib/symbols.ts SYMBOLS for initial seeding. */
const SEED_COINS = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', exchange: 'binance', gecko_id: 'bitcoin', sort_order: 1 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', exchange: 'binance', gecko_id: 'ethereum', sort_order: 2 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', exchange: 'binance', gecko_id: 'solana', sort_order: 3 },
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT', exchange: 'binance', gecko_id: 'sui', sort_order: 4 },
  { symbol: 'HYPEUSDT', base: 'HYPE', quote: 'USDT', exchange: 'binance', gecko_id: 'hyperliquid', sort_order: 5 },
  { symbol: 'CHIPUSDT', base: 'CHIP', quote: 'USDT', exchange: 'binance', sort_order: 6 },
  { symbol: 'LABUSDT', base: 'LAB', quote: 'USDT', exchange: 'binance', mexc_symbol: 'LAB_USDT', sort_order: 7 },
  { symbol: 'OKBUSDT', base: 'OKB', quote: 'USDT', exchange: 'okx', okx_inst_id: 'OKB-USDT-SWAP', sort_order: 8 },
  { symbol: 'REUSDT', base: 'RE', quote: 'USDT', exchange: 'binance', sort_order: 9 },
  { symbol: 'BICOUSDT', base: 'BICO', quote: 'USDT', exchange: 'binance', sort_order: 10 },
  { symbol: 'RESOLVUSDT', base: 'RESOLV', quote: 'USDT', exchange: 'binance', gecko_id: 'resolv', sort_order: 11 },
  {
    symbol: 'ACTUSDT',
    base: 'ACT',
    quote: 'USDT',
    exchange: 'binance',
    gecko_id: 'act-i-the-ai-prophecy',
    sort_order: 12,
  },
  { symbol: 'BASEDUSDT', base: 'BASED', quote: 'USDT', exchange: 'binance', sort_order: 13 },
]

async function cmdSeed() {
  await cmdInit()
  for (const c of SEED_COINS) {
    await exec([
      {
        sql: `INSERT INTO coins (symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id, sort_order)
              VALUES (:symbol, :base, :quote, :exchange, :mexc_symbol, :okx_inst_id, :bybit_category, :gecko_id, :sort_order)
              ON CONFLICT(symbol) DO UPDATE SET
                base=excluded.base, quote=excluded.quote, exchange=excluded.exchange,
                mexc_symbol=excluded.mexc_symbol, okx_inst_id=excluded.okx_inst_id,
                bybit_category=excluded.bybit_category, gecko_id=excluded.gecko_id,
                sort_order=excluded.sort_order`,
        named_args: [
          { name: 'symbol', value: toBindArg(c.symbol) },
          { name: 'base', value: toBindArg(c.base) },
          { name: 'quote', value: toBindArg(c.quote) },
          { name: 'exchange', value: toBindArg(c.exchange) },
          { name: 'mexc_symbol', value: toBindArg(c.mexc_symbol) },
          { name: 'okx_inst_id', value: toBindArg(c.okx_inst_id) },
          { name: 'bybit_category', value: toBindArg(c.bybit_category) },
          { name: 'gecko_id', value: toBindArg(c.gecko_id) },
          { name: 'sort_order', value: toBindArg(c.sort_order) },
        ],
      },
    ])
  }
  console.log(`✓ seeded ${SEED_COINS.length} coins`)
}

async function cmdList() {
  const [result] = await exec([
    { sql: 'SELECT id, symbol, exchange, enabled, sort_order FROM coins ORDER BY sort_order ASC, id ASC' },
  ])
  const { cols, rows } = result.response.result
  const colNames = cols.map((c) => c.name)
  console.log(colNames.join('\t'))
  for (const row of rows) {
    console.log(row.map((cell) => (cell.type === 'null' ? '-' : cell.value)).join('\t'))
  }
  console.log(`\n${rows.length} coin(s)`)
}

async function cmdAdd(pairs) {
  const data = {}
  for (const p of pairs) {
    const [key, ...rest] = p.split('=')
    if (!key || rest.length === 0) {
      console.error(`Invalid arg: ${p} (expected KEY=VALUE)`)
      process.exit(1)
    }
    data[key.toUpperCase()] = rest.join('=')
  }
  if (!data.SYMBOL || !data.BASE || !data.QUOTE) {
    console.error('add requires SYMBOL, BASE, QUOTE at minimum')
    process.exit(1)
  }
  await exec([
    {
      sql: `INSERT INTO coins (symbol, base, quote, exchange, mexc_symbol, okx_inst_id, bybit_category, gecko_id, sort_order)
            VALUES (:symbol, :base, :quote, :exchange, :mexc_symbol, :okx_inst_id, :bybit_category, :gecko_id, :sort_order)
            ON CONFLICT(symbol) DO UPDATE SET
              base=excluded.base, quote=excluded.quote, exchange=excluded.exchange,
              mexc_symbol=excluded.mexc_symbol, okx_inst_id=excluded.okx_inst_id,
              bybit_category=excluded.bybit_category, gecko_id=excluded.gecko_id,
              sort_order=excluded.sort_order`,
      named_args: [
        { name: 'symbol', value: toBindArg(data.SYMBOL) },
        { name: 'base', value: toBindArg(data.BASE) },
        { name: 'quote', value: toBindArg(data.QUOTE) },
        { name: 'exchange', value: toBindArg(data.EXCHANGE ?? 'binance') },
        { name: 'mexc_symbol', value: toBindArg(data.MEXC_SYMBOL) },
        { name: 'okx_inst_id', value: toBindArg(data.OKX_INST_ID) },
        { name: 'bybit_category', value: toBindArg(data.BYBIT_CATEGORY) },
        { name: 'gecko_id', value: toBindArg(data.GECKO_ID) },
        { name: 'sort_order', value: toBindArg(data.SORT_ORDER ?? 0) },
      ],
    },
  ])
  console.log(`✓ added/updated ${data.SYMBOL}`)
}

async function cmdSetEnabled(symbol, enabled) {
  if (!symbol) {
    console.error('Missing SYMBOL argument')
    process.exit(1)
  }
  const [result] = await exec([
    {
      sql: 'UPDATE coins SET enabled = :enabled WHERE symbol = :symbol',
      named_args: [
        { name: 'enabled', value: toBindArg(enabled ? 1 : 0) },
        { name: 'symbol', value: toBindArg(symbol) },
      ],
    },
  ])
  const affected = result.response.result.affected_row_count
  if (affected === 0) {
    console.error(`No coin found with symbol=${symbol}`)
    process.exit(1)
  }
  console.log(`✓ ${symbol} ${enabled ? 'enabled' : 'disabled'}`)
}

async function cmdRemove(symbol) {
  if (!symbol) {
    console.error('Missing SYMBOL argument')
    process.exit(1)
  }
  const [result] = await exec([
    {
      sql: 'DELETE FROM coins WHERE symbol = :symbol',
      named_args: [{ name: 'symbol', value: toBindArg(symbol) }],
    },
  ])
  const affected = result.response.result.affected_row_count
  if (affected === 0) {
    console.error(`No coin found with symbol=${symbol}`)
    process.exit(1)
  }
  console.log(`✓ removed ${symbol}`)
}

try {
  switch (cmd) {
    case 'init':
      await cmdInit()
      break
    case 'seed':
      await cmdSeed()
      break
    case 'list':
      await cmdList()
      break
    case 'add':
      await cmdAdd(args.slice(1))
      break
    case 'enable':
      await cmdSetEnabled(args[1], true)
      break
    case 'disable':
      await cmdSetEnabled(args[1], false)
      break
    case 'remove':
      await cmdRemove(args[1])
      break
    default:
      console.error(`Unknown command: ${cmd}\n`)
      usage()
      process.exit(1)
  }
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
