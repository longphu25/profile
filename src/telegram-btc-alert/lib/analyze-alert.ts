import { fetchKlines } from '@btc-chart/api'
import type { Interval } from '@btc-chart/constants'
import {
  calcADX,
  calcMACD,
  calcMHBand,
  calcOBV,
  calcRSI,
  calcSMA,
  calcStochRSI,
  calcVWAP,
} from '@btc-chart/indicators'
import { computeAdaptiveMaSeries, snapshotAdaptiveMa } from '@btc-chart/ma-adaptive'
import { mlSignal } from '@btc-chart/ml'
import { calcNadarayaWatson } from '@btc-chart/nadaraya-watson'
import { DEFAULT_SIGNAL_CONFIG } from '@btc-chart/signal-config'
import type { SymbolEntry } from '@btc-chart/symbols'
import { calcTradeSetup } from '@btc-chart/trade-setup'
import { EMPTY_TRADE_SETUP_LOCK, stabilizeTradeSetup } from '@btc-chart/trade-setup-stable'
import type { MLResult, TradeSetup } from '@btc-chart/types'

export interface BtcAlertSnapshot {
  readonly symbol: string
  readonly interval: Interval
  readonly price: number
  readonly changePct: number
  readonly ml: MLResult
  readonly setup: TradeSetup
  readonly updatedAt: number
  readonly error?: string
}

const LUX_NWE_CFG = {
  bandwidth: 8,
  multiplier: 3,
  repaint: false,
  maxBarsBack: 250,
} as const

/** Run the same bias/plan engine as the chart (Lux NWE + ML; no SMC WASM in Mini App). */
export async function analyzeBtcAlert(
  symbolEntry: SymbolEntry,
  interval: Interval,
): Promise<BtcAlertSnapshot> {
  const { candles } = await fetchKlines(symbolEntry.symbol, interval, symbolEntry)
  if (candles.length < 30) {
    throw new Error('Not enough candle data')
  }

  const nwe = calcMHBand(candles)
  const rsi = calcRSI(candles, 14)
  const macd = calcMACD(candles)
  const adxR = calcADX(candles)
  const stoch = calcStochRSI(candles)
  const obv = calcOBV(candles)
  const vwapR = calcVWAP(candles)
  const sma50 = calcSMA(candles, 50)
  const sma200 = calcSMA(candles, 200)

  const ml = mlSignal(
    candles,
    nwe,
    sma50,
    sma200,
    rsi,
    macd,
    {
      adx: adxR,
      stoch,
      obv,
      vwap: vwapR.vwap,
      divs: [],
    },
    DEFAULT_SIGNAL_CONFIG,
  )

  const luxNwe = calcNadarayaWatson(candles, LUX_NWE_CFG)
  const maSeries = computeAdaptiveMaSeries(candles, interval)
  const adaptiveMa = snapshotAdaptiveMa(maSeries, candles.length - 1)

  const live = calcTradeSetup(candles, nwe, rsi, adxR, ml, {
    luxNwe,
    adaptiveMa,
  })

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const changePct = prev ? ((last.close - prev.close) / prev.close) * 100 : 0

  const lock = { ...EMPTY_TRADE_SETUP_LOCK }
  const setup = stabilizeTradeSetup(live, lock, {
    candleTime: last.time,
    spot: last.close,
    nowMs: Date.now(),
  })

  return {
    symbol: symbolEntry.symbol,
    interval,
    price: last.close,
    changePct,
    ml,
    setup,
    updatedAt: Date.now(),
  }
}

/** Parse Telegram start_param or query: `BTCUSDT`, `btcusdt_5m`, `REUSDT-15m`. */
export function parseAlertStartParam(raw: string | null | undefined): {
  symbol: string
  interval: Interval | null
} {
  if (!raw?.trim()) return { symbol: 'BTCUSDT', interval: null }
  const cleaned = raw.trim().toUpperCase().replace(/-/g, '_')
  const parts = cleaned.split('_')
  const sym = parts[0].endsWith('USDT') ? parts[0] : `${parts[0]}USDT`
  const iv = parts[1]?.toLowerCase()
  const allowed: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d']
  const interval = iv && (allowed as string[]).includes(iv) ? (iv as Interval) : null
  return { symbol: sym, interval }
}

/** Build a default SymbolEntry for arbitrary USDT pairs (Binance routing). */
export function symbolEntryFromId(symbol: string): SymbolEntry {
  const sym = symbol.toUpperCase().endsWith('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`
  const base = sym.replace(/USDT$/, '')
  return { symbol: sym, base, quote: 'USDT', exchange: 'binance' }
}
