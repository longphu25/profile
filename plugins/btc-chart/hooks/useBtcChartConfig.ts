// BTC Chart — persisted chart configuration (symbol, vis, alerts, osc).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  loadConfig,
  saveConfig,
  flushConfig,
  exportConfig,
  importConfigFromFile,
  type ChartConfig,
  type VisFlags,
  type OscView,
  type NadarayaConfig,
} from '../storage'
import {
  AlertSound,
  ensureNotificationPermission,
  resetTriggers,
  makeRule,
  type AlertRule,
  type AlertKind,
} from '../alerts'
import { NWE_DEFAULT_WINDOW } from '../lib/constants'
import type { Interval } from '../lib/constants'
import {
  loadCustomSymbols,
  saveCustomSymbols,
  type SymbolEntry,
  type SymbolId,
} from '../lib/symbols'
import { DEFAULT_SIGNAL_CONFIG, type SignalConfig } from '../lib/signal-config'
import { mergeSignalNotifyConfig, type SignalNotifyConfig } from '../lib/signal-notify-config'
import type { ChartRefs } from '../lib/types'

const chartAlertSound = new AlertSound()

function persistConfigField(patch: Record<string, unknown>) {
  try {
    const saved = JSON.parse(localStorage.getItem('btc-chart:config:v1') || '{}')
    localStorage.setItem('btc-chart:config:v1', JSON.stringify({ ...saved, ...patch }))
  } catch {
    /* noop */
  }
}

export interface UseBtcChartConfigParams {
  chartRefs: React.MutableRefObject<ChartRefs | null>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setLoadingText: React.Dispatch<React.SetStateAction<string>>
  setImportErr: React.Dispatch<React.SetStateAction<string | null>>
  setFiredToast: React.Dispatch<React.SetStateAction<string | null>>
  allSymbolsRef: React.MutableRefObject<SymbolEntry[]>
}

export interface UseBtcChartConfig {
  cfgInit: ChartConfig
  interval: Interval
  setInterval_: React.Dispatch<React.SetStateAction<Interval>>
  symbol: SymbolId
  setSymbol: React.Dispatch<React.SetStateAction<SymbolId>>
  customSymbols: SymbolEntry[]
  setCustomSymbols: React.Dispatch<React.SetStateAction<SymbolEntry[]>>
  vis: VisFlags
  setVis: React.Dispatch<React.SetStateAction<VisFlags>>
  visRef: React.MutableRefObject<VisFlags>
  intervalRef: React.MutableRefObject<Interval>
  symbolRef: React.MutableRefObject<SymbolId>
  nweCfg: NadarayaConfig
  setNweCfg: React.Dispatch<React.SetStateAction<NadarayaConfig>>
  nweCfgRef: React.MutableRefObject<NadarayaConfig>
  alerts: AlertRule[]
  setAlerts: React.Dispatch<React.SetStateAction<AlertRule[]>>
  alertsRef: React.MutableRefObject<AlertRule[]>
  sound: ChartConfig['sound']
  setSound: React.Dispatch<React.SetStateAction<ChartConfig['sound']>>
  soundRef: React.MutableRefObject<AlertSound>
  soundEnabledRef: React.MutableRefObject<boolean>
  notifAllowed: boolean
  setNotifAllowed: React.Dispatch<React.SetStateAction<boolean>>
  notifAllowedRef: React.MutableRefObject<boolean>
  signalNotify: SignalNotifyConfig
  setSignalNotify: React.Dispatch<React.SetStateAction<SignalNotifyConfig>>
  signalNotifyRef: React.MutableRefObject<SignalNotifyConfig>
  updateSignalNotify: (patch: Partial<SignalNotifyConfig>) => void
  oscOpen: boolean
  setOscOpen: React.Dispatch<React.SetStateAction<boolean>>
  oscView: OscView
  setOscView: React.Dispatch<React.SetStateAction<OscView>>
  oscHeight: number
  setOscHeight: React.Dispatch<React.SetStateAction<number>>
  spikeMult: number
  setSpikeMult: React.Dispatch<React.SetStateAction<number>>
  spikeMultRef: React.MutableRefObject<number>
  oscViewRef: React.MutableRefObject<OscView>
  oscOpenRef: React.MutableRefObject<boolean>
  signalConfig: SignalConfig
  setSignalConfig: React.Dispatch<React.SetStateAction<SignalConfig>>
  signalConfigRef: React.MutableRefObject<SignalConfig>
  selectSymbol: (next: SymbolId) => void
  selectInterval: (iv: Interval) => void
  addCustomSymbol: (raw: string) => Promise<void>
  addAlert: (kind: AlertKind, value: number, label?: string) => void
  removeAlert: (id: string) => void
  toggleAlert: (id: string) => void
  resetAlert: (id: string) => void
  toggleSound: () => void
  requestNotif: () => Promise<void>
  exportNow: () => void
  importNow: (file: File) => Promise<void>
}

/** Owns persisted chart configuration, alert rules, and import/export. */
export function useBtcChartConfig(params: UseBtcChartConfigParams): UseBtcChartConfig {
  const { chartRefs, setLoading, setLoadingText, setImportErr, setFiredToast, allSymbolsRef } =
    params

  const cfgInit = useMemo<ChartConfig>(() => loadConfig(), [])

  const visRef = useRef<VisFlags>({ ...cfgInit.vis })
  const intervalRef = useRef<Interval>(cfgInit.interval as Interval)
  const symbolRef = useRef<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const alertsRef = useRef<AlertRule[]>([...cfgInit.alerts])
  const soundRef = useRef(chartAlertSound)
  const soundEnabledRef = useRef<boolean>(cfgInit.sound.enabled)
  const spikeMultRef = useRef<number>(cfgInit.spikeMult)
  const oscViewRef = useRef<OscView>(cfgInit.oscView)
  const oscOpenRef = useRef<boolean>(cfgInit.oscOpen)

  const [interval, setInterval_] = useState<Interval>(cfgInit.interval as Interval)
  const [symbol, setSymbol] = useState<SymbolId>((cfgInit.symbol as SymbolId) || 'BTCUSDT')
  const [customSymbols, setCustomSymbols] = useState<SymbolEntry[]>(loadCustomSymbols)
  const [vis, setVis] = useState<VisFlags>(() => ({ ...cfgInit.vis }))
  const [oscOpen, setOscOpen] = useState<boolean>(cfgInit.oscOpen)
  const [oscView, setOscView] = useState<OscView>(cfgInit.oscView)
  const [oscHeight, setOscHeight] = useState<number>(cfgInit.oscHeight)
  const [spikeMult, setSpikeMult] = useState<number>(cfgInit.spikeMult)

  const [nweCfg, setNweCfg] = useState<NadarayaConfig>(
    () =>
      (cfgInit.luxNwe as NadarayaConfig) ?? {
        bandwidth: 8,
        multiplier: 3,
        repaint: false,
        maxBarsBack: NWE_DEFAULT_WINDOW,
      },
  )
  const nweCfgRef = useRef<NadarayaConfig>(nweCfg)

  const [alerts, setAlerts] = useState<AlertRule[]>(() => [...cfgInit.alerts])
  const [sound, setSound] = useState(cfgInit.sound)
  const [notifAllowed, setNotifAllowed] = useState(cfgInit.notifications)
  const notifAllowedRef = useRef(cfgInit.notifications)
  const [signalConfig, setSignalConfig] = useState<SignalConfig>(
    () => (loadConfig().signalConfig as SignalConfig) ?? { ...DEFAULT_SIGNAL_CONFIG },
  )
  const signalConfigRef = useRef<SignalConfig>(signalConfig)
  const [signalNotify, setSignalNotify] = useState<SignalNotifyConfig>(() =>
    mergeSignalNotifyConfig(cfgInit.signalNotify),
  )
  const signalNotifyRef = useRef<SignalNotifyConfig>(signalNotify)

  useLayoutEffect(() => {
    spikeMultRef.current = spikeMult
    oscViewRef.current = oscView
    oscOpenRef.current = oscOpen
    nweCfgRef.current = nweCfg
    signalConfigRef.current = signalConfig
    signalNotifyRef.current = signalNotify
    notifAllowedRef.current = notifAllowed
  }, [spikeMult, oscView, oscOpen, nweCfg, signalConfig, signalNotify, notifAllowed])

  useEffect(() => {
    visRef.current = vis
  }, [vis])
  useEffect(() => {
    intervalRef.current = interval
  }, [interval])
  useEffect(() => {
    symbolRef.current = symbol
  }, [symbol])
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    soundRef.current.setVolume(sound.volume)
  }, [sound.volume])
  useEffect(() => {
    soundEnabledRef.current = sound.enabled
  }, [sound.enabled])

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
        oscHeight,
        spikeMult,
        signalConfig,
        luxNwe: nweCfg,
        signalNotify,
      })
    },
    [
      interval,
      symbol,
      vis,
      alerts,
      sound,
      notifAllowed,
      oscOpen,
      oscView,
      oscHeight,
      spikeMult,
      signalConfig,
      nweCfg,
      signalNotify,
    ],
  )

  const updateSignalNotify = useCallback((patch: Partial<SignalNotifyConfig>) => {
    setSignalNotify((prev) => {
      const next = { ...prev, ...patch }
      signalNotifyRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    persist(undefined)
  }, [persist])

  useEffect(() => {
    const onBeforeUnload = () => flushConfig()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const selectSymbol = (next: SymbolId) => {
    if (next === symbol) return
    const entry = allSymbolsRef.current.find((s) => s.symbol === next)
    const label = entry ? `${entry.base}/${entry.quote}` : next.replace(/USDT$/, '/USDT')
    setLoading(true)
    setLoadingText(`Tải dữ liệu ${label} ${interval}…`)
    setSymbol(next)
    persistConfigField({ symbol: next })
  }

  const selectInterval = (iv: Interval) => {
    if (iv === interval) return
    const entry = allSymbolsRef.current.find((s) => s.symbol === symbol)
    const label = entry ? `${entry.base}/${entry.quote}` : symbol.replace(/USDT$/, '/USDT')
    setLoading(true)
    setLoadingText(`Tải dữ liệu ${label} ${iv}…`)
    setInterval_(iv)
    persistConfigField({ interval: iv })
  }

  const addCustomSymbol = async (raw: string) => {
    const cleaned = raw.trim().toUpperCase()
    if (!cleaned) return
    const sym = cleaned.endsWith('USDT') ? cleaned : cleaned + 'USDT'
    const base = sym.replace(/USDT$/, '')
    if (!allSymbolsRef.current.find((s) => s.symbol === sym)) {
      try {
        const [spot, fut] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=1`).then(
            (r) => r.ok,
          ),
          fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&limit=1`)
            .then((r) => r.ok)
            .catch(() => false),
        ])
        if (!spot && !fut) {
          setFiredToast(`${base} không có trên Binance`)
          return
        }
      } catch {
        setFiredToast(`Không thể kiểm tra ${base} trên Binance`)
        return
      }
      const entry: SymbolEntry = { symbol: sym, base, quote: 'USDT', exchange: 'binance' }
      const next = [...customSymbols, entry]
      setCustomSymbols(next)
      saveCustomSymbols(next)
    }
    setSymbol(sym)
    persistConfigField({ symbol: sym })
  }

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

  const toggleSound = useCallback(() => {
    setSound((s) => {
      const next = { ...s, enabled: !s.enabled }
      if (next.enabled) soundRef.current.play()
      return next
    })
  }, [])

  const requestNotif = useCallback(async () => {
    const result = await ensureNotificationPermission()
    setNotifAllowed(result === 'granted')
  }, [])

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
      oscHeight,
      spikeMult,
      signalConfig,
      luxNwe: nweCfg,
      signalNotify,
    })
  }, [
    interval,
    symbol,
    vis,
    alerts,
    sound,
    notifAllowed,
    oscOpen,
    oscView,
    oscHeight,
    spikeMult,
    signalConfig,
    nweCfg,
    signalNotify,
  ])

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
        notifAllowedRef.current = cfg.notifications
        const importedNotify = mergeSignalNotifyConfig(cfg.signalNotify)
        setSignalNotify(importedNotify)
        signalNotifyRef.current = importedNotify
        setOscOpen(cfg.oscOpen)
        setOscView(cfg.oscView)
        setOscHeight(cfg.oscHeight)
        setSpikeMult(cfg.spikeMult)
        spikeMultRef.current = cfg.spikeMult
        if (cfg.luxNwe) {
          setNweCfg(cfg.luxNwe as NadarayaConfig)
          nweCfgRef.current = cfg.luxNwe as NadarayaConfig
        }
        cfg.minimal = cfg.minimal ?? false
        if (cfg.interval !== interval) setInterval_(cfg.interval as Interval)
        if (cfg.zoom && chartRefs.current?.mainChart) {
          chartRefs.current.mainChart.timeScale().setVisibleLogicalRange(cfg.zoom)
        }
        saveConfig(cfg)
        setImportErr(null)
      } catch (e) {
        setImportErr(e instanceof Error ? e.message : 'invalid file')
      }
    },
    [interval, chartRefs, setImportErr],
  )

  return {
    cfgInit,
    interval,
    setInterval_,
    symbol,
    setSymbol,
    customSymbols,
    setCustomSymbols,
    vis,
    setVis,
    visRef,
    intervalRef,
    symbolRef,
    nweCfg,
    setNweCfg,
    nweCfgRef,
    alerts,
    setAlerts,
    alertsRef,
    sound,
    setSound,
    soundRef,
    soundEnabledRef,
    notifAllowed,
    setNotifAllowed,
    notifAllowedRef,
    signalNotify,
    setSignalNotify,
    signalNotifyRef,
    updateSignalNotify,
    oscOpen,
    setOscOpen,
    oscView,
    setOscView,
    oscHeight,
    setOscHeight,
    spikeMult,
    setSpikeMult,
    spikeMultRef,
    oscViewRef,
    oscOpenRef,
    signalConfig,
    setSignalConfig,
    signalConfigRef,
    selectSymbol,
    selectInterval,
    addCustomSymbol,
    addAlert,
    removeAlert,
    toggleAlert,
    resetAlert,
    toggleSound,
    requestNotif,
    exportNow,
    importNow,
  }
}
