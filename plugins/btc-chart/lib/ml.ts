// BTC Chart — weighted-ensemble ML signal and its feature labels.

import { CHART } from './constants'
import { smaNum } from './indicators'
import type { Candle, NWE, MLResult, Divergence } from './types'

export function mlSignal(
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
  enabledFeatures?: Record<string, boolean>,
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
    if (enabledFeatures && enabledFeatures[k] === false) continue
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

export const FEATURE_LABEL: Record<string, string> = {
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
