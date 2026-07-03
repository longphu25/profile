// BTC Chart — price-line overlay for auto trade setup (Entry / SL / TP).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from 'react'
import { isDrawableTradeSetup } from '../lib/trade-setup-overlay'
import type { ChartRefs, TradeSetup } from '../lib/types'

/**
 * Syncs lightweight-charts price lines with the computed LONG or SHORT trade setup.
 * Clears lines when the setup is invalid or the layer is hidden.
 */
export function useTradeSetupOverlay(
  chartRefs: React.MutableRefObject<ChartRefs | null>,
  tradeSetup: TradeSetup,
  visible: boolean,
  chartReady?: boolean,
): void {
  const linesRef = useRef<any[]>([])

  useEffect(() => {
    const series = chartRefs.current?.candleSeries
    if (!series) return

    for (const ln of linesRef.current) {
      try {
        series.removePriceLine(ln)
      } catch {
        /* noop */
      }
    }
    linesRef.current = []

    if (!visible || !isDrawableTradeSetup(tradeSetup)) return

    const { entry, sl, tp1, tp2 } = tradeSetup
    const entryColor = tradeSetup.dir === 'short' ? '#F23645' : '#089981'
    linesRef.current = [
      series.createPriceLine({
        price: entry,
        color: entryColor,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Entry',
      }),
      series.createPriceLine({
        price: sl,
        color: '#F23645',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'SL',
      }),
      series.createPriceLine({
        price: tp1,
        color: '#3179F5',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP1',
      }),
      series.createPriceLine({
        price: tp2,
        color: '#3179F5',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP2',
      }),
    ]
  }, [chartRefs, tradeSetup, visible, chartReady])
}
