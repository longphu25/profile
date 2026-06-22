// BTC Chart — REST data access for polled market data (ticker, funding, F&G).
// Pure async functions intended as React Query queryFns. They throw on
// failure so the query layer can retry and keep the last good value.

import { CHART } from './constants'
import { fmtP, fmtV } from './format'
import type { FngState, FundingState, StatsState, SymbolEntry } from './types'

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
  if (info.mexcSymbol) {
    try {
      const d = await (
        await fetch(`/api/mexc/api/v1/contract/ticker?symbol=${info.mexcSymbol}`)
      ).json()
      if (d.data?.fundingRate) results.push({ name: 'MEXC', rate: +d.data.fundingRate * 100 })
    } catch {
      /* noop */
    }
  }
  try {
    const d = await (
      await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
    ).json()
    if (d.lastFundingRate) results.push({ name: 'Binance', rate: +d.lastFundingRate * 100 })
  } catch {
    /* noop */
  }
  try {
    const d = await (
      await fetch(
        `https://www.okx.com/api/v5/public/funding-rate?instId=${symbol.replace('USDT', '')}-USDT-SWAP`,
      )
    ).json()
    if (d.data?.[0]?.fundingRate) results.push({ name: 'OKX', rate: +d.data[0].fundingRate * 100 })
  } catch {
    /* noop */
  }
  try {
    const cat = info.bybitCategory ?? 'linear'
    const d = await (
      await fetch(
        `https://api.bybit.com/v5/market/funding/history?category=${cat}&symbol=${symbol}&limit=1`,
      )
    ).json()
    if (d.result?.list?.[0]?.fundingRate)
      results.push({ name: 'Bybit', rate: +d.result.list[0].fundingRate * 100 })
  } catch {
    /* noop */
  }
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
