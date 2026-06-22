// BTC Chart — pure technical-indicator math. No React, no IO.

import type { OFOverlaySignal } from '../order-flow-overlay'
import { fmtP } from './format'
import type { Candle, NWE, OrderFlowSignal, Divergence } from './types'

// X48 Midnight Hunter band: a centered Triangular Moving Average (TMA) of the
// weighted price (H+L+2C)/4, offset by an ATR multiple to form the 3 bands.
// The window is centered, so the most recent `halfLen` bars repaint as new
// candles close — this matches the original indicator's "handicapped bands".
export function calcMHBand(data: Candle[], halfLen = 56, atrPeriod = 110, atrMult = 2.5): NWE {
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

export function smaNum(arr: number[], period: number): (number | null)[] {
  const out = new Array<number | null>(arr.length).fill(null)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= period) sum -= arr[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function calcSMA(data: Candle[], period: number): (number | null)[] {
  const out = new Array<number | null>(data.length).fill(null)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function calcEMA(data: Candle[], period: number): number[] {
  const k = 2 / (period + 1)
  let ema = data[0].close
  return data.map((d) => {
    ema = d.close * k + ema * (1 - k)
    return ema
  })
}

export function calcRSI(data: Candle[], period = 14): (number | null)[] {
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

export function calcMACD(
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
export function smaNullable(arr: (number | null)[], period: number): (number | null)[] {
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
export function calcADX(
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
export function calcStochRSI(
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
export function calcOBV(data: Candle[]): number[] {
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
export function calcVWAP(
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

/**
 * RSI divergence detection. Compares consecutive price pivots against RSI
 * pivots: a higher price high with a lower RSI high is bearish divergence;
 * a lower price low with a higher RSI low is bullish divergence.
 */
export function detectRSIDivergence(
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

export function buildOrderFlow(
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
