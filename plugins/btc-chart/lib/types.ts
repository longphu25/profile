// BTC Chart — domain types shared across lib, hooks, and components.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Nadaraya-Watson / Midnight Hunter envelope: mid line + upper/lower bands. */
export interface NWE {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
}

export interface OrderFlowSignal {
  type: 'buy' | 'sell'
  price: string
  ratio: string
  time: string
}

export interface MLResult {
  score: number
  label: string
  color: string
  features: Record<string, number>
}

export interface Divergence {
  time: number
  type: 'bull' | 'bear'
  price: number
}

/** Live handles to the lightweight-charts chart + series instances. */
export interface ChartRefs {
  mainChart: any
  candleSeries: any
  nweMidS: any
  nweUpS: any
  nweLowS: any
  luxNweMidS: any
  luxNweUpS: any
  luxNweLoS: any
  ma50S: any
  ma200S: any
  volSeries: any
  vwapS: any
  vwapUpS: any
  vwapLoS: any
  cleanup: () => void
}

export interface TradeSetup {
  dir: 'long' | 'short' | null
  entry: number
  sl: number
  tp1: number
  tp2: number
  rr: number
  confidence: number
  reasons: string[]
  /** Volume ratio vs 20-bar average (e.g. 2.1 = 2.1x avg) */
  volRatio: number
  /** Close price at calculation time (reference for limit entry offset). */
  spotPrice: number
  /** How the limit entry was derived (structure confluence, OTE, etc.). */
  entryMethod: string
}

export interface SidebarState {
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
  adxNow: number | null
  stochKNow: number | null
  obvNow: number | null
  nweUp: number | null
  nweLo: number | null
  tradeSetup: TradeSetup
}

export interface StatsState {
  high: string
  low: string
  vol: string
  chg: string
  up: boolean
}

export interface FundingState {
  val: string
  sub: string
  cls: string
  breakdown: { name: string; rate: number }[]
}

export interface FngState {
  val: string
  label: string
  color: string
  pct: number
}

export interface PriceState {
  cur: string
  chg: string
  up: boolean
}

export interface OhlcvState {
  o: string
  h: string
  l: string
  c: string
  v: string
}

export const INITIAL_SIDEBAR: SidebarState = {
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
  adxNow: null,
  stochKNow: null,
  obvNow: null,
  nweUp: null,
  nweLo: null,
  tradeSetup: {
    dir: null,
    entry: 0,
    sl: 0,
    tp1: 0,
    tp2: 0,
    rr: 0,
    confidence: 0,
    reasons: [],
    volRatio: 0,
    spotPrice: 0,
    entryMethod: '',
  },
}

declare global {
  interface Window {
    LightweightCharts?: any
  }
}
