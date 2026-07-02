// BTC Chart — REST data access for polled market data (ticker, funding, F&G).
// Pure async functions intended as React Query queryFns. They throw on
// failure so the query layer can retry and keep the last good value.

import { LIMIT, CHART, type Interval } from './constants'
import { fmtP, fmtV } from './format'
import { computeOiDeltaPct, type OiDeltaPct, type OiHistoryPoint } from './open-interest'
import { BYBIT_INTERVAL, MEXC_INTERVAL, OKX_INTERVAL, SYMBOLS } from './symbols'
import type { Candle, FngState, FundingState, StatsState } from './types'
import type { SymbolEntry } from './symbols'

export interface TickerData {
  price: number
  chg: number
  high: number
  low: number
  vol: number
  quoteVol: number
  up: boolean
}

export const DEFAULT_STATS: StatsState = { high: '—', low: '—', vol: '—', chg: '—', up: true }
export const DEFAULT_FUNDING: FundingState = {
  val: '—',
  sub: 'Balanced',
  cls: '',
  breakdown: [],
}
export const DEFAULT_FNG: FngState = { val: '—', label: 'Loading…', color: '#9fb9b1', pct: 50 }

const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

/** 24h ticker, normalized across Binance (futures→spot), Bybit, MEXC, OKX. */
export async function fetchTicker(symbol: string, info: SymbolEntry): Promise<TickerData> {
  if (info.exchange === 'mexc') {
    const msym = info.mexcSymbol ?? symbol
    const json = await (await fetch(`/api/mexc/api/v1/contract/ticker?symbol=${msym}`)).json()
    const t = json.data
    if (!t) throw new Error('mexc ticker unavailable')
    const chg = +t.riseFallRate * 100
    return {
      price: +t.lastPrice,
      high: +t.high24Price,
      low: +t.lower24Price,
      vol: +t.volume24,
      quoteVol: +t.amount24,
      chg,
      up: chg >= 0,
    }
  }
  if (info.exchange === 'okx') {
    const instId = info.okxInstId ?? symbol
    const json = await (await fetch(`/api/okx/api/v5/market/ticker?instId=${instId}`)).json()
    const t = json.data?.[0]
    if (!t) throw new Error('okx ticker unavailable')
    const p = +t.last
    const open24 = +t.open24h
    const chg = open24 ? ((p - open24) / open24) * 100 : 0
    return {
      price: p,
      high: +t.high24h,
      low: +t.low24h,
      vol: +t.vol24h,
      quoteVol: +t.volCcy24h,
      chg,
      up: chg >= 0,
    }
  }
  // Binance futures first (most accurate), fall back to Bybit or Binance spot.
  const binFut = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  if (binFut && binFut.lastPrice) {
    const chg = +binFut.priceChangePercent
    return {
      price: +binFut.lastPrice,
      chg,
      high: +binFut.highPrice,
      low: +binFut.lowPrice,
      vol: +binFut.volume,
      quoteVol: +binFut.quoteVolume,
      up: chg >= 0,
    }
  }
  if (info.exchange === 'bybit') {
    const cat = info.bybitCategory ?? 'linear'
    const json = await (
      await fetch(`https://api.bybit.com/v5/market/tickers?category=${cat}&symbol=${symbol}`)
    ).json()
    const t = json.result?.list?.[0]
    if (!t) throw new Error('bybit ticker unavailable')
    const p = +t.lastPrice
    const prev = +t.prevPrice24h
    const chg = prev ? ((p - prev) / prev) * 100 : 0
    return {
      price: p,
      high: +t.highPrice24h,
      low: +t.lowPrice24h,
      vol: +t.volume24h,
      quoteVol: +t.turnover24h,
      chg,
      up: chg >= 0,
    }
  }
  const t = await (
    await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
  ).json()
  if (!t.lastPrice) throw new Error('binance ticker unavailable')
  const chg = +t.priceChangePercent
  return {
    price: +t.lastPrice,
    chg,
    high: +t.highPrice,
    low: +t.lowPrice,
    vol: +t.volume,
    quoteVol: +t.quoteVolume,
    up: chg >= 0,
  }
}

/** Derive the 24h stats panel shape from a ticker snapshot. */
export function statsFromTicker(t: TickerData): StatsState {
  return { high: fmtP(t.high), low: fmtP(t.low), vol: fmtV(t.quoteVol), chg: pct(t.chg), up: t.up }
}

/** Average funding rate across the venues that list the symbol. */
export async function fetchFunding(symbol: string, info: SymbolEntry): Promise<FundingState> {
  const results: { name: string; rate: number }[] = []

  const venues: Promise<void>[] = []

  if (info.mexcSymbol) {
    venues.push(
      (async () => {
        const d = await (
          await fetch(`/api/mexc/api/v1/contract/ticker?symbol=${info.mexcSymbol}`)
        ).json()
        if (d.data?.fundingRate) results.push({ name: 'MEXC', rate: +d.data.fundingRate * 100 })
      })(),
    )
  }
  venues.push(
    (async () => {
      const d = await (
        await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
      ).json()
      if (d.lastFundingRate) results.push({ name: 'Binance', rate: +d.lastFundingRate * 100 })
    })(),
  )
  venues.push(
    (async () => {
      const d = await (
        await fetch(
          `https://www.okx.com/api/v5/public/funding-rate?instId=${symbol.replace('USDT', '')}-USDT-SWAP`,
        )
      ).json()
      if (d.data?.[0]?.fundingRate)
        results.push({ name: 'OKX', rate: +d.data[0].fundingRate * 100 })
    })(),
  )
  venues.push(
    (async () => {
      const cat = info.bybitCategory ?? 'linear'
      const d = await (
        await fetch(
          `https://api.bybit.com/v5/market/funding/history?category=${cat}&symbol=${symbol}&limit=1`,
        )
      ).json()
      if (d.result?.list?.[0]?.fundingRate)
        results.push({ name: 'Bybit', rate: +d.result.list[0].fundingRate * 100 })
    })(),
  )

  await Promise.allSettled(venues)

  if (results.length === 0) throw new Error('no funding data')
  const avg = results.reduce((s, r) => s + r.rate, 0) / results.length
  return {
    val: (avg >= 0 ? '+' : '') + avg.toFixed(4) + '%',
    sub: avg > 0.1 ? 'Long heavy' : avg < 0 ? 'Short heavy' : 'Balanced',
    cls: avg > 0.05 ? 'dn' : avg < 0 ? 'up' : '',
    breakdown: results,
  }
}

/** Crypto Fear & Greed index from alternative.me. */
export async function fetchFearGreed(): Promise<FngState> {
  const d = await (await fetch('https://api.alternative.me/fng/?limit=1')).json()
  const row = d.data?.[0]
  if (!row) throw new Error('no fng data')
  const v = +row.value
  const color =
    v < 25 ? CHART.dn : v < 45 ? '#ffaf6b' : v < 55 ? CHART.hi : v < 75 ? CHART.up : CHART.ma50
  return { val: String(v), label: row.value_classification, color, pct: v }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface KlineResult {
  candles: Candle[]
  /** True when a Binance symbol fell back to the spot endpoint. */
  usedSpot: boolean
}

/** Fetch historical candles, normalized across Binance/Bybit/MEXC/OKX. */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  info: SymbolEntry,
): Promise<KlineResult> {
  if (info.exchange === 'mexc') {
    const msym = info.mexcSymbol ?? symbol
    const r = await fetch(
      `/api/mexc/api/v1/contract/kline/${msym}?interval=${MEXC_INTERVAL[interval]}&limit=${LIMIT}`,
    )
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const json = (await r.json()) as {
      data: {
        time: number[]
        open: string[]
        high: string[]
        low: string[]
        close: string[]
        vol: string[]
      }
    }
    const d = json.data
    const candles = d.time
      .map((t, i) => ({
        time: t,
        open: +d.open[i],
        high: +d.high[i],
        low: +d.low[i],
        close: +d.close[i],
        volume: +d.vol[i],
      }))
      .sort((a, b) => a.time - b.time)
    return { candles, usedSpot: false }
  }
  if (info.exchange === 'bybit') {
    const cat = info.bybitCategory ?? 'linear'
    const r = await fetch(
      `https://api.bybit.com/v5/market/kline?category=${cat}&symbol=${symbol}&interval=${BYBIT_INTERVAL[interval]}&limit=${LIMIT}`,
    )
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const json = (await r.json()) as { result: { list: string[][] } }
    const candles = json.result.list.reverse().map((d) => ({
      time: Math.floor(Number(d[0]) / 1000),
      open: +d[1],
      high: +d[2],
      low: +d[3],
      close: +d[4],
      volume: +d[5],
    }))
    return { candles, usedSpot: false }
  }
  if (info.exchange === 'okx') {
    const instId = info.okxInstId ?? symbol
    const r = await fetch(
      `/api/okx/api/v5/market/candles?instId=${instId}&bar=${OKX_INTERVAL[interval]}&limit=${LIMIT}`,
    )
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const json = (await r.json()) as { data: string[][] }
    const candles = json.data.reverse().map((d) => ({
      time: Math.floor(Number(d[0]) / 1000),
      open: +d[1],
      high: +d[2],
      low: +d[3],
      close: +d[4],
      volume: +d[5],
    }))
    return { candles, usedSpot: false }
  }
  // Binance: known futures symbols try the futures endpoint first; custom or
  // unknown symbols use spot directly (CORS-safe).
  const isKnownFutures = (SYMBOLS as readonly any[]).some((s: any) => s.symbol === symbol)
  let raw: any[][] | null = null
  let usedSpot = false
  if (isKnownFutures) {
    try {
      const r = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${LIMIT}`,
      )
      if (r.ok) raw = await r.json()
    } catch {
      /* futures unavailable or CORS blocked */
    }
  }
  if (!raw) {
    const r = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${LIMIT}`,
    )
    if (!r.ok) throw new Error('HTTP ' + r.status)
    raw = await r.json()
    usedSpot = true
  }
  const candles = raw!.map((d) => ({
    time: Math.floor(d[0] / 1000),
    open: +d[1],
    high: +d[2],
    low: +d[3],
    close: +d[4],
    volume: +d[5],
  }))
  return { candles, usedSpot }
}

// ── Open Interest (Binance + Bybit aggregated) ─────────────────────

export type { OiDeltaPct, OiHistoryPoint }

export interface OIData {
  /** Total OI in USD across fetched exchanges. */
  totalUsd: number
  breakdown: { exchange: string; usd: number }[]
  /** Hourly Binance OI in USD (oldest first), used for trend and sparkline. */
  history: OiHistoryPoint[]
  /** Percent change vs 1h / 4h / 24h ago (Binance USD history). */
  deltaPct: OiDeltaPct
}

interface BinanceOiHistRow {
  timestamp?: number
  sumOpenInterestValue?: string
}

async function fetchBinanceOiHistory(symbol: string): Promise<OiHistoryPoint[]> {
  const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`
  const r = await fetch(url)
  if (!r.ok) return []
  const rows = (await r.json()) as BinanceOiHistRow[]
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => ({
      time: Number(row.timestamp) || 0,
      totalUsd: parseFloat(row.sumOpenInterestValue ?? '0'),
    }))
    .filter((p) => p.time > 0 && p.totalUsd > 0)
    .sort((a, b) => a.time - b.time)
}

export async function fetchOpenInterest(symbol: string, price: number): Promise<OIData> {
  const breakdown: { exchange: string; usd: number }[] = []
  let history: OiHistoryPoint[] = []

  const requests = [
    // Binance Futures snapshot
    fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        const qty = parseFloat(j.openInterest)
        breakdown.push({ exchange: 'Binance', usd: qty * price })
      })
      .catch(() => {}),
    // Bybit snapshot
    fetch(
      `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=1`,
    )
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        const item = j.result?.list?.[0]
        if (item) {
          const qty = parseFloat(item.openInterest)
          breakdown.push({ exchange: 'Bybit', usd: qty * price })
        }
      })
      .catch(() => {}),
    // Binance hourly history (USD) for delta and sparkline
    fetchBinanceOiHistory(symbol)
      .then((pts) => {
        history = pts
      })
      .catch(() => {}),
  ]

  await Promise.allSettled(requests)
  const totalUsd = breakdown.reduce((s, b) => s + b.usd, 0)
  const deltaPct = computeOiDeltaPct(history)
  return { totalUsd, breakdown, history, deltaPct }
}

// ── Circulating Supply (CoinGecko, cached 24h in localStorage) ──────

const SUPPLY_KEY = 'btc-chart:supply'
const SUPPLY_TTL = 24 * 60 * 60 * 1000 // 24h

interface SupplyCache {
  [geckoId: string]: { supply: number; ts: number }
}

function loadSupplyCache(): SupplyCache {
  try {
    return JSON.parse(localStorage.getItem(SUPPLY_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveSupplyCache(cache: SupplyCache) {
  localStorage.setItem(SUPPLY_KEY, JSON.stringify(cache))
}

/**
 * Get circulating supply for a coin. Cached in localStorage for 24h.
 * `geckoId` is the CoinGecko coin id (e.g. "bitcoin", "ethereum").
 */
export async function fetchCirculatingSupply(geckoId: string): Promise<number> {
  const cache = loadSupplyCache()
  const entry = cache[geckoId]
  if (entry && Date.now() - entry.ts < SUPPLY_TTL) return entry.supply

  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${geckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
  )
  if (!r.ok) throw new Error('CoinGecko HTTP ' + r.status)
  const j = await r.json()
  const supply = j.market_data?.circulating_supply ?? 0
  cache[geckoId] = { supply, ts: Date.now() }
  saveSupplyCache(cache)
  return supply
}
