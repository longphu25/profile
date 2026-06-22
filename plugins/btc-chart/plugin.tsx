// BTC Chart Plugin — Pro view: Midnight Hunter band + Volume Profile + signals + ML
// Adapted from btc-chart-pro-v3.html for the profile plugin host (Shadow DOM scoped)
//
// External dependency: `lightweight-charts` global, loaded via CDN <script> tag
// in the host HTML page. The plugin reads window.LightweightCharts at mount time.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import './style.css'
import {
  loadConfig,
  saveConfig,
  flushConfig,
  exportConfig,
  importConfigFromFile,
  type ChartConfig,
  type VisFlags,
  type OscView,
} from './storage'
import {
  AlertSound,
  ensureNotificationPermission,
  pushNotification,
  evaluateAlerts,
  resetTriggers,
  describeRule,
  makeRule,
  type AlertRule,
  type AlertKind,
} from './alerts'
import { drawVolumeProfile as drawVP } from './volume-profile'
import { drawOrderFlow, type OFOverlaySignal } from './order-flow-overlay'
import { computeSMC, initSmcWasm, type SMCResult } from './smc-wasm'
import { buildBoxFlipSignals, type BoxFlipResult } from './box-flip'
import { downloadChartSnapshot } from './snapshot'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ─────────────────────────────────────────────────────────────────

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface NWE {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
}

interface OrderFlowSignal {
  type: 'buy' | 'sell'
  price: string
  ratio: string
  time: string
}

interface MLResult {
  score: number
  label: string
  color: string
  features: Record<string, number>
}

declare global {
  interface Window {
    LightweightCharts?: any
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

type Exchange = 'binance' | 'bybit' | 'mexc' | 'okx'
const SYMBOLS = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'HYPEUSDT', base: 'HYPE', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'CHIPUSDT', base: 'CHIP', quote: 'USDT', exchange: 'binance' as Exchange },
  {
    symbol: 'LABUSDT',
    base: 'LAB',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    mexcSymbol: 'LAB_USDT',
  },
  {
    symbol: 'OKBUSDT',
    base: 'OKB',
    quote: 'USDT',
    exchange: 'okx' as Exchange,
    okxInstId: 'OKB-USDT-SWAP',
  },
  { symbol: 'REUSDT', base: 'RE', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'BICOUSDT', base: 'BICO', quote: 'USDT', exchange: 'binance' as Exchange },
] as const
type SymbolId = string

interface SymbolEntry {
  symbol: string
  base: string
  quote: string
  exchange: Exchange
  mexcSymbol?: string
  okxInstId?: string
  bybitCategory?: string
}

function loadCustomSymbols(): SymbolEntry[] {
  try {
    return JSON.parse(localStorage.getItem('btc-chart:custom-symbols') || '[]')
  } catch {
    return []
  }
}
function saveCustomSymbols(list: SymbolEntry[]) {
  localStorage.setItem('btc-chart:custom-symbols', JSON.stringify(list))
}

// Bybit interval mapping from Binance format
const BYBIT_INTERVAL: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
}
// MEXC futures interval mapping
const MEXC_INTERVAL: Record<string, string> = {
  '1m': 'Min1',
  '5m': 'Min5',
  '15m': 'Min15',
  '1h': 'Hour1',
  '4h': 'Hour4',
  '1d': 'Day1',
}
// OKX interval mapping
const OKX_INTERVAL: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
}

const LIMIT = 300
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

// Locked chart palette — aligned with TaskForm tokens. Change here to retune.
const CHART = {
  bg: '#071011',
  grid: 'rgba(190,255,234,0.05)',
  border: 'rgba(190,255,234,0.16)',
  axis: '#6f8a83',
  up: '#34d8a4',
  dn: '#ff7a85',
  neu: '#6fbcf0', // NWE mid + RSI
  hi: '#ffc46b', // POC + MA200
  ma50: '#80ffd5', // mint
  vol: 'rgba(159,185,177,0.5)',
  upSoft: 'rgba(52,216,164,0.55)',
  dnSoft: 'rgba(255,122,133,0.55)',
} as const

// ── Formatters ─────────────────────────────────────────────────────────────

const fmtP = (n: number): string =>
  n >= 10000
    ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : n < 1
      ? n.toFixed(5)
      : n.toFixed(2)
const fmtV = (n: number): string =>
  n >= 1e9
    ? (n / 1e9).toFixed(2) + 'B'
    : n >= 1e6
      ? (n / 1e6).toFixed(2) + 'M'
      : n >= 1e3
        ? (n / 1e3).toFixed(1) + 'K'
        : n.toFixed(0)
const tsNow = (): string => new Date().toLocaleTimeString('vi-VN')

// ── Indicators ─────────────────────────────────────────────────────────────

// X48 Midnight Hunter band: a centered Triangular Moving Average (TMA) of the
// weighted price (H+L+2C)/4, offset by an ATR multiple to form the 3 bands.
// The window is centered, so the most recent `halfLen` bars repaint as new
// candles close — this matches the original indicator's "handicapped bands".
function calcMHBand(data: Candle[], halfLen = 56, atrPeriod = 110, atrMult = 2.5): NWE {
  const n = data.length
  const mid = new Array<number | null>(n).fill(null)
  const upper = new Array<number | null>(n).fill(null)
  const lower = new Array<number | null>(n).fill(null)
  const wp = data.map((c) => (c.high + c.low + 2 * c.close) / 4)

  for (let t = 0; t < n; t++) {
    // Triangular weights: peak (halfLen+1) at center, descending on both sides.
    let sum = (halfLen + 1) * wp[t]
    let sumw = halfLen + 1
    let k = halfLen
    for (let j = 1; j <= halfLen; j++) {
      if (t - j >= 0) {
        sum += k * wp[t - j]
        sumw += k
      }
      if (t + j < n) {
        sum += k * wp[t + j]
        sumw += k
      }
      k--
    }
    const m = sum / sumw
    mid[t] = m

    // ATR-like range averaged over atrPeriod bars, offset ~10 bars back (per source).
    let range = 0,
      cnt = 0
    for (let j = 0; j < atrPeriod; j++) {
      const a = t - j - 10,
        b = t - j - 11
      if (b < 0) break
      range += Math.max(data[a].high, data[b].close) - Math.min(data[a].low, data[b].close)
      cnt++
    }
    if (cnt > 0) {
      const dev = (range / cnt) * atrMult
      upper[t] = m + dev
      lower[t] = m - dev
    }
  }
  return { mid, upper, lower }
}

function smaNum(arr: number[], period: number): (number | null)[] {
  const out = new Array<number | null>(arr.length).fill(null)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= period) sum -= arr[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function calcSMA(data: Candle[], period: number): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function calcEMA(data: Candle[], period: number): number[] {
  const k = 2 / (period + 1)
  let ema = data[0].close
  return data.map((d) => {
    ema = d.close * k + ema * (1 - k)
    return ema
  })
}

function calcRSI(data: Candle[], period = 14): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  if (data.length < period + 1) return out
  let g = 0,
    l = 0
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close
    if (d > 0) g += d
    else l -= d
  }
  let ag = g / period,
    al = l / period
  out[period] = 100 - 100 / (1 + ag / (al || 0.0001))
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period
    out[i] = 100 - 100 / (1 + ag / (al || 0.0001))
  }
  return out
}

function calcMACD(
  data: Candle[],
  fast = 12,
  slow = 26,
  sig = 9,
): { macd: number[]; signal: number[]; hist: number[] } {
  const ef = calcEMA(data, fast),
    es = calcEMA(data, slow)
  const macd = data.map((_, i) => ef[i] - es[i])
  const k = 2 / (sig + 1)
  let se = macd[0]
  const sl = macd.map((v) => {
    se = v * k + se * (1 - k)
    return se
  })
  const hist = macd.map((v, i) => v - sl[i])
  return { macd, signal: sl, hist }
}

/** SMA over an array that may contain nulls; resets the window on gaps. */
function smaNullable(arr: (number | null)[], period: number): (number | null)[] {
  const out = new Array<number | null>(arr.length).fill(null)
  const buf: number[] = []
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v == null) {
      buf.length = 0
      continue
    }
    buf.push(v)
    if (buf.length > period) buf.shift()
    if (buf.length === period) out[i] = buf.reduce((a, b) => a + b, 0) / period
  }
  return out
}

/**
 * ADX / DMI (Wilder). Measures trend *strength* (ADX) and direction
 * (+DI vs -DI). ADX > 25 = trending, < 20 = ranging/sideways.
 */
function calcADX(
  data: Candle[],
  period = 14,
): { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] } {
  const n = data.length
  const adx = new Array<number | null>(n).fill(null)
  const plusDI = new Array<number | null>(n).fill(null)
  const minusDI = new Array<number | null>(n).fill(null)
  if (n < period * 2) return { adx, plusDI, minusDI }

  const tr = new Array<number>(n).fill(0)
  const plusDM = new Array<number>(n).fill(0)
  const minusDM = new Array<number>(n).fill(0)
  for (let i = 1; i < n; i++) {
    const up = data[i].high - data[i - 1].high
    const down = data[i - 1].low - data[i].low
    plusDM[i] = up > down && up > 0 ? up : 0
    minusDM[i] = down > up && down > 0 ? down : 0
    const h = data[i].high,
      l = data[i].low,
      pc = data[i - 1].close
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
  }
  // Wilder smoothing of TR / +DM / -DM
  let trS = 0,
    pS = 0,
    mS = 0
  for (let i = 1; i <= period; i++) {
    trS += tr[i]
    pS += plusDM[i]
    mS += minusDM[i]
  }
  const dx: number[] = []
  for (let i = period; i < n; i++) {
    if (i > period) {
      trS = trS - trS / period + tr[i]
      pS = pS - pS / period + plusDM[i]
      mS = mS - mS / period + minusDM[i]
    }
    const pdi = trS ? (100 * pS) / trS : 0
    const mdi = trS ? (100 * mS) / trS : 0
    plusDI[i] = pdi
    minusDI[i] = mdi
    const sum = pdi + mdi
    dx.push(sum ? (100 * Math.abs(pdi - mdi)) / sum : 0)
  }
  // ADX = Wilder smoothing of DX
  if (dx.length >= period) {
    let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period
    adx[period * 2 - 1] = adxVal
    for (let j = period; j < dx.length; j++) {
      adxVal = (adxVal * (period - 1) + dx[j]) / period
      adx[period + j] = adxVal
    }
  }
  return { adx, plusDI, minusDI }
}

/**
 * Stochastic RSI — applies the stochastic oscillator to RSI values, giving
 * a faster, more sensitive momentum read than RSI alone. Returns %K and %D
 * lines on a 0..100 scale.
 */
function calcStochRSI(
  data: Candle[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): { k: (number | null)[]; d: (number | null)[] } {
  const n = data.length
  const rsi = calcRSI(data, rsiPeriod)
  const rawK = new Array<number | null>(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (rsi[i] == null || i < stochPeriod - 1) continue
    let lo = Infinity,
      hi = -Infinity,
      ok = true
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const r = rsi[j]
      if (r == null) {
        ok = false
        break
      }
      if (r < lo) lo = r
      if (r > hi) hi = r
    }
    if (!ok) continue
    rawK[i] = hi > lo ? (((rsi[i] as number) - lo) / (hi - lo)) * 100 : 0
  }
  const k = smaNullable(rawK, kSmooth)
  const d = smaNullable(k, dSmooth)
  return { k, d }
}

/** On-Balance Volume — cumulative volume flow that confirms price moves. */
function calcOBV(data: Candle[]): number[] {
  const out = new Array<number>(data.length).fill(0)
  for (let i = 1; i < data.length; i++) {
    const prev = out[i - 1]
    if (data[i].close > data[i - 1].close) out[i] = prev + data[i].volume
    else if (data[i].close < data[i - 1].close) out[i] = prev - data[i].volume
    else out[i] = prev
  }
  return out
}

/**
 * Anchored VWAP (from first candle of the dataset) with ±mult·stddev bands.
 * VWAP is the institutional reference price; bands flag stretched conditions.
 */
function calcVWAP(
  data: Candle[],
  mult = 2,
): { vwap: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const n = data.length
  const vwap = new Array<number | null>(n).fill(null)
  const upper = new Array<number | null>(n).fill(null)
  const lower = new Array<number | null>(n).fill(null)
  let cumPV = 0,
    cumV = 0,
    cumPV2 = 0
  for (let i = 0; i < n; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3
    const vol = data[i].volume || 0
    cumPV += tp * vol
    cumV += vol
    cumPV2 += tp * tp * vol
    if (cumV > 0) {
      const mean = cumPV / cumV
      vwap[i] = mean
      const variance = Math.max(0, cumPV2 / cumV - mean * mean)
      const sd = Math.sqrt(variance)
      upper[i] = mean + mult * sd
      lower[i] = mean - mult * sd
    }
  }
  return { vwap, upper, lower }
}

interface Divergence {
  time: number
  type: 'bull' | 'bear'
  price: number
}

/**
 * RSI divergence detection. Compares consecutive price pivots against RSI
 * pivots: a higher price high with a lower RSI high is bearish divergence;
 * a lower price low with a higher RSI low is bullish divergence.
 */
function detectRSIDivergence(
  data: Candle[],
  rsi: (number | null)[],
  lookback = 5,
  maxBars = 80,
): Divergence[] {
  const out: Divergence[] = []
  const n = data.length
  const start = Math.max(lookback, n - maxBars)
  const pivHigh: number[] = []
  const pivLow: number[] = []
  for (let i = lookback; i < n - lookback; i++) {
    let isH = true,
      isL = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue
      if (data[j].high >= data[i].high) isH = false
      if (data[j].low <= data[i].low) isL = false
    }
    if (isH) pivHigh.push(i)
    if (isL) pivLow.push(i)
  }
  for (let p = 1; p < pivHigh.length; p++) {
    const a = pivHigh[p - 1],
      b = pivHigh[p]
    if (b < start || rsi[a] == null || rsi[b] == null) continue
    if (data[b].high > data[a].high && (rsi[b] as number) < (rsi[a] as number))
      out.push({ time: data[b].time, type: 'bear', price: data[b].high })
  }
  for (let p = 1; p < pivLow.length; p++) {
    const a = pivLow[p - 1],
      b = pivLow[p]
    if (b < start || rsi[a] == null || rsi[b] == null) continue
    if (data[b].low < data[a].low && (rsi[b] as number) > (rsi[a] as number))
      out.push({ time: data[b].time, type: 'bull', price: data[b].low })
  }
  return out
}

function buildOrderFlow(
  data: Candle[],
  nwe: NWE,
): { overlay: OFOverlaySignal[]; log: OrderFlowSignal[] } {
  const volArr = data.map((x) => x.volume)
  const volSma = smaNum(volArr, 20)
  const overlay: OFOverlaySignal[] = []
  const log: OrderFlowSignal[] = []
  for (let i = 1; i < data.length; i++) {
    const up = nwe.upper[i],
      lo = nwe.lower[i],
      upPrev = nwe.upper[i - 1],
      loPrev = nwe.lower[i - 1]
    if (up == null || lo == null || upPrev == null || loPrev == null) continue
    const c = data[i],
      p = data[i - 1]
    // X48 Midnight Hunter rebound: previous bar pokes outside the band, then the
    // current bar reverses — sell after an upper-band rejection, buy after lower.
    const sell = p.high > upPrev && p.close > p.open && c.close < c.open
    const buy = p.low < loPrev && p.close < p.open && c.close > c.open
    if (!sell && !buy) continue

    const vs = volSma[i]
    const volRatio = vs ? (c.volume / vs).toFixed(1) : '—'
    const timeStr = new Date(c.time * 1000).toLocaleDateString('vi-VN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const type = sell ? 'sell' : 'buy'
    overlay.push({
      time: c.time,
      type,
      ratio: volRatio,
      nweUpper: up,
      nweLower: lo,
      high: c.high,
      low: c.low,
    })
    log.unshift({ type, price: fmtP(c.close), ratio: volRatio, time: timeStr })
  }
  return { overlay, log: log.slice(0, 6) }
}

function mlSignal(
  data: Candle[],
  nwe: NWE,
  sma50: (number | null)[],
  sma200: (number | null)[],
  rsi: (number | null)[],
  macd: { hist: number[] },
  extra?: {
    adx: { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] }
    stoch: { k: (number | null)[]; d: (number | null)[] }
    obv: number[]
    vwap: (number | null)[]
    divs: Divergence[]
  },
): MLResult {
  const i = data.length - 1
  const c = data[i]
  if (!c || nwe.mid[i] == null) return { score: 0.5, label: '—', color: '#9fb9b1', features: {} }
  const f: Record<string, number> = {}

  const upI = nwe.upper[i],
    loI = nwe.lower[i],
    midI = nwe.mid[i]!
  if (upI != null && loI != null) {
    const range = upI - loI
    const pos = range > 0 ? (c.close - loI) / range : 0.5
    f['NWE_pos'] = pos < 0.2 ? 1 : pos > 0.8 ? -1 : (0.5 - pos) * 2
    f['Price>NWE_mid'] = c.close > midI ? 1 : -1
  }

  if (sma50[i] != null) f['Price>MA50'] = c.close > (sma50[i] as number) ? 1.5 : -1.5
  if (sma200[i] != null) f['Price>MA200'] = c.close > (sma200[i] as number) ? 1 : -1
  if (sma50[i] != null && sma200[i] != null)
    f['MA50>MA200'] = (sma50[i] as number) > (sma200[i] as number) ? 2 : -2

  const rv = rsi[i]
  if (rv != null) f['RSI'] = rv < 30 ? 1.5 : rv > 70 ? -1.5 : ((50 - rv) / 25) * -1

  if (macd.hist[i] != null) {
    f['MACD_hist'] = macd.hist[i] > 0 ? 1 : -1
    if (i > 0 && macd.hist[i - 1] != null)
      f['MACD_acc'] = macd.hist[i] > macd.hist[i - 1] ? 0.5 : -0.5
  }

  if (i >= 5)
    f['Mom5'] = Math.max(
      -1,
      Math.min(1, (((c.close - data[i - 5].close) / data[i - 5].close) * 100) / 3),
    )

  const volArr = data.map((x) => x.volume)
  const vsma = smaNum(volArr, 20)
  if (vsma[i] != null)
    f['VolSpike'] = c.volume > (vsma[i] as number) * 1.3 ? (c.close > c.open ? 0.6 : -0.6) : 0

  if (extra) {
    // ADX/DMI: only contributes when a real trend exists (ADX > 20). Strength
    // scales the directional read so ranging markets don't generate fake bias.
    const adxV = extra.adx.adx[i],
      pdi = extra.adx.plusDI[i],
      mdi = extra.adx.minusDI[i]
    if (adxV != null && pdi != null && mdi != null) {
      const strength = Math.max(0, Math.min(1, (adxV - 20) / 20))
      f['ADX'] = (pdi > mdi ? 1 : -1) * strength * 2
    }
    // Stochastic RSI: oversold/overbought timing.
    const sk = extra.stoch.k[i]
    if (sk != null) f['StochRSI'] = sk < 20 ? 1 : sk > 80 ? -1 : ((50 - sk) / 50) * -0.6
    // OBV slope over last 10 bars confirms or contradicts price.
    if (i >= 10) {
      const slope = extra.obv[i] - extra.obv[i - 10]
      f['OBV'] = slope > 0 ? 0.8 : slope < 0 ? -0.8 : 0
    }
    // VWAP: above = bullish control, below = bearish.
    const vw = extra.vwap[i]
    if (vw != null) f['VWAP'] = c.close > vw ? 0.8 : -0.8
    // Recent RSI divergence (within last 6 bars) is a strong reversal cue.
    const recent = extra.divs.filter((d) => d.time >= data[Math.max(0, i - 6)].time)
    if (recent.length) {
      const last = recent[recent.length - 1]
      f['Divergence'] = last.type === 'bull' ? 2 : -2
    }
  }

  const W: Record<string, number> = {
    NWE_pos: 1.5,
    'Price>NWE_mid': 2,
    'Price>MA50': 1.5,
    'Price>MA200': 1,
    'MA50>MA200': 2,
    RSI: 2,
    MACD_hist: 1.5,
    MACD_acc: 1,
    Mom5: 1,
    VolSpike: 0.8,
    ADX: 2,
    StochRSI: 1.2,
    OBV: 1,
    VWAP: 1.2,
    Divergence: 2.2,
  }
  let ws = 0,
    wt = 0
  for (const [k, v] of Object.entries(f)) {
    const w = W[k] || 1
    ws += v * w
    wt += w
  }
  const raw = wt ? ws / wt : 0
  const score = (raw + 2) / 4

  let label: string, color: string
  if (score > 0.75) {
    label = 'STRONG BUY'
    color = CHART.up
  } else if (score > 0.58) {
    label = 'BUY'
    color = CHART.up
  } else if (score > 0.42) {
    label = 'NEUTRAL'
    color = '#9fb9b1'
  } else if (score > 0.25) {
    label = 'SELL'
    color = CHART.dn
  } else {
    label = 'STRONG SELL'
    color = CHART.dn
  }
  return { score: Math.max(0, Math.min(1, score)), label, color, features: f }
}

// ── Main React component ───────────────────────────────────────────────────

interface ChartRefs {
  mainChart: any
  rsiChart: any
  candleSeries: any
  nweMidS: any
  nweUpS: any
  nweLowS: any
  ma50S: any
  ma200S: any
  rsiSeries: any
  rsiOB: any
  rsiOS: any
  volSeries: any
  vwapS: any
  vwapUpS: any
  vwapLoS: any
  cleanup: () => void
}

interface SidebarState {
  nweUpper: string
  nweMid: string
  nweLower: string
  nweZone: { text: string; cls: string }
  sigNwe: { text: string; cls: string }
  sigRsi: { text: string; cls: string }
  sigMa: { text: string; cls: string }
  sigMacd: { text: string; cls: string }
  sigTrend: { text: string; cls: string }
  sigAdx: { text: string; cls: string }
  sigStoch: { text: string; cls: string }
  sigObv: { text: string; cls: string }
  sigVwap: { text: string; cls: string }
  sigDiv: { text: string; cls: string }
  ml: MLResult
  ofLog: OrderFlowSignal[]
  vp: { poc: string; vah: string; val: string; pos: string }
  vpHvn: number
  boxFlip: { count: number; last: 'B' | 'S' | null }
  /** Latest indicator snapshot for alert evaluation. */
  rsiNow: number | null
  nweUp: number | null
  nweLo: number | null
}

const INITIAL_SIDEBAR: SidebarState = {
  nweUpper: '—',
  nweMid: '—',
  nweLower: '—',
  nweZone: { text: '—', cls: '' },
  sigNwe: { text: '—', cls: '' },
  sigRsi: { text: '—', cls: '' },
  sigMa: { text: '—', cls: '' },
  sigMacd: { text: '—', cls: '' },
  sigTrend: { text: '—', cls: '' },
  sigAdx: { text: '—', cls: '' },
  sigStoch: { text: '—', cls: '' },
  sigObv: { text: '—', cls: '' },
  sigVwap: { text: '—', cls: '' },
  sigDiv: { text: '—', cls: '' },
  ml: { score: 0.5, label: '—', color: '#9fb9b1', features: {} },
  ofLog: [],
  vp: { poc: '—', vah: '—', val: '—', pos: '—' },
  vpHvn: 0,
  boxFlip: { count: 0, last: null },
  rsiNow: null,
  nweUp: null,
  nweLo: null,
}

// ── Alerts panel sub-component ────────────────────────────────────────────

interface AlertsPanelProps {
  alerts: AlertRule[]
  onAdd: (kind: AlertKind, value: number, label?: string) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onReset: (id: string) => void
  currentPrice: number | null
  currentRsi: number | null
}

function AlertsPanel({
  alerts,
  onAdd,
  onRemove,
  onToggle,
  onReset,
  currentPrice,
  currentRsi,
}: AlertsPanelProps) {
  const [kind, setKind] = useState<AlertKind>('price-cross-up')
  const [val, setVal] = useState('')

  // Suggested default value when switching kind.
  useEffect(() => {
    if (kind === 'rsi-overbought') setVal('70')
    else if (kind === 'rsi-oversold') setVal('30')
    else if (kind === 'nwe-upper' || kind === 'nwe-lower') setVal('0')
    else if (currentPrice != null) setVal(String(Math.round(currentPrice)))
  }, [kind, currentPrice])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = Number(val)
    if (kind !== 'nwe-upper' && kind !== 'nwe-lower' && (!Number.isFinite(numeric) || numeric <= 0))
      return
    onAdd(kind, numeric || 0)
  }

  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Alerts</div>
      <form className="btc-chart__alert-form" onSubmit={submit}>
        <select
          className="btc-chart__alert-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
        >
          <option value="price-cross-up">Price ↑ crosses</option>
          <option value="price-cross-down">Price ↓ crosses</option>
          <option value="nwe-upper">Touch NWE Upper</option>
          <option value="nwe-lower">Touch NWE Lower</option>
          <option value="rsi-overbought">RSI overbought</option>
          <option value="rsi-oversold">RSI oversold</option>
        </select>
        {kind !== 'nwe-upper' && kind !== 'nwe-lower' && (
          <input
            className="btc-chart__alert-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={kind.startsWith('rsi') ? '70' : 'price'}
            aria-label="Threshold value"
          />
        )}
        <button type="submit" className="btc-chart__alert-add">
          Add
        </button>
      </form>

      {currentRsi != null && (
        <div className="btc-chart__alert-hint">
          RSI now <span>{currentRsi.toFixed(1)}</span>
          {currentPrice != null && (
            <>
              {' · '}
              <span>${formatPriceShort(currentPrice)}</span>
            </>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="btc-chart__of-empty">Chưa có alert nào</div>
      ) : (
        <div className="btc-chart__alerts-list">
          {alerts.map((r) => (
            <div
              key={r.id}
              className={`btc-chart__alert${
                !r.enabled ? ' is-off' : r.triggeredAt ? ' is-fired' : ''
              }`}
            >
              <button
                type="button"
                className="btc-chart__alert-toggle"
                onClick={() => onToggle(r.id)}
                aria-label={r.enabled ? 'Disable' : 'Enable'}
                title={r.enabled ? 'Disable' : 'Enable'}
              >
                {r.enabled ? '●' : '○'}
              </button>
              <span className="btc-chart__alert-text">{describeRule(r)}</span>
              {r.triggeredAt > 0 ? (
                <button
                  type="button"
                  className="btc-chart__alert-mini"
                  onClick={() => onReset(r.id)}
                  title="Reset trigger"
                >
                  reset
                </button>
              ) : null}
              <button
                type="button"
                className="btc-chart__alert-del"
                onClick={() => onRemove(r.id)}
                aria-label="Delete alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatPriceShort(n: number) {
  return n >= 10000
    ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : n < 1
      ? n.toFixed(5)
      : n.toFixed(2)
}

function drawSMCOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chart: any,
  series: any,
  smc: SMCResult,
  show: boolean,
) {
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!show) return

  ctx.scale(dpr, dpr)
  const ts = chart.timeScale()

  const toX = (time: number) => {
    const coord = ts.timeToCoordinate(time)
    return coord ?? -1
  }
  const toY = (price: number) => {
    const coord = series.priceToCoordinate(price)
    return coord ?? -1
  }

  // FVG boxes
  for (const fvg of smc.fvgs) {
    const x = toX(fvg.time)
    const y1 = toY(fvg.top)
    const y2 = toY(fvg.bottom)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    ctx.fillStyle = fvg.bias === 'bull' ? 'rgba(0,255,104,0.08)' : 'rgba(255,0,8,0.08)'
    ctx.strokeStyle = fvg.bias === 'bull' ? 'rgba(0,255,104,0.3)' : 'rgba(255,0,8,0.3)'
    ctx.lineWidth = 1
    const boxW = Math.max(w - x, 60)
    ctx.fillRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
    ctx.strokeRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
  }

  // Order blocks
  for (const ob of smc.orderBlocks) {
    const x = toX(ob.startTime)
    const y1 = toY(ob.high)
    const y2 = toY(ob.low)
    if (x < 0 || y1 < 0 || y2 < 0) continue
    ctx.fillStyle = ob.bias === 'bull' ? 'rgba(49,121,245,0.12)' : 'rgba(247,124,128,0.12)'
    ctx.strokeStyle = ob.bias === 'bull' ? 'rgba(49,121,245,0.5)' : 'rgba(247,124,128,0.5)'
    ctx.lineWidth = 1
    const boxW = Math.max(w - x, 40)
    ctx.fillRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
    ctx.strokeRect(x, Math.min(y1, y2), boxW, Math.abs(y2 - y1))
  }

  // Structure lines (BOS/CHoCH)
  for (const s of smc.structures) {
    const x1 = toX(s.time)
    const x2 = toX(s.endTime)
    const y = toY(s.price)
    if (x1 < 0 || x2 < 0 || y < 0) continue
    ctx.strokeStyle = s.bias === 'bull' ? '#089981' : '#F23645'
    ctx.lineWidth = s.type === 'CHoCH' ? 2 : 1
    ctx.setLineDash(s.type === 'CHoCH' ? [] : [4, 3])
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
    ctx.setLineDash([])
    // Label
    ctx.font = '9px monospace'
    ctx.fillStyle = s.bias === 'bull' ? '#089981' : '#F23645'
    ctx.fillText(s.type, (x1 + x2) / 2 - 10, y - 4)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function drawBoxFlipOverlay(
  canvas: HTMLCanvasElement,
  mainEl: HTMLElement,
  chart: any,
  series: any,
  candles: Candle[],
  boxFlip: BoxFlipResult,
  visible: boolean,
) {
  const rect = mainEl.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  canvas.style.top = '0'
  canvas.style.left = '0'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)
  if (!visible || !candles.length) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }

  const timeScale = chart.timeScale()
  const visibleRange = timeScale.getVisibleLogicalRange?.()
  const visibleFrom =
    visibleRange && Number.isFinite(visibleRange.from)
      ? Math.max(0, Math.floor(visibleRange.from) - 8)
      : 0
  const visibleTo =
    visibleRange && Number.isFinite(visibleRange.to)
      ? Math.min(candles.length - 1, Math.ceil(visibleRange.to) + 8)
      : candles.length - 1
  const toX = (idx: number) => {
    const candle = candles[Math.max(0, Math.min(candles.length - 1, idx))]
    const x = timeScale.timeToCoordinate(candle.time)
    return typeof x === 'number' ? x : null
  }
  const toY = (price: number) => {
    const y = series.priceToCoordinate(price)
    return typeof y === 'number' ? y : null
  }

  const visibleBoxes = boxFlip.boxes
    .filter((box) => {
      const end = box.endIndex ?? candles.length - 1
      return end >= visibleFrom && box.startIndex <= visibleTo
    })
    .slice(-8)

  for (let idx = 0; idx < visibleBoxes.length; idx++) {
    const box = visibleBoxes[idx]
    const x1 = toX(box.startIndex)
    const x2 = toX(box.endIndex ?? candles.length - 1)
    const yHigh = toY(box.high)
    const yLow = toY(box.low)
    if (x1 == null || x2 == null || yHigh == null || yLow == null) continue

    const x = Math.min(x1, x2)
    const y = Math.min(yHigh, yLow)
    const w = Math.max(4, Math.abs(x2 - x1))
    const h = Math.max(2, Math.abs(yLow - yHigh))
    const isBull = box.dir === 'B'
    const isBear = box.dir === 'S'
    const isLatest = idx === visibleBoxes.length - 1

    ctx.fillStyle = isLatest
      ? isBull
        ? 'rgba(34,197,94,0.105)'
        : isBear
          ? 'rgba(249,115,22,0.105)'
          : 'rgba(148,163,184,0.095)'
      : isBull
        ? 'rgba(34,197,94,0.026)'
        : isBear
          ? 'rgba(249,115,22,0.026)'
          : 'rgba(148,163,184,0.018)'
    ctx.strokeStyle = isBull
      ? isLatest
        ? 'rgba(34,197,94,0.86)'
        : 'rgba(34,197,94,0.26)'
      : isBear
        ? isLatest
          ? 'rgba(249,115,22,0.86)'
          : 'rgba(249,115,22,0.26)'
        : isLatest
          ? 'rgba(203,213,225,0.76)'
          : 'rgba(148,163,184,0.16)'
    ctx.lineWidth = isLatest ? 2.5 : 1
    ctx.setLineDash(isLatest ? [] : [5, 4])
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)

    if (isLatest) {
      const guideColor = isBull
        ? 'rgba(34,197,94,0.72)'
        : isBear
          ? 'rgba(249,115,22,0.72)'
          : 'rgba(203,213,225,0.58)'
      ctx.save()
      ctx.strokeStyle = guideColor
      ctx.lineWidth = 1.25
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(Math.min(rect.width, x + w + 120), y)
      ctx.moveTo(x, y + h)
      ctx.lineTo(Math.min(rect.width, x + w + 120), y + h)
      ctx.stroke()
      ctx.restore()
    }

    if (isLatest || box.dir) {
      const tag = box.dir ?? 'BOX'
      const tagColor = isBull ? '#22c55e' : isBear ? '#f97316' : '#94a3b8'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'top'
      const label = `${tag} ${fmtP(box.low)}-${fmtP(box.high)}`
      const tw = ctx.measureText(label).width + 10
      const labelX = Math.max(6, Math.min(x + 4, rect.width - tw - 6))
      const labelY = Math.max(6, y + 4)
      ctx.fillStyle = 'rgba(7,16,17,0.78)'
      ctx.fillRect(labelX, labelY, tw, 18)
      ctx.strokeStyle = tagColor
      ctx.setLineDash([])
      ctx.strokeRect(labelX, labelY, tw, 18)
      ctx.fillStyle = tagColor
      ctx.fillText(label, labelX + 5, labelY + 4)
    }
  }

  ctx.setLineDash([])
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function BtcChartView() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mainElRef = useRef<HTMLDivElement>(null)
  const rsiElRef = useRef<HTMLDivElement>(null)
  const vpCanvasRef = useRef<HTMLCanvasElement>(null)
  const ofCanvasRef = useRef<HTMLCanvasElement>(null)
  const smcCanvasRef = useRef<HTMLCanvasElement>(null)
  const boxCanvasRef = useRef<HTMLCanvasElement>(null)
  const smcDataRef = useRef<SMCResult>({ structures: [], orderBlocks: [], fvgs: [] })
  const boxFlipRef = useRef<BoxFlipResult>({ boxes: [], signals: [] })
  const ofOverlayRef = useRef<OFOverlaySignal[]>([])
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRefs = useRef<ChartRefs | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const hiLoLinesRef = useRef<{ high: any; low: any } | null>(null)
  // Advanced oscillator pane (ADX / StochRSI / OBV) — created on demand.
  const oscElRef = useRef<HTMLDivElement>(null)
  const oscRefs = useRef<{
    chart: any
    adxS: any
    plusDIS: any
    minusDIS: any
    adxRef: any
    stochKS: any
    stochDS: any
    stochOB: any
    stochOS: any
    obvS: any
    cleanup: () => void
  } | null>(null)

  // Boot configuration (vis flags + interval + alerts + sound + zoom).
  const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

  const visRef = useRef<VisFlags>({ ...cfgInit.vis })
  const vpOptsRef = useRef({ heatmap: true, hvnRatio: 0.8 })
  const alertsRef = useRef<AlertRule[]>([...cfgInit.alerts])
  const soundRef = useRef<AlertSound>(new AlertSound())
  const lastPriceRef = useRef<number | null>(null)
  // Latest computed indicator snapshot — read from inside the WS handler.
  const sidebarRef = useRef<SidebarState>(INITIAL_SIDEBAR)

  const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
  const [symbol, setSymbol] = useState<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const [customSymbols, setCustomSymbols] = useState<SymbolEntry[]>(loadCustomSymbols)
  const allSymbols: SymbolEntry[] = [...SYMBOLS, ...customSymbols]
  const symbolInfo: SymbolEntry = allSymbols.find((s) => s.symbol === symbol) || {
    symbol,
    base: symbol.replace(/USDT$/, ''),
    quote: 'USDT',
    exchange: 'binance' as Exchange,
  }
  // Also keep a ref so effects always see the latest value without stale closures
  const symbolInfoRef = useRef(symbolInfo)
  symbolInfoRef.current = symbolInfo
  const [vis, setVis] = useState<VisFlags>(visRef.current)
  const [vpOpts, setVpOpts] = useState(vpOptsRef.current)
  const [oscOpen, setOscOpen] = useState<boolean>(cfgInit.oscOpen)
  const [oscView, setOscView] = useState<OscView>(cfgInit.oscView)
  const oscViewRef = useRef<OscView>(cfgInit.oscView)
  oscViewRef.current = oscView
  const [alerts, setAlerts] = useState<AlertRule[]>(alertsRef.current)
  const [sound, setSound] = useState(cfgInit.sound)
  const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
  const [firedToast, setFiredToast] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('Đang tải BTC/USDT…')
  const [wsStatus, setWsStatus] = useState({
    text: 'Idle',
    tone: 'muted' as 'muted' | 'live' | 'err',
  })
  const [lastUpdate, setLastUpdate] = useState('—')
  const [price, setPrice] = useState({ cur: '—', chg: '+0.00%', up: true })
  const [ohlcv, setOhlcv] = useState({ o: '—', h: '—', l: '—', c: '—', v: '—' })
  const [stats, setStats] = useState({ high: '—', low: '—', vol: '—', chg: '—', up: true })
  const [funding, setFunding] = useState({
    val: '—',
    sub: 'Balanced',
    cls: '',
    breakdown: [] as { name: string; rate: number }[],
  })
  const [fng, setFng] = useState({ val: '—', label: 'Loading…', color: '#9fb9b1', pct: 50 })
  const [sidebar, setSidebar] = useState<SidebarState>(INITIAL_SIDEBAR)

  // ── Positions ────────────────────────────────────────────────────────
  interface Position {
    id: string
    side: 'long' | 'short'
    type: 'isolated' | 'cross'
    entryPrice: number
    size: number // contracts / qty
    margin: number // USDT
    stopLoss: number | null
  }
  const loadPositions = (): Position[] => {
    try {
      return JSON.parse(localStorage.getItem('btc-chart:positions') || '[]')
    } catch {
      return []
    }
  }
  const [positions, setPositions] = useState<Position[]>(loadPositions)
  const [showPosForm, setShowPosForm] = useState(false)
  const [posForm, setPosForm] = useState({
    side: 'long',
    type: 'isolated',
    entry: '',
    size: '',
    margin: '',
    sl: '',
  })

  const savePositions = (ps: Position[]) => {
    setPositions(ps)
    try {
      localStorage.setItem('btc-chart:positions', JSON.stringify(ps))
    } catch {
      /* noop */
    }
  }

  const addPosition = () => {
    const entry = parseFloat(posForm.entry)
    const size = parseFloat(posForm.size)
    const margin = parseFloat(posForm.margin)
    if (!entry || !size || !margin) return
    const p: Position = {
      id: Date.now().toString(),
      side: posForm.side as 'long' | 'short',
      type: posForm.type as 'isolated' | 'cross',
      entryPrice: entry,
      size,
      margin,
      stopLoss: posForm.sl ? parseFloat(posForm.sl) : null,
    }
    savePositions([...positions, p])
    setPosForm({ side: 'long', type: 'isolated', entry: '', size: '', margin: '', sl: '' })
    setShowPosForm(false)
  }

  const calcPnl = (p: Position, mark: number) => {
    const diff = p.side === 'long' ? mark - p.entryPrice : p.entryPrice - mark
    const pnl = (diff / p.entryPrice) * p.size * p.entryPrice
    const pct = (diff / p.entryPrice) * 100
    return { pnl, pct }
  }

  // Draw entry + SL price lines on chart whenever positions change
  const posLinesRef = useRef<{ id: string; lines: any[] }[]>([])
  useEffect(() => {
    const series = chartRefs.current?.candleSeries
    if (!series) return
    // Remove old lines
    for (const entry of posLinesRef.current) {
      for (const ln of entry.lines) {
        try {
          series.removePriceLine(ln)
        } catch {
          /* noop */
        }
      }
    }
    posLinesRef.current = []
    // Add new lines
    for (const p of positions) {
      const lines: any[] = []
      lines.push(
        series.createPriceLine({
          price: p.entryPrice,
          color: p.side === 'long' ? '#34d8a4' : '#ff7a85',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${p.side.toUpperCase()} ${p.type} ${p.size}`,
        }),
      )
      if (p.stopLoss) {
        lines.push(
          series.createPriceLine({
            price: p.stopLoss,
            color: '#ffc46b',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'SL',
          }),
        )
      }
      posLinesRef.current.push({ id: p.id, lines })
    }
  }, [positions])

  // Keep refs in sync with state for use inside imperative callbacks.
  useEffect(() => {
    visRef.current = vis
  }, [vis])
  useEffect(() => {
    vpOptsRef.current = vpOpts
  }, [vpOpts])
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    soundRef.current.setVolume(sound.volume)
  }, [sound.volume])
  useEffect(() => {
    sidebarRef.current = sidebar
  }, [sidebar])

  // Persist on any config-affecting change.
  const persist = useCallback(
    (zoom: ChartConfig['zoom'] | undefined) => {
      saveConfig({
        version: 1,
        interval,
        symbol,
        vis,
        zoom: zoom === undefined ? loadConfig().zoom : zoom,
        alerts,
        sound,
        notifications: notifAllowed,
        minimal: false,
        oscOpen,
        oscView,
      })
    },
    [interval, symbol, vis, alerts, sound, notifAllowed, oscOpen, oscView],
  )
  useEffect(() => {
    persist(undefined)
  }, [persist])
  // Flush pending writes on unload
  useEffect(() => {
    const onBeforeUnload = () => flushConfig()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const fitNextRef = useRef(true)

  const renderData = useCallback((data: Candle[]) => {
    const refs = chartRefs.current
    if (!data.length || !refs) return

    const v = visRef.current
    const nwe = calcMHBand(data)
    const sma50 = calcSMA(data, 50)
    const sma200 = calcSMA(data, 200)
    const rsi = calcRSI(data, 14)
    const macd = calcMACD(data)
    const adxR = calcADX(data, 14)
    const stoch = calcStochRSI(data)
    const obv = calcOBV(data)
    const vwapR = calcVWAP(data)
    const divs = detectRSIDivergence(data, rsi)
    const of_ = buildOrderFlow(data, nwe)
    const boxFlip = buildBoxFlipSignals(data, {
      minBoxBars: 10,
      maxBoxHeightPct: 0.012,
      breakoutConfirm: 'close',
      bufferPct: 0.0007,
    })
    const ml = mlSignal(data, nwe, sma50, sma200, rsi, macd, {
      adx: adxR,
      stoch,
      obv,
      vwap: vwapR.vwap,
      divs,
    })

    const toLine = (arr: (number | null)[]) =>
      data
        .map((c, i) => (arr[i] != null ? { time: c.time, value: arr[i] as number } : null))
        .filter(Boolean) as { time: number; value: number }[]

    refs.candleSeries.setData(
      data.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    // Order flow markers are drawn on our own overlay canvas in the
    // top/bottom gutter bands instead of the built-in setMarkers (which
    // hugs wicks and quickly becomes unreadable).
    const markers: any[] = []
    if (v.boxFlip) {
      for (const sig of boxFlip.signals) {
        markers.push({
          time: sig.time,
          position: sig.dir === 'B' ? 'belowBar' : 'aboveBar',
          color: sig.dir === 'B' ? '#22c55e' : '#f97316',
          shape: sig.dir === 'B' ? 'arrowUp' : 'arrowDown',
          text: sig.dir,
        })
      }
    }
    if (v.rsiDiv) {
      for (const d of divs) {
        markers.push({
          time: d.time,
          position: d.type === 'bull' ? 'belowBar' : 'aboveBar',
          color: d.type === 'bull' ? '#6fbcf0' : '#c792ea',
          shape: d.type === 'bull' ? 'arrowUp' : 'arrowDown',
          text: d.type === 'bull' ? 'Div+' : 'Div-',
        })
      }
    }
    // lightweight-charts requires markers sorted ascending by time.
    markers.sort((a, b) => a.time - b.time)
    refs.candleSeries.setMarkers(markers)
    boxFlipRef.current = boxFlip
    if (boxCanvasRef.current && mainElRef.current && refs.candleSeries) {
      drawBoxFlipOverlay(
        boxCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        data,
        boxFlip,
        v.boxFlip,
      )
    }
    ofOverlayRef.current = of_.overlay
    if (ofCanvasRef.current && mainElRef.current && refs.candleSeries) {
      drawOrderFlow(
        ofCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        v.of ? of_.overlay : [],
        true,
      )
    }

    refs.nweMidS.setData(v.nwe ? toLine(nwe.mid) : [])
    refs.nweUpS.setData(v.nwe ? toLine(nwe.upper) : [])
    refs.nweLowS.setData(v.nwe ? toLine(nwe.lower) : [])
    refs.ma50S.setData(v.ma50 ? toLine(sma50) : [])
    refs.ma200S.setData(v.ma200 ? toLine(sma200) : [])
    refs.vwapS.setData(v.vwap ? toLine(vwapR.vwap) : [])
    refs.vwapUpS.setData(v.vwap ? toLine(vwapR.upper) : [])
    refs.vwapLoS.setData(v.vwap ? toLine(vwapR.lower) : [])

    const rsiData = data
      .map((c, i) => (rsi[i] != null ? { time: c.time, value: rsi[i] as number } : null))
      .filter(Boolean) as { time: number; value: number }[]
    refs.rsiSeries.setData(v.rsi ? rsiData : [])
    refs.rsiOB.setData(v.rsi ? data.map((c) => ({ time: c.time, value: 70 })) : [])
    refs.rsiOS.setData(v.rsi ? data.map((c) => ({ time: c.time, value: 30 })) : [])

    refs.volSeries.setData(
      v.vol
        ? data.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? CHART.upSoft : CHART.dnSoft,
          }))
        : [],
    )

    // ── Advanced oscillator pane (only the selected view holds data) ──
    const osc = oscRefs.current
    if (osc) {
      const view = oscViewRef.current
      const empty: { time: number; value: number }[] = []
      osc.adxS.setData(view === 'adx' ? toLine(adxR.adx) : empty)
      osc.plusDIS.setData(view === 'adx' ? toLine(adxR.plusDI) : empty)
      osc.minusDIS.setData(view === 'adx' ? toLine(adxR.minusDI) : empty)
      osc.adxRef.setData(view === 'adx' ? data.map((c) => ({ time: c.time, value: 25 })) : empty)
      osc.stochKS.setData(view === 'stoch' ? toLine(stoch.k) : empty)
      osc.stochDS.setData(view === 'stoch' ? toLine(stoch.d) : empty)
      osc.stochOB.setData(view === 'stoch' ? data.map((c) => ({ time: c.time, value: 80 })) : empty)
      osc.stochOS.setData(view === 'stoch' ? data.map((c) => ({ time: c.time, value: 20 })) : empty)
      osc.obvS.setData(
        view === 'obv' ? data.map((c, i) => ({ time: c.time, value: obv[i] })) : empty,
      )
    }

    if (fitNextRef.current) {
      refs.mainChart.timeScale().fitContent()
      fitNextRef.current = false
    }

    if (vpCanvasRef.current && mainElRef.current) {
      const info = drawVP(vpCanvasRef.current, mainElRef.current, data.slice(-LIMIT), v.vp, {
        ...vpOptsRef.current,
        width: 220,
      })
      setSidebar((s) => ({
        ...s,
        vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
        vpHvn: info.hvnCount,
      }))
    }

    // ── SMC overlay ──
    const smcResult = v.smc
      ? computeSMC(data, {
          structure: true,
          orderBlocks: true,
          fvg: true,
          swingLen: 10,
          internalLen: 5,
        })
      : { structures: [], orderBlocks: [], fvgs: [] }
    smcDataRef.current = smcResult
    if (smcCanvasRef.current && mainElRef.current && refs.mainChart) {
      drawSMCOverlay(
        smcCanvasRef.current,
        mainElRef.current,
        refs.mainChart,
        refs.candleSeries,
        smcResult,
        v.smc,
      )
    }

    // Legend
    const i = data.length - 1
    if (legendRef.current) {
      legendRef.current.innerHTML = [
        nwe.mid[i] != null
          ? `<span style="color:${CHART.neu}">NWE ${fmtP(nwe.mid[i] as number)}</span>`
          : null,
        nwe.upper[i] != null
          ? `<span style="color:${CHART.dn}">↑ ${fmtP(nwe.upper[i] as number)}</span>`
          : null,
        nwe.lower[i] != null
          ? `<span style="color:${CHART.up}">↓ ${fmtP(nwe.lower[i] as number)}</span>`
          : null,
        sma50[i] != null
          ? `<span style="color:${CHART.ma50}">MA50 ${fmtP(sma50[i] as number)}</span>`
          : null,
        sma200[i] != null
          ? `<span style="color:${CHART.hi}">MA200 ${fmtP(sma200[i] as number)}</span>`
          : null,
        rsi[i] != null
          ? `<span style="color:${CHART.neu}">RSI ${(rsi[i] as number).toFixed(1)}</span>`
          : null,
        v.vwap && vwapR.vwap[i] != null
          ? `<span style="color:#c792ea">VWAP ${fmtP(vwapR.vwap[i] as number)}</span>`
          : null,
      ]
        .filter(Boolean)
        .join('')
    }

    // Sidebar update
    const c = data[i]
    let zoneText = '—',
      zoneCls = ''
    if (nwe.upper[i] != null && nwe.lower[i] != null) {
      if (c.close > (nwe.upper[i] as number)) {
        zoneText = 'Above Upper'
        zoneCls = 'dn'
      } else if (c.close < (nwe.lower[i] as number)) {
        zoneText = 'Below Lower'
        zoneCls = 'up'
      } else {
        zoneText = 'Inside Band'
      }
    }

    const rv = rsi[i]
    const sigRsi =
      rv != null
        ? {
            text: `${rv.toFixed(1)}${rv < 30 ? ' (OS)' : rv > 70 ? ' (OB)' : ''}`,
            cls: rv < 30 ? 'up' : rv > 70 ? 'dn' : '',
          }
        : { text: '—', cls: '' }

    const sigMa =
      sma50[i] != null && sma200[i] != null
        ? (sma50[i] as number) > (sma200[i] as number)
          ? { text: '▲ Golden Cross', cls: 'up' }
          : { text: '▼ Death Cross', cls: 'dn' }
        : { text: '—', cls: '' }

    const mh = macd.hist[i]
    const sigMacd =
      mh != null
        ? mh > 0
          ? { text: '▲ Bull', cls: 'up' }
          : { text: '▼ Bear', cls: 'dn' }
        : { text: '—', cls: '' }

    const sigTrend =
      sma50[i] != null
        ? c.close > (sma50[i] as number)
          ? { text: '▲ Uptrend', cls: 'up' }
          : { text: '▼ Downtrend', cls: 'dn' }
        : { text: '—', cls: '' }

    let sigNwe = { text: '—', cls: '' }
    if (i > 0 && nwe.upper[i - 1] != null && nwe.lower[i - 1] != null) {
      const prev = data[i - 1]
      const sell =
        prev.high > (nwe.upper[i - 1] as number) && prev.close > prev.open && c.close < c.open
      const buy =
        prev.low < (nwe.lower[i - 1] as number) && prev.close < prev.open && c.close > c.open
      if (buy) sigNwe = { text: '▲ Buy Rebound', cls: 'up' }
      else if (sell) sigNwe = { text: '▼ Sell Rebound', cls: 'dn' }
    }

    // ADX / DMI trend strength + direction
    const adxV = adxR.adx[i],
      pdi = adxR.plusDI[i],
      mdi = adxR.minusDI[i]
    let sigAdx = { text: '—', cls: '' }
    if (adxV != null && pdi != null && mdi != null) {
      const strong = adxV >= 25
      const dir = pdi > mdi ? 'up' : 'dn'
      const regime = adxV < 20 ? 'Sideway' : strong ? 'Strong' : 'Weak'
      sigAdx = {
        text: `${adxV.toFixed(0)} · ${regime} ${pdi > mdi ? '▲+DI' : '▼-DI'}`,
        cls: adxV < 20 ? '' : dir,
      }
    }

    // Stochastic RSI %K
    const sk = stoch.k[i]
    const sigStoch =
      sk != null
        ? {
            text: `${sk.toFixed(0)}${sk < 20 ? ' (OS)' : sk > 80 ? ' (OB)' : ''}`,
            cls: sk < 20 ? 'up' : sk > 80 ? 'dn' : '',
          }
        : { text: '—', cls: '' }

    // OBV slope (last 10 bars)
    let sigObv = { text: '—', cls: '' }
    if (i >= 10) {
      const slope = obv[i] - obv[i - 10]
      sigObv = {
        text: slope > 0 ? '▲ Accumulation' : slope < 0 ? '▼ Distribution' : 'Flat',
        cls: slope > 0 ? 'up' : slope < 0 ? 'dn' : '',
      }
    }

    // VWAP position
    const vwapNow = vwapR.vwap[i]
    const sigVwap =
      vwapNow != null
        ? c.close > vwapNow
          ? { text: '▲ Above VWAP', cls: 'up' }
          : { text: '▼ Below VWAP', cls: 'dn' }
        : { text: '—', cls: '' }

    // Latest RSI divergence within recent bars
    const recentDiv = divs.filter((d) => d.time >= data[Math.max(0, i - 6)].time)
    const lastDiv = recentDiv[recentDiv.length - 1]
    const sigDiv = lastDiv
      ? lastDiv.type === 'bull'
        ? { text: '▲ Bullish Div', cls: 'up' }
        : { text: '▼ Bearish Div', cls: 'dn' }
      : { text: '—', cls: '' }

    setSidebar((s) => ({
      ...s,
      nweUpper: nwe.upper[i] != null ? fmtP(nwe.upper[i] as number) : '—',
      nweMid: nwe.mid[i] != null ? fmtP(nwe.mid[i] as number) : '—',
      nweLower: nwe.lower[i] != null ? fmtP(nwe.lower[i] as number) : '—',
      nweZone: { text: zoneText, cls: zoneCls },
      sigRsi,
      sigMa,
      sigMacd,
      sigTrend,
      sigNwe,
      sigAdx,
      sigStoch,
      sigObv,
      sigVwap,
      sigDiv,
      ml,
      ofLog: of_.log,
      boxFlip: {
        count: boxFlip.signals.length,
        last: boxFlip.signals[boxFlip.signals.length - 1]?.dir ?? null,
      },
      rsiNow: rsi[i] ?? null,
      nweUp: nwe.upper[i] ?? null,
      nweLo: nwe.lower[i] ?? null,
    }))
  }, [])

  // ── Setup charts (once) ───────────────────────────────────────────
  useEffect(() => {
    const LWC = window.LightweightCharts
    if (!LWC) {
      setLoadingText('Lỗi: lightweight-charts chưa được tải.')
      return
    }
    if (!mainElRef.current || !rsiElRef.current || !mainElRef.current.parentElement) return

    const col = mainElRef.current.parentElement

    // Use measured pane heights from the CSS flex layout. ResizeObserver below
    // keeps them in sync after first paint, so the initial values can come
    // straight from clientHeight (or a safe fallback if layout is not ready).
    const initMain = mainElRef.current.clientHeight || 360
    const initRsi = rsiElRef.current.clientHeight || 80

    const base = {
      layout: {
        background: { type: 'solid', color: CHART.bg },
        textColor: CHART.axis,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART.grid },
        horzLines: { color: CHART.grid },
      },
      crosshair: {
        mode: LWC.CrosshairMode.Normal,
        vertLine: { color: 'rgba(190,255,234,0.25)', width: 1, style: 3 },
        horzLine: { color: 'rgba(190,255,234,0.25)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: CHART.border,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: CHART.border,
        timeVisible: true,
        secondsVisible: false,
      },
    }

    const mainChart = LWC.createChart(mainElRef.current, {
      ...base,
      width: mainElRef.current.clientWidth,
      height: initMain,
      timeScale: { ...base.timeScale, visible: false },
    })
    // RSI is now the bottom pane, so it carries the visible time axis.
    const rsiChart = LWC.createChart(rsiElRef.current, {
      ...base,
      width: rsiElRef.current.clientWidth,
      height: initRsi,
      timeScale: { ...base.timeScale, visible: true },
    })

    const candleSeries = mainChart.addCandlestickSeries({
      upColor: CHART.up,
      downColor: CHART.dn,
      borderUpColor: CHART.up,
      borderDownColor: CHART.dn,
      wickUpColor: CHART.up,
      wickDownColor: CHART.dn,
    })

    const nweUpS = mainChart.addLineSeries({
      color: 'rgba(255,122,133,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH+',
    })
    const nweMidS = mainChart.addLineSeries({
      color: 'rgba(111,188,240,0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH',
    })
    const nweLowS = mainChart.addLineSeries({
      color: 'rgba(52,216,164,0.6)',
      lineWidth: 1,
      lineStyle: 0,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MH-',
    })
    const ma50S = mainChart.addLineSeries({
      color: CHART.ma50,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA50',
    })
    const ma200S = mainChart.addLineSeries({
      color: CHART.hi,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'MA200',
    })

    // VWAP (anchored) + std-dev bands
    const vwapS = mainChart.addLineSeries({
      color: '#c792ea',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'VWAP',
    })
    const vwapUpS = mainChart.addLineSeries({
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const vwapLoS = mainChart.addLineSeries({
      color: 'rgba(199,146,234,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const rsiSeries = rsiChart.addLineSeries({
      color: CHART.neu,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    const rsiOB = rsiChart.addLineSeries({
      color: 'rgba(255,122,133,0.35)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const rsiOS = rsiChart.addLineSeries({
      color: 'rgba(52,216,164,0.35)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    // Volume is overlaid on the bottom of the main price pane (own scale).
    const volSeries = mainChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    mainChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    // Reserve the bottom 20% of the price scale for volume so candles and
    // volume bars don't overlap.
    mainChart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.2 },
    })

    const sync = (src: any, ...tgts: any[]) =>
      src.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
        if (r) tgts.forEach((t) => t.timeScale().setVisibleLogicalRange(r))
      })
    sync(mainChart, rsiChart)
    sync(rsiChart, mainChart)

    // Persist zoom whenever the user pans/zooms the main chart.
    // Also redraw the order-flow overlay so pills follow the candles.
    mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (!r) return
      saveConfig({
        ...loadConfig(),
        zoom: { from: r.from, to: r.to },
      })
      if (ofCanvasRef.current && mainElRef.current) {
        drawOrderFlow(
          ofCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          visRef.current.of ? ofOverlayRef.current : [],
          true,
        )
      }
      if (smcCanvasRef.current && mainElRef.current) {
        drawSMCOverlay(
          smcCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          smcDataRef.current,
          visRef.current.smc,
        )
      }
      if (boxCanvasRef.current && mainElRef.current) {
        drawBoxFlipOverlay(
          boxCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          candlesRef.current,
          boxFlipRef.current,
          visRef.current.boxFlip,
        )
      }
      // Update visible high/low price lines
      const cands = candlesRef.current
      if (cands.length) {
        const from = Math.max(0, Math.floor(r.from))
        const to = Math.min(cands.length - 1, Math.ceil(r.to))
        let hi = -Infinity,
          lo = Infinity
        for (let i = from; i <= to; i++) {
          if (cands[i].high > hi) hi = cands[i].high
          if (cands[i].low < lo) lo = cands[i].low
        }
        if (hiLoLinesRef.current) {
          try {
            candleSeries.removePriceLine(hiLoLinesRef.current.high)
            candleSeries.removePriceLine(hiLoLinesRef.current.low)
          } catch {
            /* noop */
          }
        }
        hiLoLinesRef.current = {
          high: candleSeries.createPriceLine({
            price: hi,
            color: 'rgba(52,216,164,0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `H ${fmtP(hi)}`,
          }),
          low: candleSeries.createPriceLine({
            price: lo,
            color: 'rgba(255,122,133,0.6)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `L ${fmtP(lo)}`,
          }),
        }
      }
    })

    mainChart.subscribeCrosshairMove((param: any) => {
      if (!param?.time) return
      rsiChart.setCrosshairPosition(0, param.time, rsiSeries)
      const d = param.seriesData?.get(candleSeries)
      if (d) {
        setOhlcv({
          o: fmtP(d.open),
          h: fmtP(d.high),
          l: fmtP(d.low),
          c: fmtP(d.close),
          v: ohlcv.v,
        })
      }
    })

    // Observe each pane element so chart libs see real measured heights,
    // and CSS flex keeps them in correct ratios.
    const syncSize = () => {
      if (!mainElRef.current || !rsiElRef.current) return
      const mw = mainElRef.current.clientWidth
      const mh2 = mainElRef.current.clientHeight
      const rh2 = rsiElRef.current.clientHeight
      if (mh2 <= 0 || rh2 <= 0) return
      mainChart.applyOptions({ width: mw, height: mh2 })
      rsiChart.applyOptions({ width: rsiElRef.current.clientWidth, height: rh2 })
      if (candlesRef.current.length && vpCanvasRef.current) {
        const info = drawVP(
          vpCanvasRef.current,
          mainElRef.current,
          candlesRef.current.slice(-LIMIT),
          visRef.current.vp,
          vpOptsRef.current,
        )
        setSidebar((s) => ({
          ...s,
          vp: { poc: info.poc, vah: info.vah, val: info.val, pos: info.pos },
          vpHvn: info.hvnCount,
        }))
      }
      if (ofCanvasRef.current) {
        drawOrderFlow(
          ofCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          visRef.current.of ? ofOverlayRef.current : [],
          true,
        )
      }
      if (boxCanvasRef.current) {
        drawBoxFlipOverlay(
          boxCanvasRef.current,
          mainElRef.current,
          mainChart,
          candleSeries,
          candlesRef.current,
          boxFlipRef.current,
          visRef.current.boxFlip,
        )
      }
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(col)
    ro.observe(mainElRef.current)
    ro.observe(rsiElRef.current)
    // First sync after layout settles
    requestAnimationFrame(syncSize)

    chartRefs.current = {
      mainChart,
      rsiChart,
      candleSeries,
      nweMidS,
      nweUpS,
      nweLowS,
      ma50S,
      ma200S,
      rsiSeries,
      rsiOB,
      rsiOS,
      volSeries,
      vwapS,
      vwapUpS,
      vwapLoS,
      cleanup: () => {
        ro.disconnect()
        try {
          mainChart.remove()
        } catch {
          /* noop */
        }
        try {
          rsiChart.remove()
        } catch {
          /* noop */
        }
      },
    }

    return () => {
      chartRefs.current?.cleanup()
      chartRefs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Advanced oscillator pane (ADX / StochRSI / OBV) ────────────────
  // Created only while open to keep the base chart light. Time scale is
  // kept in sync with the main chart in both directions.
  useEffect(() => {
    if (!oscOpen) return
    const LWC = window.LightweightCharts
    const mainChart = chartRefs.current?.mainChart
    if (!LWC || !oscElRef.current || !mainChart) return

    const el = oscElRef.current
    const chart = LWC.createChart(el, {
      layout: {
        background: { type: 'solid', color: CHART.bg },
        textColor: CHART.axis,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART.grid },
        horzLines: { color: CHART.grid },
      },
      crosshair: { mode: LWC.CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderColor: CHART.border, timeVisible: true, secondsVisible: false },
      width: el.clientWidth || 600,
      height: el.clientHeight || 150,
    })

    const lineOpts = (color: string, width = 1.5, dashed = false) => ({
      color,
      lineWidth: width,
      lineStyle: dashed ? 2 : 0,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    const adxRef = chart.addLineSeries(lineOpts('rgba(255,255,255,0.18)', 1, true))
    const adxS = chart.addLineSeries({ ...lineOpts('#ffc46b', 2), title: 'ADX' })
    const plusDIS = chart.addLineSeries({ ...lineOpts('#34d8a4', 1.5), title: '+DI' })
    const minusDIS = chart.addLineSeries({ ...lineOpts('#ff7a85', 1.5), title: '-DI' })
    const stochOB = chart.addLineSeries(lineOpts('rgba(255,122,133,0.3)', 1, true))
    const stochOS = chart.addLineSeries(lineOpts('rgba(52,216,164,0.3)', 1, true))
    const stochKS = chart.addLineSeries({ ...lineOpts('#6fbcf0', 2), title: '%K' })
    const stochDS = chart.addLineSeries({ ...lineOpts('#ffc46b', 1.5), title: '%D' })
    const obvS = chart.addLineSeries({ ...lineOpts('#80ffd5', 2), title: 'OBV' })

    const syncFrom = mainChart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (r) chart.timeScale().setVisibleLogicalRange(r)
    })
    chart.timeScale().subscribeVisibleLogicalRangeChange((r: any) => {
      if (r) mainChart.timeScale().setVisibleLogicalRange(r)
    })
    // Match current main-chart view immediately.
    const cur = mainChart.timeScale().getVisibleLogicalRange()
    if (cur) chart.timeScale().setVisibleLogicalRange(cur)

    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0)
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    oscRefs.current = {
      chart,
      adxS,
      plusDIS,
      minusDIS,
      adxRef,
      stochKS,
      stochDS,
      stochOB,
      stochOS,
      obvS,
      cleanup: () => {
        ro.disconnect()
        try {
          mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncFrom)
        } catch {
          /* noop */
        }
        try {
          chart.remove()
        } catch {
          /* noop */
        }
      },
    }

    requestAnimationFrame(() => {
      if (el.clientHeight > 0)
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
      if (candlesRef.current.length) renderData(candlesRef.current)
    })

    return () => {
      oscRefs.current?.cleanup()
      oscRefs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oscOpen])

  // Re-render oscillator series when switching which one is shown.
  useEffect(() => {
    if (oscOpen && oscRefs.current && candlesRef.current.length) {
      queueMicrotask(() => renderData(candlesRef.current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oscView])

  // ── Fetch klines + open WS for the selected interval ───────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadingText(
      `Tải dữ liệu ${symbolInfoRef.current.base}/${symbolInfoRef.current.quote} ${interval}…`,
    )
    fitNextRef.current = true

    const closeWs = () => {
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* noop */
        }
        wsRef.current = null
      }
    }

    const connectWs = (spotMode = false) => {
      let ws: WebSocket
      const info = symbolInfoRef.current
      if (info.exchange === 'mexc') {
        const msym = 'mexcSymbol' in info ? info.mexcSymbol : symbol
        ws = new WebSocket('wss://contract.mexc.com/edge')
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              method: 'sub.kline',
              param: { symbol: msym, interval: MEXC_INTERVAL[interval] },
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          if (msg.channel !== 'push.kline') return
          const k = msg.data
          if (!k) return
          const candle: Candle = {
            time: Math.floor(Number(k.t) / 1000),
            open: +k.o,
            high: +k.h,
            low: +k.l,
            close: +k.c,
            volume: +k.v,
          }
          const arr = candlesRef.current
          const last = arr[arr.length - 1]
          if (last && last.time === candle.time) arr[arr.length - 1] = candle
          else if (!last || candle.time > last.time) {
            arr.push(candle)
            if (arr.length > LIMIT + 50) arr.shift()
          }
          chartRefs.current?.candleSeries.update({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
          chartRefs.current?.volSeries.update({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
          })
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k.end) renderData(arr)
        }
      } else if (info.exchange === 'bybit') {
        const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
        ws = new WebSocket(`wss://stream.bybit.com/v5/public/${cat}`)
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              op: 'subscribe',
              args: [`kline.${BYBIT_INTERVAL[interval]}.${symbol}`],
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          const k = msg.data?.[0]
          if (!k) return
          const candle: Candle = {
            time: Math.floor(Number(k.start) / 1000),
            open: +k.open,
            high: +k.high,
            low: +k.low,
            close: +k.close,
            volume: +k.volume,
          }
          const arr = candlesRef.current
          const last = arr[arr.length - 1]
          if (last && last.time === candle.time) arr[arr.length - 1] = candle
          else if (!last || candle.time > last.time) {
            arr.push(candle)
            if (arr.length > LIMIT + 50) arr.shift()
          }
          chartRefs.current?.candleSeries.update({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
          chartRefs.current?.volSeries.update({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
          })
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k.confirm) renderData(arr)
        }
      } else if (info.exchange === 'okx') {
        const instId = 'okxInstId' in info ? info.okxInstId : symbol
        ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/business')
        ws.onopen = () => {
          if (cancelled) return
          ws.send(
            JSON.stringify({
              op: 'subscribe',
              args: [{ channel: 'candle' + OKX_INTERVAL[interval], instId }],
            }),
          )
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const msg = JSON.parse(ev.data)
          if (!msg.data?.[0]) return
          const k = msg.data[0]
          const candle: Candle = {
            time: Math.floor(Number(k[0]) / 1000),
            open: +k[1],
            high: +k[2],
            low: +k[3],
            close: +k[4],
            volume: +k[5],
          }
          const arr = candlesRef.current
          const last = arr[arr.length - 1]
          if (last && last.time === candle.time) arr[arr.length - 1] = candle
          else if (!last || candle.time > last.time) {
            arr.push(candle)
            if (arr.length > LIMIT + 50) arr.shift()
          }
          chartRefs.current?.candleSeries.update({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
          chartRefs.current?.volSeries.update({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
          })
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          if (k[8] === '1') renderData(arr)
        }
      } else {
        const wsUrl = spotMode
          ? `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
          : `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`
        ws = new WebSocket(wsUrl)
        ws.onerror = () => {
          // If futures WS fails, retry with spot
          if (!spotMode && !cancelled) {
            wsRef.current = null
            const spotWs = new WebSocket(
              `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
            )
            spotWs.onopen = ws.onopen
            spotWs.onmessage = ws.onmessage
            spotWs.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
            spotWs.onclose = () => {
              if (!cancelled) setWsStatus({ text: 'Closed', tone: 'muted' })
            }
            wsRef.current = spotWs
            return
          }
          setWsStatus({ text: 'Error', tone: 'err' })
        }
        ws.onopen = () => {
          if (cancelled) return
          setWsStatus({ text: 'Live', tone: 'live' })
          setLastUpdate(tsNow())
        }
        ws.onmessage = (ev) => {
          if (cancelled) return
          const k = JSON.parse(ev.data).k
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: +k.o,
            high: +k.h,
            low: +k.l,
            close: +k.c,
            volume: +k.v,
          }
          const arr = candlesRef.current
          const last = arr[arr.length - 1]
          if (last && last.time === candle.time) arr[arr.length - 1] = candle
          else if (!last || candle.time > last.time) {
            arr.push(candle)
            if (arr.length > LIMIT + 50) arr.shift()
          }
          chartRefs.current?.candleSeries.update({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
          chartRefs.current?.volSeries.update({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
          })
          setPrice((p) => ({ ...p, cur: fmtP(candle.close) }))
          setOhlcv((o) => ({ ...o, c: fmtP(candle.close) }))
          setLastUpdate(tsNow())
          // ── Alerts ─────────────────────────────────────────────────
          const ctx = {
            price: candle.close,
            prevPrice: lastPriceRef.current,
            nweUpper: sidebarRef.current.nweUp,
            nweLower: sidebarRef.current.nweLo,
            rsi: sidebarRef.current.rsiNow,
          }
          lastPriceRef.current = candle.close
          const fired = evaluateAlerts(alertsRef.current, ctx)
          if (fired.length) {
            if (sound.enabled) soundRef.current.play()
            for (const f of fired)
              pushNotification('BTC Chart Alert', `${describeRule(f.rule)} — ${f.message}`)
            setFiredToast(fired.map((f) => describeRule(f.rule)).join(' · '))
            setAlerts([...alertsRef.current])
          }
          if (k.x) renderData(arr)
        }
      }
      if (!ws.onerror) ws.onerror = () => setWsStatus({ text: 'Error', tone: 'err' })
      ws.onclose = () => {
        if (!cancelled) setWsStatus({ text: 'Closed', tone: 'muted' })
      }
      wsRef.current = ws
    }

    ;(async () => {
      try {
        let cands: Candle[]
        let usedSpot = false
        const info = symbolInfoRef.current
        if (info.exchange === 'mexc') {
          const msym = 'mexcSymbol' in info ? info.mexcSymbol : symbol
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
          if (cancelled) return
          const d = json.data
          cands = d.time
            .map((t, i) => ({
              time: t,
              open: +d.open[i],
              high: +d.high[i],
              low: +d.low[i],
              close: +d.close[i],
              volume: +d.vol[i],
            }))
            .sort((a, b) => a.time - b.time)
        } else if (info.exchange === 'bybit') {
          const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
          const r = await fetch(
            `https://api.bybit.com/v5/market/kline?category=${cat}&symbol=${symbol}&interval=${BYBIT_INTERVAL[interval]}&limit=${LIMIT}`,
          )
          if (!r.ok) throw new Error('HTTP ' + r.status)
          const json = (await r.json()) as { result: { list: string[][] } }
          if (cancelled) return
          cands = json.result.list.reverse().map((d) => ({
            time: Math.floor(Number(d[0]) / 1000),
            open: +d[1],
            high: +d[2],
            low: +d[3],
            close: +d[4],
            volume: +d[5],
          }))
        } else if (info.exchange === 'okx') {
          const instId = 'okxInstId' in info ? info.okxInstId : symbol
          const r = await fetch(
            `/api/okx/api/v5/market/candles?instId=${instId}&bar=${OKX_INTERVAL[interval]}&limit=${LIMIT}`,
          )
          if (!r.ok) throw new Error('HTTP ' + r.status)
          const json = (await r.json()) as { data: string[][] }
          if (cancelled) return
          cands = json.data.reverse().map((d) => ({
            time: Math.floor(Number(d[0]) / 1000),
            open: +d[1],
            high: +d[2],
            low: +d[3],
            close: +d[4],
            volume: +d[5],
          }))
        } else {
          // Custom/unknown symbols: use spot directly (CORS-safe).
          // Known futures symbols: try futures first.
          const isKnownFutures = (SYMBOLS as readonly any[]).some((s: any) => s.symbol === symbol)
          let raw: any[][] | null = null
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
          if (cancelled) return
          cands = raw!.map((d) => ({
            time: Math.floor(d[0] / 1000),
            open: +d[1],
            high: +d[2],
            low: +d[3],
            close: +d[4],
            volume: +d[5],
          }))
        }
        if (cancelled) return
        candlesRef.current = cands
        // Adjust price precision based on price level
        if (chartRefs.current?.candleSeries && cands.length) {
          const lastClose = cands[cands.length - 1].close
          const precision = lastClose < 0.01 ? 6 : lastClose < 1 ? 5 : lastClose < 100 ? 4 : 2
          const minMove = Math.pow(10, -precision)
          const pf = { type: 'price', precision, minMove }
          chartRefs.current.candleSeries.applyOptions({ priceFormat: pf })
          chartRefs.current.nweMidS.applyOptions({ priceFormat: pf })
          chartRefs.current.nweUpS.applyOptions({ priceFormat: pf })
          chartRefs.current.nweLowS.applyOptions({ priceFormat: pf })
          chartRefs.current.ma50S.applyOptions({ priceFormat: pf })
          chartRefs.current.ma200S.applyOptions({ priceFormat: pf })
        }
        renderData(cands)
        const savedZoom = loadConfig().zoom
        if (savedZoom && chartRefs.current?.mainChart) {
          chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(savedZoom)
        }
        connectWs(usedSpot)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setWsStatus({
          text: e instanceof Error ? e.message : 'fetch error',
          tone: 'err',
        })
        // Mock fallback
        const step =
          { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[interval] ||
          3600
        const t0 = Math.floor(Date.now() / 1000) - LIMIT * step
        let p = 65000
        const cands: Candle[] = []
        for (let i = 0; i <= LIMIT; i++) {
          const ch = (Math.random() - 0.48) * 900
          const o = p
          p = Math.max(55000, Math.min(75000, p + ch))
          const c = p
          cands.push({
            time: t0 + i * step,
            open: o,
            high: Math.max(o, c) + Math.random() * 400,
            low: Math.min(o, c) - Math.random() * 400,
            close: c,
            volume: 200 + Math.random() * 1800,
          })
        }
        candlesRef.current = cands
        renderData(cands)
        setWsStatus({ text: 'Demo data (offline)', tone: 'err' })
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
      closeWs()
    }
  }, [interval, symbol, renderData])

  // ── Background polls: ticker / funding / fng ───────────────────────
  useEffect(() => {
    let stopped = false

    const fetchTicker = async () => {
      try {
        let p: number, ch: number, high: number, low: number, vol: number, quoteVol: number
        const info = symbolInfoRef.current
        if (info.exchange === 'mexc') {
          const msym = 'mexcSymbol' in info ? info.mexcSymbol : symbol
          const json = await (await fetch(`/api/mexc/api/v1/contract/ticker?symbol=${msym}`)).json()
          const t = json.data
          if (!t || stopped) return
          p = +t.lastPrice
          high = +t.high24Price
          low = +t.lower24Price
          vol = +t.volume24
          quoteVol = +t.amount24
          ch = +t.riseFallRate * 100
        } else if (info.exchange === 'okx') {
          const instId = 'okxInstId' in info ? info.okxInstId : symbol
          const json = await (await fetch(`/api/okx/api/v5/market/ticker?instId=${instId}`)).json()
          const t = json.data?.[0]
          if (!t || stopped) return
          p = +t.last
          high = +t.high24h
          low = +t.low24h
          vol = +t.vol24h
          quoteVol = +t.volCcy24h
          const open24 = +t.open24h
          ch = open24 ? ((p - open24) / open24) * 100 : 0
        } else {
          // Try Binance futures first (most accurate price), fall back to Bybit or Binance spot
          const binFut = await fetch(
            `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`,
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
          if (binFut && !stopped && binFut.lastPrice) {
            p = +binFut.lastPrice
            ch = +binFut.priceChangePercent
            high = +binFut.highPrice
            low = +binFut.lowPrice
            vol = +binFut.volume
            quoteVol = +binFut.quoteVolume
          } else if (info.exchange === 'bybit') {
            const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
            const json = await (
              await fetch(
                `https://api.bybit.com/v5/market/tickers?category=${cat}&symbol=${symbol}`,
              )
            ).json()
            const t = json.result?.list?.[0]
            if (!t || stopped) return
            p = +t.lastPrice
            high = +t.highPrice24h
            low = +t.lowPrice24h
            vol = +t.volume24h
            quoteVol = +t.turnover24h
            const prev = +t.prevPrice24h
            ch = prev ? ((p - prev) / prev) * 100 : 0
          } else {
            const t = await (
              await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
            ).json()
            if (stopped) return
            p = +t.lastPrice
            ch = +t.priceChangePercent
            high = +t.highPrice
            low = +t.lowPrice
            vol = +t.volume
            quoteVol = +t.quoteVolume
          }
        }
        setPrice({ cur: fmtP(p), chg: (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%', up: ch >= 0 })
        setOhlcv((o) => ({
          ...o,
          o: fmtP(low),
          h: fmtP(high),
          l: fmtP(low),
          c: fmtP(p),
          v: fmtV(vol),
        }))
        setStats({
          high: fmtP(high),
          low: fmtP(low),
          vol: fmtV(quoteVol),
          chg: (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%',
          up: ch >= 0,
        })
      } catch {
        /* noop */
      }
    }
    const fetchFunding = async () => {
      const sym = symbol
      const info = symbolInfoRef.current
      const results: { name: string; rate: number }[] = []
      // MEXC futures (when mexcSymbol defined — user trades on MEXC)
      if ('mexcSymbol' in info) {
        try {
          const msym = info.mexcSymbol
          const d = await (await fetch(`/api/mexc/api/v1/contract/ticker?symbol=${msym}`)).json()
          if (d.data?.fundingRate) results.push({ name: 'MEXC', rate: +d.data.fundingRate * 100 })
        } catch {
          /* noop */
        }
      }
      // Binance USDM futures
      try {
        const d = await (
          await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`)
        ).json()
        if (d.lastFundingRate) results.push({ name: 'Binance', rate: +d.lastFundingRate * 100 })
      } catch {
        /* noop */
      }
      // OKX swap
      try {
        const d = await (
          await fetch(
            `https://www.okx.com/api/v5/public/funding-rate?instId=${sym.replace('USDT', '')}-USDT-SWAP`,
          )
        ).json()
        if (d.data?.[0]?.fundingRate)
          results.push({ name: 'OKX', rate: +d.data[0].fundingRate * 100 })
      } catch {
        /* noop */
      }
      // Bybit linear
      try {
        const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
        const d = await (
          await fetch(
            `https://api.bybit.com/v5/market/funding/history?category=${cat}&symbol=${sym}&limit=1`,
          )
        ).json()
        if (d.result?.list?.[0]?.fundingRate)
          results.push({ name: 'Bybit', rate: +d.result.list[0].fundingRate * 100 })
      } catch {
        /* noop */
      }
      if (stopped || results.length === 0) return
      const avg = results.reduce((s, r) => s + r.rate, 0) / results.length
      setFunding({
        val: (avg >= 0 ? '+' : '') + avg.toFixed(4) + '%',
        sub: avg > 0.1 ? 'Long heavy' : avg < 0 ? 'Short heavy' : 'Balanced',
        cls: avg > 0.05 ? 'dn' : avg < 0 ? 'up' : '',
        breakdown: results,
      })
    }
    const fetchFng = async () => {
      try {
        const d = await (await fetch('https://api.alternative.me/fng/?limit=1')).json()
        if (stopped) return
        const v = +d.data[0].value,
          cls = d.data[0].value_classification
        const col =
          v < 25
            ? CHART.dn
            : v < 45
              ? '#ffaf6b'
              : v < 55
                ? CHART.hi
                : v < 75
                  ? CHART.up
                  : CHART.ma50
        setFng({ val: String(v), label: cls, color: col, pct: v })
      } catch {
        /* noop */
      }
    }

    fetchTicker()
    fetchFunding()
    fetchFng()
    const id1 = window.setInterval(fetchTicker, 5000)
    const id2 = window.setInterval(fetchFunding, 30000)
    const id3 = window.setInterval(fetchFng, 60000)
    return () => {
      stopped = true
      clearInterval(id1)
      clearInterval(id2)
      clearInterval(id3)
    }
  }, [symbol])

  // ── Toggles ─────────────────────────────────────────────────────────
  const toggle = useCallback(
    (key: keyof VisFlags) => {
      setVis((v) => {
        const next = { ...v, [key]: !v[key] }
        visRef.current = next
        if (candlesRef.current.length) {
          // Defer to next tick so visRef is read inside renderData
          queueMicrotask(() => renderData(candlesRef.current))
        }
        return next
      })
    },
    [renderData],
  )

  // ── VP options ──────────────────────────────────────────────────────
  const toggleHeatmap = useCallback(() => {
    setVpOpts((o) => {
      const next = { ...o, heatmap: !o.heatmap }
      vpOptsRef.current = next
      queueMicrotask(() => renderData(candlesRef.current))
      return next
    })
  }, [renderData])

  // ── Alert handlers ──────────────────────────────────────────────────
  const addAlert = useCallback((kind: AlertKind, value: number, label?: string) => {
    setAlerts((rs) => [...rs, makeRule(kind, value, label)])
  }, [])
  const removeAlert = useCallback((id: string) => {
    setAlerts((rs) => rs.filter((r) => r.id !== id))
  }, [])
  const toggleAlert = useCallback((id: string) => {
    setAlerts((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled, triggeredAt: 0 } : r)),
    )
  }, [])
  const resetAlert = useCallback((id: string) => {
    setAlerts((rs) => {
      const next = [...rs]
      resetTriggers(next, id)
      return next
    })
  }, [])

  // ── Sound + notifications ───────────────────────────────────────────
  const toggleSound = useCallback(() => {
    setSound((s) => {
      const next = { ...s, enabled: !s.enabled }
      // First toggle on requires a user gesture to unlock AudioContext.
      if (next.enabled) soundRef.current.play()
      return next
    })
  }, [])
  const requestNotif = useCallback(async () => {
    const result = await ensureNotificationPermission()
    setNotifAllowed(result === 'granted')
  }, [])

  // ── Snapshot ────────────────────────────────────────────────────────
  const snapshot = useCallback(() => {
    const refs = chartRefs.current
    if (!refs || !mainElRef.current || !rsiElRef.current) return
    downloadChartSnapshot({
      main: { chart: refs.mainChart, height: mainElRef.current.clientHeight },
      rsi: visRef.current.rsi
        ? { chart: refs.rsiChart, height: rsiElRef.current.clientHeight }
        : null,
      vpOverlay: visRef.current.vp ? vpCanvasRef.current : null,
      ofOverlay: visRef.current.of ? ofCanvasRef.current : null,
    })
  }, [])

  // ── Import / Export config ──────────────────────────────────────────
  const exportNow = useCallback(() => {
    exportConfig({
      version: 1,
      interval,
      symbol,
      vis,
      zoom: loadConfig().zoom,
      alerts,
      sound,
      notifications: notifAllowed,
      minimal: false,
      oscOpen,
      oscView,
    })
  }, [interval, symbol, vis, alerts, sound, notifAllowed, oscOpen, oscView])

  const importNow = useCallback(
    async (file: File) => {
      try {
        const cfg = await importConfigFromFile(file)
        setVis(cfg.vis)
        visRef.current = cfg.vis
        setAlerts(cfg.alerts)
        alertsRef.current = cfg.alerts
        setSound(cfg.sound)
        setNotifAllowed(cfg.notifications)
        setOscOpen(cfg.oscOpen)
        setOscView(cfg.oscView)
        if (cfg.interval !== interval) setInterval_(cfg.interval as Interval)
        // restore zoom if present
        if (cfg.zoom && chartRefs.current?.mainChart) {
          chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(cfg.zoom)
        }
        saveConfig(cfg)
        setImportErr(null)
      } catch (e) {
        setImportErr(e instanceof Error ? e.message : 'invalid file')
      }
    },
    [interval],
  )

  // ── Toast auto-dismiss ──────────────────────────────────────────────
  useEffect(() => {
    if (!firedToast) return
    const t = setTimeout(() => setFiredToast(null), 5000)
    return () => clearTimeout(t)
  }, [firedToast])

  const indButtons: { key: keyof VisFlags; label: string; sep?: boolean }[] = [
    { key: 'nwe', label: 'MH Band' },
    { key: 'ma50', label: 'MA50' },
    { key: 'ma200', label: 'MA200' },
    { key: 'smc', label: 'SMC' },
    { key: 'boxFlip', label: 'Box Flip' },
    { key: 'of', label: 'Order Flow' },
    { key: 'vwap', label: 'VWAP' },
    { key: 'rsiDiv', label: 'RSI Div' },
    { key: 'vp', label: 'Vol Profile', sep: true },
    { key: 'rsi', label: 'RSI' },
    { key: 'vol', label: 'Volume' },
  ]

  return (
    <div className={`btc-chart${loading ? '' : ' is-ready'}`} ref={rootRef}>
      <div className={`btc-chart__loading${loading ? '' : ' is-done'}`} aria-hidden={!loading}>
        <div className="btc-chart__spinner" />
        <span className="btc-chart__loading-text">{loadingText}</span>
      </div>
      {firedToast && (
        <div className="btc-chart__toast" role="status">
          <span className="btc-chart__toast-tag">ALERT</span>
          <span>{firedToast}</span>
          <button
            type="button"
            className="btc-chart__toast-x"
            onClick={() => setFiredToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {importErr && (
        <div className="btc-chart__toast btc-chart__toast--err" role="alert">
          <span className="btc-chart__toast-tag">IMPORT</span>
          <span>{importErr}</span>
          <button type="button" className="btc-chart__toast-x" onClick={() => setImportErr(null)}>
            ×
          </button>
        </div>
      )}
      {/* Header */}
      <div className="btc-chart__header">
        <span className="btc-chart__pair">
          {symbolInfo.base}
          <small>/ {symbolInfo.quote}</small>
        </span>
        <select
          className="btc-chart__symbol-select"
          value={symbol}
          onChange={(e) => {
            const next = e.target.value as SymbolId
            setSymbol(next)
            try {
              const saved = JSON.parse(localStorage.getItem('btc-chart:config:v1') || '{}')
              localStorage.setItem(
                'btc-chart:config:v1',
                JSON.stringify({ ...saved, symbol: next }),
              )
            } catch {
              /* noop */
            }
          }}
          aria-label="Select trading pair"
        >
          {allSymbols.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.base}/{s.quote}
            </option>
          ))}
        </select>
        <form
          className="btc-chart__custom-sym"
          onSubmit={async (e) => {
            e.preventDefault()
            const input = (e.target as HTMLFormElement).elements.namedItem(
              'coin',
            ) as HTMLInputElement
            const raw = input.value.trim().toUpperCase()
            if (!raw) return
            const sym = raw.endsWith('USDT') ? raw : raw + 'USDT'
            const base = sym.replace(/USDT$/, '')
            if (!allSymbols.find((s) => s.symbol === sym)) {
              try {
                const [spot, fut] = await Promise.all([
                  fetch(
                    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=1`,
                  ).then((r) => r.ok),
                  fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&limit=1`)
                    .then((r) => r.ok)
                    .catch(() => false),
                ])
                if (!spot && !fut) {
                  setFiredToast(`${base} không có trên Binance`)
                  input.value = ''
                  return
                }
              } catch {
                setFiredToast(`Không thể kiểm tra ${base} trên Binance`)
                input.value = ''
                return
              }
              const entry: SymbolEntry = { symbol: sym, base, quote: 'USDT', exchange: 'binance' }
              const next = [...customSymbols, entry]
              setCustomSymbols(next)
              saveCustomSymbols(next)
            }
            setSymbol(sym)
            try {
              const saved = JSON.parse(localStorage.getItem('btc-chart:config:v1') || '{}')
              localStorage.setItem('btc-chart:config:v1', JSON.stringify({ ...saved, symbol: sym }))
            } catch {
              /* noop */
            }
            input.value = ''
          }}
        >
          <input
            name="coin"
            className="btc-chart__custom-input"
            placeholder="+ coin"
            aria-label="Add custom coin"
          />
        </form>
        <div className="btc-chart__intervals">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              className={`btc-chart__iv-btn${interval === iv ? ' is-active' : ''}`}
              onClick={() => {
                setInterval_(iv)
                try {
                  const saved = JSON.parse(localStorage.getItem('btc-chart:config:v1') || '{}')
                  localStorage.setItem(
                    'btc-chart:config:v1',
                    JSON.stringify({ ...saved, interval: iv }),
                  )
                } catch {
                  /* noop */
                }
              }}
            >
              {iv.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="btc-chart__price">
          <span className={`btc-chart__price-cur ${price.up ? 'up' : 'dn'}`}>{price.cur}</span>
          <span className={`btc-chart__price-chg ${price.up ? 'up' : 'dn'}`}>{price.chg}</span>
        </div>
        <div className="btc-chart__ohlcv">
          <span>
            O <span>{ohlcv.o}</span>
          </span>
          <span>
            H <span>{ohlcv.h}</span>
          </span>
          <span>
            L <span>{ohlcv.l}</span>
          </span>
          <span>
            C <span>{ohlcv.c}</span>
          </span>
          <span>
            V <span>{ohlcv.v}</span>
          </span>
        </div>
        <div className="btc-chart__live">
          <span className="btc-chart__live-dot" />
          Live
        </div>
      </div>
      {/* Toolbar */}
      <div className="btc-chart__toolbar">
        <span className="btc-chart__tb-label">Indicators</span>
        {indButtons.map((b, idx) => (
          <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {b.sep && idx > 0 && <span className="btc-chart__sep">·</span>}
            <button
              type="button"
              className={`btc-chart__ind-btn${vis[b.key] ? ' is-on' : ''}`}
              onClick={() => toggle(b.key)}
            >
              {b.label}
            </button>
          </span>
        ))}

        <span className="btc-chart__sep">·</span>
        <button
          type="button"
          className={`btc-chart__ind-btn${vpOpts.heatmap ? ' is-on' : ''}`}
          onClick={toggleHeatmap}
          title="Toggle heatmap behind volume profile"
        >
          Heatmap
        </button>

        <div className="btc-chart__tb-spacer" />

        <button
          type="button"
          className={`btc-chart__ind-btn${sound.enabled ? ' is-on' : ''}`}
          onClick={toggleSound}
          title="Sound on alert"
          aria-label="Toggle alert sound"
        >
          {sound.enabled ? 'Sound on' : 'Sound off'}
        </button>
        <button
          type="button"
          className={`btc-chart__ind-btn${notifAllowed ? ' is-on' : ''}`}
          onClick={requestNotif}
          title="Browser notifications"
        >
          {notifAllowed ? 'Notif on' : 'Notif…'}
        </button>
        <button type="button" className="btc-chart__ind-btn" onClick={snapshot}>
          PNG
        </button>
        <button type="button" className="btc-chart__ind-btn" onClick={exportNow}>
          Export
        </button>
        <label className="btc-chart__ind-btn btc-chart__file" title="Import config JSON">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importNow(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {/* Body */}
      <div className="btc-chart__body">
        <div className="btc-chart__col">
          <div className="btc-chart__legend" ref={legendRef} />
          <canvas className="btc-chart__of-canvas" ref={ofCanvasRef} />
          <canvas className="btc-chart__smc-canvas" ref={smcCanvasRef} />
          <canvas className="btc-chart__box-canvas" ref={boxCanvasRef} />
          <div className="btc-chart__main" ref={mainElRef} />
          <div className="btc-chart__rsi" ref={rsiElRef} />
          <canvas className="btc-chart__vp-canvas" ref={vpCanvasRef} />
          {/* Advanced oscillator pane — hidden by default, toggled open */}
          <div className={`btc-chart__osc-wrap${oscOpen ? ' is-open' : ''}`}>
            <div className="btc-chart__osc-bar">
              <button
                type="button"
                className="btc-chart__osc-toggle"
                onClick={() => setOscOpen((o) => !o)}
                aria-expanded={oscOpen}
              >
                <span className="btc-chart__osc-caret">{oscOpen ? '▾' : '▸'}</span>
                Oscillators
                <span className="btc-chart__osc-hint">ADX · StochRSI · OBV</span>
              </button>
              {oscOpen && (
                <div className="btc-chart__osc-tabs">
                  {(
                    [
                      { id: 'adx', label: 'ADX / DMI' },
                      { id: 'stoch', label: 'Stoch RSI' },
                      { id: 'obv', label: 'OBV' },
                    ] as { id: OscView; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`btc-chart__osc-tab${oscView === t.id ? ' is-on' : ''}`}
                      onClick={() => setOscView(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="btc-chart__osc" ref={oscElRef} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="btc-chart__sidebar">
          {/* ML signal — single block, colored by stance */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Signal</div>
            <div
              className={`btc-chart__ml ${
                sidebar.ml.score > 0.55 ? 'is-buy' : sidebar.ml.score < 0.45 ? 'is-sell' : ''
              }`}
            >
              <div className="btc-chart__ml-head">
                <span className="btc-chart__ml-label" style={{ color: sidebar.ml.color }}>
                  {sidebar.ml.label}
                </span>
                <span className="btc-chart__ml-pct">{Math.round(sidebar.ml.score * 100)}%</span>
              </div>
              <div className="btc-chart__ml-bar-wrap">
                <div
                  className="btc-chart__ml-bar"
                  style={{
                    width: Math.round(sidebar.ml.score * 100) + '%',
                    background: sidebar.ml.color,
                  }}
                />
              </div>
              <div className="btc-chart__ml-foot">Confidence · MH Band + MA + RSI + MACD</div>
            </div>
          </div>

          {/* Positions */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-header">
              <div className="btc-chart__panel-title">Positions</div>
              <button
                type="button"
                className="btc-chart__pos-add"
                onClick={() => setShowPosForm((v) => !v)}
              >
                {showPosForm ? '×' : '+ Add'}
              </button>
            </div>
            {showPosForm && (
              <div className="btc-chart__pos-form">
                <div className="btc-chart__pos-row">
                  <select
                    className="btc-chart__pos-select"
                    value={posForm.side}
                    onChange={(e) => setPosForm((f) => ({ ...f, side: e.target.value }))}
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                  <select
                    className="btc-chart__pos-select"
                    value={posForm.type}
                    onChange={(e) => setPosForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="isolated">Isolated</option>
                    <option value="cross">Cross</option>
                  </select>
                </div>
                <input
                  className="btc-chart__pos-input"
                  type="number"
                  placeholder="Giá mở (Entry)"
                  value={posForm.entry}
                  onChange={(e) => setPosForm((f) => ({ ...f, entry: e.target.value }))}
                />
                <input
                  className="btc-chart__pos-input"
                  type="number"
                  placeholder="Số lượng (Size)"
                  value={posForm.size}
                  onChange={(e) => setPosForm((f) => ({ ...f, size: e.target.value }))}
                />
                <input
                  className="btc-chart__pos-input"
                  type="number"
                  placeholder="Ký quỹ USDT (Margin)"
                  value={posForm.margin}
                  onChange={(e) => setPosForm((f) => ({ ...f, margin: e.target.value }))}
                />
                <input
                  className="btc-chart__pos-input"
                  type="number"
                  placeholder="Stop Loss (tuỳ chọn)"
                  value={posForm.sl}
                  onChange={(e) => setPosForm((f) => ({ ...f, sl: e.target.value }))}
                />
                <button type="button" className="btc-chart__pos-confirm" onClick={addPosition}>
                  Thêm vị thế
                </button>
              </div>
            )}
            {positions.length === 0 && !showPosForm && (
              <span className="btc-chart__of-empty">Chưa có vị thế</span>
            )}
            {positions.map((p) => {
              const mark = lastPriceRef.current ?? p.entryPrice
              const { pnl, pct } = calcPnl(p, mark)
              const liq =
                p.type === 'isolated'
                  ? p.side === 'long'
                    ? p.entryPrice * (1 - p.margin / (p.size * p.entryPrice))
                    : p.entryPrice * (1 + p.margin / (p.size * p.entryPrice))
                  : null
              return (
                <div key={p.id} className="btc-chart__pos-item">
                  <div className="btc-chart__pos-top">
                    <span className={`btc-chart__pos-side ${p.side === 'long' ? 'up' : 'dn'}`}>
                      {p.side === 'long' ? '▲ LONG' : '▼ SHORT'}
                    </span>
                    <span className="btc-chart__pos-badge">{p.type}</span>
                    <button
                      type="button"
                      className="btc-chart__pos-del"
                      onClick={() => savePositions(positions.filter((x) => x.id !== p.id))}
                    >
                      ×
                    </button>
                  </div>
                  <div className="btc-chart__pos-rows">
                    <div className="btc-chart__row">
                      <span className="btc-chart__row-label">Entry</span>
                      <span className="btc-chart__row-val">{fmtP(p.entryPrice)}</span>
                    </div>
                    <div className="btc-chart__row">
                      <span className="btc-chart__row-label">Size</span>
                      <span className="btc-chart__row-val">{p.size}</span>
                    </div>
                    <div className="btc-chart__row">
                      <span className="btc-chart__row-label">Margin</span>
                      <span className="btc-chart__row-val">{fmtP(p.margin)} USDT</span>
                    </div>
                    {p.stopLoss && (
                      <div className="btc-chart__row">
                        <span className="btc-chart__row-label">Stop Loss</span>
                        <span className="btc-chart__row-val dn">{fmtP(p.stopLoss)}</span>
                      </div>
                    )}
                    {liq && (
                      <div className="btc-chart__row">
                        <span className="btc-chart__row-label">Liq. ~</span>
                        <span className="btc-chart__row-val" style={{ color: 'var(--amber)' }}>
                          {fmtP(liq)}
                        </span>
                      </div>
                    )}
                    <div className="btc-chart__row">
                      <span className="btc-chart__row-label">PnL</span>
                      <span className={`btc-chart__row-val ${pnl >= 0 ? 'up' : 'dn'}`}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(2)} USDT ({pct >= 0 ? '+' : ''}
                        {pct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Funding */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Funding rate (avg)</div>
            <div className={`btc-chart__fund-val ${funding.cls}`}>{funding.val}</div>
            <div className={`btc-chart__fund-sentiment ${funding.cls}`}>{funding.sub}</div>
            {funding.breakdown.length > 0 && (
              <div className="btc-chart__fund-breakdown">
                {funding.breakdown.map((b) => (
                  <div key={b.name} className="btc-chart__fund-row">
                    <span>{b.name}</span>
                    <span className={b.rate < 0 ? 'up' : b.rate > 0.05 ? 'dn' : ''}>
                      {(b.rate >= 0 ? '+' : '') + b.rate.toFixed(4) + '%'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="btc-chart__fund-rules">
              <div>
                <span>&gt; 0.10%</span>
                <span className="dn">Long heavy (bearish signal)</span>
              </div>
              <div>
                <span>0 – 0.05%</span>
                <span>Balanced</span>
              </div>
              <div>
                <span>&lt; 0%</span>
                <span className="up">Short heavy (bullish signal)</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">24h stats</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">High</span>
              <span className="btc-chart__row-val">{stats.high}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Low</span>
              <span className="btc-chart__row-val">{stats.low}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Volume</span>
              <span className="btc-chart__row-val">{stats.vol}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Change</span>
              <span className={`btc-chart__row-val ${stats.up ? 'up' : 'dn'}`}>{stats.chg}</span>
            </div>
          </div>

          {/* Order Flow */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Midnight Hunter signals</div>
            {sidebar.ofLog.length === 0 ? (
              <span className="btc-chart__of-empty">Chưa có tín hiệu rebound</span>
            ) : (
              sidebar.ofLog.map((s, idx) => (
                <div key={idx} className="btc-chart__of-item">
                  <span className={`btc-chart__of-tag ${s.type === 'buy' ? 'is-buy' : 'is-sell'}`}>
                    {s.type === 'buy' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="btc-chart__of-text">
                    ${s.price} · ×{s.ratio}
                  </span>
                  <span className="btc-chart__of-time">{s.time}</span>
                </div>
              ))
            )}
            <div className="btc-chart__of-note">
              <div>
                <b className="dn">SELL ▼</b> — nến trước chọc lên trên dải trên (Upper Band) rồi nến
                hiện tại đảo chiều giảm.
              </div>
              <div>
                <b className="up">BUY ▲</b> — nến trước chọc xuống dưới dải dưới (Lower Band) rồi
                nến hiện tại đảo chiều tăng.
              </div>
              <div className="btc-chart__of-note-sub">
                ×N = bội số volume so với SMA20 (tham khảo, không phải điều kiện tín hiệu).
              </div>
            </div>
          </div>

          {/* Box Flip */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Box breakout flip</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Signals</span>
              <span className="btc-chart__row-val">{sidebar.boxFlip.count}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Last flip</span>
              <span
                className={`btc-chart__row-val ${
                  sidebar.boxFlip.last === 'B' ? 'up' : sidebar.boxFlip.last === 'S' ? 'dn' : ''
                }`}
              >
                {sidebar.boxFlip.last ?? '—'}
              </span>
            </div>
            <div className="btc-chart__of-note">
              <div>
                <b className="up">B</b> / <b className="dn">S</b> only prints when box breakout
                direction flips.
              </div>
            </div>
          </div>

          {/* MH Band */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Midnight Hunter Band</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Upper</span>
              <span className="btc-chart__row-val dn">{sidebar.nweUpper}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Mid</span>
              <span className="btc-chart__row-val neu">{sidebar.nweMid}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Lower</span>
              <span className="btc-chart__row-val up">{sidebar.nweLower}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Zone</span>
              <span className={`btc-chart__row-val ${sidebar.nweZone.cls}`}>
                {sidebar.nweZone.text}
              </span>
            </div>
          </div>

          {/* Alerts */}
          <AlertsPanel
            alerts={alerts}
            onAdd={addAlert}
            onRemove={removeAlert}
            onToggle={toggleAlert}
            onReset={resetAlert}
            currentPrice={candlesRef.current[candlesRef.current.length - 1]?.close ?? null}
            currentRsi={sidebar.rsiNow}
          />

          {/* TA Signals */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Technicals</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">MH Signal</span>
              <span className={`btc-chart__row-val ${sidebar.sigNwe.cls}`}>
                {sidebar.sigNwe.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">RSI · 14</span>
              <span className={`btc-chart__row-val ${sidebar.sigRsi.cls}`}>
                {sidebar.sigRsi.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">MA 50 / 200</span>
              <span className={`btc-chart__row-val ${sidebar.sigMa.cls}`}>
                {sidebar.sigMa.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">MACD</span>
              <span className={`btc-chart__row-val ${sidebar.sigMacd.cls}`}>
                {sidebar.sigMacd.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Trend</span>
              <span className={`btc-chart__row-val ${sidebar.sigTrend.cls}`}>
                {sidebar.sigTrend.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">ADX / DMI</span>
              <span className={`btc-chart__row-val ${sidebar.sigAdx.cls}`}>
                {sidebar.sigAdx.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">Stoch RSI</span>
              <span className={`btc-chart__row-val ${sidebar.sigStoch.cls}`}>
                {sidebar.sigStoch.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">OBV</span>
              <span className={`btc-chart__row-val ${sidebar.sigObv.cls}`}>
                {sidebar.sigObv.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">VWAP</span>
              <span className={`btc-chart__row-val ${sidebar.sigVwap.cls}`}>
                {sidebar.sigVwap.text}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">RSI Divergence</span>
              <span className={`btc-chart__row-val ${sidebar.sigDiv.cls}`}>
                {sidebar.sigDiv.text}
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Feature weights</div>
            <div className="btc-chart__features">
              {Object.entries(sidebar.ml.features).map(([k, v]) => (
                <div key={k} className="btc-chart__feat">
                  <div className="btc-chart__feat-name">{FEATURE_LABEL[k] ?? k}</div>
                  <div className={`btc-chart__feat-val ${v >= 0 ? 'up' : 'dn'}`}>
                    {v >= 0 ? '+' : ''}
                    {v.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Profile */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Volume profile</div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">POC</span>
              <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
                {sidebar.vp.poc}
              </span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">VAH · 70%</span>
              <span className="btc-chart__row-val dn">{sidebar.vp.vah}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">VAL · 70%</span>
              <span className="btc-chart__row-val up">{sidebar.vp.val}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">vs POC</span>
              <span className="btc-chart__row-val">{sidebar.vp.pos}</span>
            </div>
            <div className="btc-chart__row">
              <span className="btc-chart__row-label">HVN nodes</span>
              <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
                {sidebar.vpHvn}
              </span>
            </div>
          </div>

          {/* Fear & Greed */}
          <div className="btc-chart__panel">
            <div className="btc-chart__panel-title">Fear &amp; Greed</div>
            <div className="btc-chart__fng">
              <div className="btc-chart__fng-val" style={{ color: fng.color }}>
                {fng.val}
              </div>
              <div className="btc-chart__fng-label" style={{ color: fng.color }}>
                {fng.label}
              </div>
              <div className="btc-chart__fng-bar">
                <div className="btc-chart__fng-ptr" style={{ left: fng.pct + '%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Status */}
      <div className="btc-chart__status">
        <span
          className={
            wsStatus.tone === 'live'
              ? 'btc-chart__status-live'
              : wsStatus.tone === 'err'
                ? 'dn'
                : ''
          }
        >
          {wsStatus.text}
        </span>
        <span>{lastUpdate}</span>
        <span>OF · {sidebar.ofLog.length}</span>
        <span>Box · {sidebar.boxFlip.count}</span>
        <span className="btc-chart__status-tag">NWE · VP · Order Flow · Box Flip</span>
      </div>
    </div>
  )
}

const FEATURE_LABEL: Record<string, string> = {
  NWE_pos: 'Band Pos',
  'Price>NWE_mid': 'P>Mid',
  'Price>MA50': 'P>MA50',
  'Price>MA200': 'P>MA200',
  'MA50>MA200': 'MA50/200',
  RSI: 'RSI',
  MACD_hist: 'MACD',
  MACD_acc: 'MACD Acc',
  Mom5: 'Mom5',
  VolSpike: 'VolSpike',
  ADX: 'ADX/DMI',
  StochRSI: 'StochRSI',
  OBV: 'OBV',
  VWAP: 'VWAP',
  Divergence: 'RSI Div',
}

// ── Plugin export ──────────────────────────────────────────────────────────

const BtcChartPlugin: Plugin = {
  name: 'BtcChart',
  version: '1.0.0',
  styleUrls: ['/plugins/btc-chart/style.css'],

  init(host: HostAPI) {
    host.registerComponent('BtcChart', BtcChartView)
    host.log('BtcChart plugin initialized')
  },

  mount() {
    initSmcWasm()
    console.log('[BtcChart] mounted')
  },

  unmount() {
    console.log('[BtcChart] unmounted')
  },
}

export default BtcChartPlugin
