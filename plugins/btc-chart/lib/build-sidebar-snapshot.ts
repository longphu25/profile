// BTC Chart — pure sidebar indicator snapshot builder (no React).
import type { BoxFlipResult } from '../box-flip'
import type { SMCResult } from '../smc-wasm'
import type { BoucherResult } from './boucher-scalping'
import type { ICTResult } from './ict-sessions'
import type { LienResult } from './lien-reversal'
import type { LiquidityResult } from './liquidity'
import type { Candle, Divergence, MLResult, NWE, OrderFlowSignal, SidebarState } from './types'
import type { LuxNweResult } from './chart-render-context'
import { calcTradeSetup } from './trade-setup'
import { fmtP } from './format'

/** MACD histogram series aligned to candles. */
export interface MacdSeries {
  hist: (number | null)[]
}

/** ADX / DMI indicator bundle. */
export interface AdxSeries {
  adx: (number | null)[]
  plusDI: (number | null)[]
  minusDI: (number | null)[]
}

/** Stochastic RSI %K / %D series. */
export interface StochSeries {
  k: (number | null)[]
  d: (number | null)[]
}

/** VWAP + std-dev band series. */
export interface VwapSeries {
  vwap: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
}

/** Inputs for building the sidebar indicator snapshot at the latest bar. */
export interface BuildSidebarSnapshotParams {
  data: Candle[]
  nwe: NWE
  sma50: (number | null)[]
  sma200: (number | null)[]
  rsi: (number | null)[]
  macd: MacdSeries
  adxR: AdxSeries
  stoch: StochSeries
  obv: number[]
  vwapR: VwapSeries
  divs: Divergence[]
  ofLog: OrderFlowSignal[]
  boxFlip: BoxFlipResult
  ml: MLResult
  bScalp: BoucherResult
  lienR: LienResult
  luxNwe: LuxNweResult
  ict: ICTResult
  liq: LiquidityResult
  smcResult: SMCResult
}

/** Sidebar fields updated on each chart render (volume profile is set separately). */
export type SidebarSnapshot = Omit<SidebarState, 'vp' | 'vpHvn'>

/**
 * Build the sidebar indicator snapshot for the latest candle.
 * Pure function: no React, no side effects.
 */
export function buildSidebarSnapshot(params: BuildSidebarSnapshotParams): SidebarSnapshot {
  const {
    data,
    nwe,
    sma50,
    sma200,
    rsi,
    macd,
    adxR,
    stoch,
    obv,
    vwapR,
    divs,
    ofLog,
    boxFlip,
    ml,
    bScalp,
    lienR,
    luxNwe,
    ict,
    liq,
    smcResult,
  } = params

  const i = data.length - 1
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

  const sk = stoch.k[i]
  const sigStoch =
    sk != null
      ? {
          text: `${sk.toFixed(0)}${sk < 20 ? ' (OS)' : sk > 80 ? ' (OB)' : ''}`,
          cls: sk < 20 ? 'up' : sk > 80 ? 'dn' : '',
        }
      : { text: '—', cls: '' }

  let sigObv = { text: '—', cls: '' }
  if (i >= 10) {
    const slope = obv[i] - obv[i - 10]
    sigObv = {
      text: slope > 0 ? '▲ Accumulation' : slope < 0 ? '▼ Distribution' : 'Flat',
      cls: slope > 0 ? 'up' : slope < 0 ? 'dn' : '',
    }
  }

  const vwapNow = vwapR.vwap[i]
  const sigVwap =
    vwapNow != null
      ? c.close > vwapNow
        ? { text: '▲ Above VWAP', cls: 'up' }
        : { text: '▼ Below VWAP', cls: 'dn' }
      : { text: '—', cls: '' }

  const recentDiv = divs.filter((d) => d.time >= data[Math.max(0, i - 6)].time)
  const lastDiv = recentDiv[recentDiv.length - 1]
  const sigDiv = lastDiv
    ? lastDiv.type === 'bull'
      ? { text: '▲ Bullish Div', cls: 'up' }
      : { text: '▼ Bearish Div', cls: 'dn' }
    : { text: '—', cls: '' }

  return {
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
    ofLog,
    boxFlip: {
      count: boxFlip.signals.length,
      last: boxFlip.signals[boxFlip.signals.length - 1]?.dir ?? null,
    },
    rsiNow: rsi[i] ?? null,
    adxNow: adxR.adx[i] ?? null,
    stochKNow: stoch.k[i] ?? null,
    obvNow: obv[i] ?? null,
    nweUp: nwe.upper[i] ?? null,
    nweLo: nwe.lower[i] ?? null,
    tradeSetup: calcTradeSetup(data, nwe, rsi, adxR, ml, {
      boucher: bScalp,
      lien: lienR,
      luxNwe,
      ict,
      liquidity: liq,
      smc: smcResult,
    }),
  }
}
