// BTC Chart — imperative refs and callbacks consumed by the render pipeline.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RefObject, Dispatch, SetStateAction } from 'react'
import type { AlertSound } from '../alerts'
import type { BoxFlipResult } from '../box-flip'
import type { OFOverlaySignal } from '../order-flow-overlay'
import type { SMCResult } from '../smc-wasm'
import type { NadarayaConfig, VisFlags } from '../storage'
import type { Interval } from './constants'
import type { SymbolId } from './symbols'
import type { BoucherResult } from './boucher-scalping'
import type { ICTResult } from './ict-sessions'
import type { LienResult } from './lien-reversal'
import type { LiquidityResult } from './liquidity'
import type { SupplyDemandResult } from './supply-demand'
import type { SignalConfig } from './signal-config'
import type { TradeSetupLockState } from './trade-setup-stable'
import type { Candle, ChartRefs, SidebarState, TradeSetup } from './types'

/** Oscillator pane series handles (ADX / StochRSI / OBV / RSI). */
export interface OscChartRefs {
  chart: any
  rsiS: any
  rsiOB: any
  rsiOS: any
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
}

/** Double Bollinger band line series bundle. */
export interface DbbSeriesRefs {
  upper2: any
  lower2: any
  upper1: any
  lower1: any
  sma: any
}

/** LuxAlgo NWE envelope result shape used by panels and trade setup. */
export interface LuxNweResult {
  mid: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
  signals: Array<{ index: number; type: 'buy' | 'sell'; price: number }>
}

/**
 * All refs, mutable caches, and React setters required by `renderChartPipeline`.
 * Passed from `useBtcChartEngine` so the pipeline stays a pure imperative function.
 */
export interface ChartRenderContext {
  // DOM / canvas refs
  readonly mainElRef: RefObject<HTMLDivElement | null>
  readonly vpCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly ofCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly smcCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly boxCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly ictCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly liqCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly setupCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly legendRef: RefObject<HTMLDivElement | null>

  // Chart + overlay data refs
  readonly chartRefs: RefObject<ChartRefs | null>
  readonly markersRef: RefObject<any>
  readonly dbbSeriesRef: RefObject<DbbSeriesRefs | null>
  readonly ictDataRef: RefObject<ICTResult>
  readonly liqDataRef: RefObject<LiquidityResult>
  readonly htfRef: RefObject<Candle[] | null>
  readonly smcDataRef: RefObject<SMCResult>
  readonly sdDataRef: RefObject<SupplyDemandResult>
  readonly boxFlipRef: RefObject<BoxFlipResult>
  readonly tradeSetupRef: RefObject<TradeSetup>
  readonly tradeSetupLockRef: RefObject<TradeSetupLockState>
  readonly ofOverlayRef: RefObject<OFOverlaySignal[]>
  readonly oscRefs: RefObject<OscChartRefs | null>

  // Config / state mirrors (read inside pipeline without React deps)
  readonly fitNextRef: RefObject<boolean>
  readonly panelCandleKeyRef: RefObject<string>
  readonly lastCandleTimeRef: RefObject<number>
  readonly soundEnabledRef: RefObject<boolean>
  readonly soundRef: RefObject<AlertSound>
  readonly visRef: RefObject<VisFlags>
  readonly intervalRef: RefObject<Interval>
  readonly symbolRef: RefObject<SymbolId>
  readonly spikeMultRef: RefObject<number>
  readonly oscViewRef: RefObject<'rsi' | 'adx' | 'stoch' | 'obv'>
  readonly oscOpenRef: RefObject<boolean>
  readonly nweCfgRef: RefObject<NadarayaConfig>
  readonly signalConfigRef: RefObject<SignalConfig>
  readonly vpOptsRef: RefObject<{ hvnRatio: number }>

  // Compute caches
  readonly nweCacheKeyRef: RefObject<string>
  readonly nweCacheRef: RefObject<LuxNweResult | null>
  readonly smcCacheKeyRef: RefObject<string>
  readonly smcCacheRef: RefObject<SMCResult | null>
  readonly heavyBarKeyRef: RefObject<string>
  readonly lastHeavyComputeMsRef: RefObject<number>
  readonly sidebarKeyRef: RefObject<string>
  readonly boucherCacheRef: RefObject<BoucherResult | null>
  readonly lienCacheRef: RefObject<LienResult | null>
  /** Bumped on view change; stale scheduled renders no-op when mismatched. */
  readonly renderGenRef: RefObject<number>
  /** In-flight Lux NWE worker cache key (dedupe). */
  readonly nwePendingKeyRef: RefObject<string>

  // React state setters invoked during render
  readonly setPanelCandles: Dispatch<SetStateAction<Candle[]>>
  readonly setLastCandleClose: Dispatch<SetStateAction<number | null>>
  readonly setICTResult: Dispatch<SetStateAction<ICTResult>>
  readonly setLuxNweResult: Dispatch<SetStateAction<LuxNweResult>>
  readonly setLiquidityResult: Dispatch<SetStateAction<LiquidityResult>>
  readonly setSidebar: Dispatch<SetStateAction<SidebarState>>
  readonly setBoucherScalp: Dispatch<SetStateAction<BoucherResult>>
  readonly setLienReversal: Dispatch<SetStateAction<LienResult>>
  readonly setFiredToast: Dispatch<SetStateAction<string | null>>
}
