import { cn } from '@/lib/utils'
import { useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { calcMHBand } from '../lib/indicators'
import { suggestSlTp } from '../lib/trade-setup'
import { SYMBOLS, type SymbolEntry } from '../lib/symbols'
import { ALL_IND_KEYS } from '../lib/indicator-groups'
import type { Candle, ChartRefs, OhlcvState, PriceState } from '../lib/types'

import { ChartHeader } from './ChartHeader'
import { ChartToolbarPanel } from './ChartToolbarPanel'
import { ChartToasts } from './ChartToasts'
import { ChartLoadingOverlay } from './ChartLoadingOverlay'
import { ChartStatusBar } from './ChartStatusBar'
import { ChartLayerDots } from './ChartLayerDots'
import { OscillatorPane } from './OscillatorPane'
import { IntelDrawer } from './IntelDrawer'
import { IntelPanelStack } from './IntelPanelStack'
import { BtcMotionProvider } from './BtcMotionProvider'
import { SidebarRailTabs } from './SidebarRailTabs'
import { MobileSetupFab } from './MobileSetupFab'
import { SidebarRail } from './SidebarRail'

import { usePositions } from '../hooks/usePositions'
import { useBtcChartEngine, useBtcChartConfig, useBtcChartMarket, useBtcChartUI } from '../hooks'

/** Main BTC chart workspace: composes config, market, engine, and UI hooks. */
export function BtcChartPage() {
  const chartRefs = useRef<ChartRefs | null>(null)
  const allSymbolsRef = useRef<SymbolEntry[]>([...SYMBOLS])
  const symbolInfoRef = useRef<SymbolEntry>({
    symbol: 'BTCUSDT',
    base: 'BTC',
    quote: 'USDT',
    exchange: 'binance',
  })
  const loadingBridge = useRef({
    setLoading: ((_v: SetStateAction<boolean>) => {}) as Dispatch<SetStateAction<boolean>>,
    setLoadingText: ((_v: SetStateAction<string>) => {}) as Dispatch<SetStateAction<string>>,
  })
  const priceBridge = useRef({
    setPrice: ((_v: SetStateAction<PriceState>) => {}) as Dispatch<SetStateAction<PriceState>>,
    setMarkPrice: ((_v: SetStateAction<number | null>) => {}) as Dispatch<
      SetStateAction<number | null>
    >,
    setOhlcv: ((_v: SetStateAction<OhlcvState>) => {}) as Dispatch<SetStateAction<OhlcvState>>,
  })
  const htfRef = useRef<Candle[] | null>(null)

  const ui = useBtcChartUI()

  const config = useBtcChartConfig({
    chartRefs,
    setLoading: (v) => loadingBridge.current.setLoading(v),
    setLoadingText: (v) => loadingBridge.current.setLoadingText(v),
    setImportErr: ui.setImportErr,
    setFiredToast: ui.setFiredToast,
    allSymbolsRef,
  })

  const market = useBtcChartMarket({
    symbol: config.symbol,
    interval: config.interval,
    customSymbols: config.customSymbols,
    vis: config.vis,
    setPrice: (v) => priceBridge.current.setPrice(v),
    setMarkPrice: (v) => priceBridge.current.setMarkPrice(v),
    setOhlcv: (v) => priceBridge.current.setOhlcv(v),
    htfRef,
  })

  const engine = useBtcChartEngine({
    config,
    symbolInfoRef,
    klinesQuery: market.klinesQuery,
    setFiredToast: ui.setFiredToast,
    htfRef,
  })

  allSymbolsRef.current = market.allSymbols
  symbolInfoRef.current = market.symbolInfo
  loadingBridge.current = {
    setLoading: engine.setLoading,
    setLoadingText: engine.setLoadingText,
  }
  priceBridge.current = {
    setPrice: engine.setPrice,
    setMarkPrice: engine.setMarkPrice,
    setOhlcv: engine.setOhlcv,
  }

  const {
    positions,
    showForm: showPosForm,
    setShowForm: setShowPosForm,
    form: posForm,
    setForm: setPosForm,
    addPosition,
    removePosition,
    updatePosition,
  } = usePositions(engine.chartRefs, !engine.loading, engine.markPrice)

  const posSuggestions = useMemo(() => {
    const candles = engine.panelCandles
    if (!candles.length || !positions.length) return {}
    const nweData = calcMHBand(candles)
    const result: Record<string, { sl: number; tp1: number; tp2: number }> = {}
    for (const p of positions) {
      result[p.id] = suggestSlTp(p, candles, nweData)
    }
    return result
  }, [positions, engine.panelCandles])

  const railProps = {
    sidebar: engine.sidebar,
    signalConfig: config.signalConfig,
    onSignalConfigChange: engine.updateSignalConfig,
    positions,
    showPosForm,
    setShowPosForm,
    posForm,
    setPosForm,
    onAddPosition: addPosition,
    onRemovePosition: removePosition,
    onUpdatePosition: updatePosition,
    markPrice: engine.markPrice,
    posSuggestions,
    funding: market.funding,
    luxNweResult: engine.luxNweResult,
    panelCandles: engine.panelCandles,
    symbol: config.symbol,
    ictResult: engine.ictResult,
    liquidityResult: engine.liquidityResult,
    boucherScalp: engine.boucherScalp,
    lienReversal: engine.lienReversal,
    interval: config.interval,
    boucherEnabled: engine.boucherEnabled,
    lienEnabled: engine.lienEnabled,
    onToggleBoucher: () => engine.setBoucherEnabled((v) => !v),
    onToggleLien: () => engine.setLienEnabled((v) => !v),
  } as const

  return (
    <BtcMotionProvider>
      <div
        className={cn(
          'btc-chart btc-chart--stitch',
          engine.loading ? '' : ' is-ready',
          ui.sidebarMobileOpen && 'is-rail-open',
        )}
        ref={engine.rootRef}
      >
        <ChartLoadingOverlay loading={engine.loading} text={engine.loadingText} />
        <ChartToasts
          alertMessage={ui.firedToast}
          onDismissAlert={() => ui.setFiredToast(null)}
          errorMessage={ui.importErr}
          onDismissError={() => ui.setImportErr(null)}
        />
        <div className="btc-chart__chrome">
          <ChartHeader
            symbolInfo={market.symbolInfo}
            symbol={config.symbol}
            symbols={market.allSymbols}
            interval={config.interval}
            price={engine.price}
            ohlcv={engine.ohlcv}
            activeLayerCount={ALL_IND_KEYS.filter((k) => config.vis[k]).length}
            toolsOpen={ui.toolsOpen}
            sidebarOpen={ui.sidebarMobileOpen}
            intelOpen={ui.intelOpen}
            onToggleTools={() => ui.setToolsOpen((o) => !o)}
            onToggleSidebar={() =>
              ui.setSidebarMobileOpen((o) => {
                const next = !o
                if (next) {
                  ui.setIntelOpen(false)
                  ui.setMobileRailTab('setup')
                }
                return next
              })
            }
            onToggleIntel={() =>
              ui.setIntelOpen((o) => {
                const next = !o
                if (next) ui.setSidebarMobileOpen(false)
                return next
              })
            }
            onSelectSymbol={config.selectSymbol}
            onSelectInterval={config.selectInterval}
            onAddCustomSymbol={config.addCustomSymbol}
          />
        </div>

        <div className="btc-chart__body">
          <div className="btc-chart__col">
            <ChartToolbarPanel
              open={ui.toolsOpen}
              vis={config.vis}
              nweCfg={config.nweCfg}
              onToggle={engine.toggle}
              onUpdateNweConfig={engine.updateNweConfig}
              onClose={() => ui.setToolsOpen(false)}
              soundEnabled={config.sound.enabled}
              onToggleSound={config.toggleSound}
              notifAllowed={config.notifAllowed}
              onRequestNotif={config.requestNotif}
              onSnapshot={engine.snapshot}
              onExport={config.exportNow}
              onImport={config.importNow}
              onApplyPreset={engine.applyPreset}
            />
            <div className="btc-chart__chart-stage">
              <div className="btc-chart__legend-dock">
                <div className="btc-chart__legend" ref={engine.legendRef} />
              </div>
              <ChartLayerDots
                vis={config.vis}
                onToggle={engine.toggle}
                onOpenTools={() => ui.setToolsOpen(true)}
              />
              <canvas className="btc-chart__of-canvas" ref={engine.ofCanvasRef} />
              <canvas className="btc-chart__ict-canvas" ref={engine.ictCanvasRef} />
              <canvas className="btc-chart__liq-canvas" ref={engine.liqCanvasRef} />
              <canvas className="btc-chart__smc-canvas" ref={engine.smcCanvasRef} />
              <canvas className="btc-chart__box-canvas" ref={engine.boxCanvasRef} />
              <div className="btc-chart__main" ref={engine.mainElRef} />
              <canvas className="btc-chart__setup-canvas" ref={engine.setupCanvasRef} />
              <canvas className="btc-chart__vp-canvas" ref={engine.vpCanvasRef} />
            </div>
            <OscillatorPane
              open={config.oscOpen}
              height={config.oscHeight}
              view={config.oscView}
              readouts={{
                rsi: engine.sidebar.rsiNow,
                adx: engine.sidebar.adxNow,
                stochK: engine.sidebar.stochKNow,
                obv: engine.sidebar.obvNow,
              }}
              oscElRef={engine.oscElRef}
              onToggleOpen={engine.toggleOscOpen}
              onViewChange={config.setOscView}
              onResizeStart={engine.startOscResize}
            />
          </div>

          {ui.sidebarMobileOpen && (
            <button
              type="button"
              className="btc-chart__sidebar-scrim"
              aria-label="Đóng rail panel"
              onClick={() => ui.setSidebarMobileOpen(false)}
            />
          )}

          <div className={`btc-chart__sidebar${ui.sidebarMobileOpen ? ' is-mobile-open' : ''}`}>
            <SidebarRailTabs active={ui.mobileRailTab} onChange={ui.setMobileRailTab} />
            <div className="btc-chart__rail-desktop">
              <SidebarRail variant="desktop" {...railProps} />
            </div>
            <div className="btc-chart__rail-mobile" role="tabpanel" aria-label={ui.mobileRailTab}>
              <SidebarRail variant="mobile" mobileTab={ui.mobileRailTab} {...railProps} />
            </div>
          </div>
        </div>

        {ui.intelOpen && (
          <IntelDrawer
            open={ui.intelOpen}
            onClose={() => ui.setIntelOpen(false)}
            tab={ui.intelTab}
            onTabChange={ui.setIntelTab}
            search={ui.intelSearch}
            onSearchChange={ui.setIntelSearch}
          >
            <IntelPanelStack
              tab={ui.intelTab}
              search={ui.intelSearch}
              vis={config.vis}
              onToggleVis={engine.toggle}
              sidebar={engine.sidebar}
              stats={market.stats}
              fng={market.fng}
              oiUsd={market.oiQuery.data?.totalUsd ?? null}
              oiBreakdown={market.oiQuery.data?.breakdown}
              oiHistory={market.oiQuery.data?.history}
              oiDeltaPct={market.oiQuery.data?.deltaPct}
              mcap={market.mcap}
              whaleAlerts={market.whaleTracker.whaleAlerts}
              whaleExchangeFlow={market.whaleTracker.exchangeFlow}
              whaleStats={market.whaleTracker.whaleStats}
              whaleRecentBuy={market.whaleTracker.recentBuyVolume}
              whaleRecentSell={market.whaleTracker.recentSellVolume}
              onClearWhale={market.whaleTracker.clearAlerts}
              alerts={config.alerts}
              onAddAlert={config.addAlert}
              onRemoveAlert={config.removeAlert}
              onToggleAlert={config.toggleAlert}
              onResetAlert={config.resetAlert}
              lastCandleClose={engine.lastCandleClose}
              spikeMult={config.spikeMult}
              onSpikeMultChange={(val) => {
                config.setSpikeMult(val)
                config.spikeMultRef.current = val
                if (engine.candlesRef.current.length) {
                  queueMicrotask(() => engine.renderData(engine.candlesRef.current))
                }
              }}
            />
          </IntelDrawer>
        )}

        <MobileSetupFab
          visible={!ui.sidebarMobileOpen}
          setup={engine.sidebar.tradeSetup}
          onOpen={() => {
            ui.setMobileRailTab('setup')
            ui.setSidebarMobileOpen(true)
            ui.setIntelOpen(false)
          }}
        />

        <ChartStatusBar
          wsText={engine.wsStatus.text}
          wsTone={engine.wsStatus.tone}
          lastUpdate={engine.lastUpdate}
          ofCount={engine.sidebar.ofLog.length}
          boxCount={engine.sidebar.boxFlip.count}
          vis={config.vis}
        />
      </div>
    </BtcMotionProvider>
  )
}
