// BTC Chart — klines hydration + live WebSocket wiring.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  AlertSound,
  describeRule,
  evaluateAlerts,
  pushNotification,
  type AlertRule,
} from '../alerts'
import { CHART, LIMIT, LIVE_REFRESH_MS, type Interval } from './constants'
import { fmtP, tsNow } from './format'
import {
  BYBIT_INTERVAL,
  MEXC_INTERVAL,
  OKX_INTERVAL,
  type SymbolEntry,
  type SymbolId,
} from './symbols'
import type { Candle, ChartRefs, OhlcvState, PriceState, SidebarState } from './types'

export interface WsStatus {
  text: string
  tone: 'muted' | 'live' | 'err'
}

export interface KlinesPayload {
  symbol: SymbolId
  interval: Interval
  candles: Candle[]
  usedSpot?: boolean
}

export interface WireKlinesWebSocketParams {
  readonly data: KlinesPayload | undefined
  readonly error: unknown
  readonly symbol: SymbolId
  readonly interval: Interval
  readonly cancelled: () => boolean
  readonly wsRef: MutableRefObject<WebSocket | null>
  readonly candlesRef: MutableRefObject<Candle[]>
  readonly chartRefs: MutableRefObject<ChartRefs | null>
  readonly fitNextRef: MutableRefObject<boolean>
  readonly lastPriceUpdateRef: MutableRefObject<number>
  readonly lastChartUpdateRef: MutableRefObject<number>
  readonly lastPriceRef: MutableRefObject<number | null>
  readonly symbolInfoRef: MutableRefObject<SymbolEntry>
  readonly alertsRef: MutableRefObject<AlertRule[]>
  readonly sidebarRef: MutableRefObject<SidebarState>
  readonly soundRef: MutableRefObject<AlertSound>
  readonly soundEnabledRef: MutableRefObject<boolean>
  readonly renderData: (data: Candle[]) => void
  readonly setPrice: Dispatch<SetStateAction<PriceState>>
  readonly setMarkPrice: Dispatch<SetStateAction<number | null>>
  readonly setOhlcv: Dispatch<SetStateAction<OhlcvState>>
  readonly setLastUpdate: Dispatch<SetStateAction<string>>
  readonly setWsStatus: Dispatch<SetStateAction<WsStatus>>
  readonly setLoading: Dispatch<SetStateAction<boolean>>
  readonly setFiredToast: Dispatch<SetStateAction<string | null>>
  readonly setAlerts: Dispatch<SetStateAction<AlertRule[]>>
}

/** Close a WebSocket without handshake console noise when still connecting. */
export function closeWebSocketSafe(ws: WebSocket): void {
  if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return
  ws.onmessage = null
  ws.onerror = null
  ws.onclose = null
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => {
      try {
        ws.close(1000, 'replaced')
      } catch {
        /* noop */
      }
    }
    return
  }
  ws.onopen = null
  try {
    ws.close(1000, 'replaced')
  } catch {
    /* noop */
  }
}

/** Close an active WebSocket without leaking handlers. */
export function closeKlinesWebSocket(wsRef: MutableRefObject<WebSocket | null>): void {
  const ws = wsRef.current
  if (!ws) return
  wsRef.current = null
  closeWebSocketSafe(ws)
}

/**
 * Hydrate candles from React Query and connect the live kline WebSocket.
 * Returns true when data or error was handled, false when still loading.
 */
export function wireKlinesWebSocket(params: WireKlinesWebSocketParams): boolean {
  const { data, error } = params
  if (!data && !error) return false

  const throttledPriceUpdate = (close: number) => {
    const now = Date.now()
    if (now - params.lastPriceUpdateRef.current < LIVE_REFRESH_MS) return
    params.lastPriceUpdateRef.current = now
    params.setPrice((p) => ({ ...p, cur: fmtP(close) }))
    params.setMarkPrice(close)
    params.setOhlcv((o) => ({ ...o, c: fmtP(close) }))
    params.setLastUpdate(tsNow())
  }

  const throttledRender = (candles: Candle[]) => {
    const now = Date.now()
    if (now - params.lastChartUpdateRef.current < LIVE_REFRESH_MS) return
    params.lastChartUpdateRef.current = now
    params.renderData(candles)
  }

  const connectWs = (spotMode = false) => {
    closeKlinesWebSocket(params.wsRef)
    let ws: WebSocket
    const info = params.symbolInfoRef.current
    const { symbol, interval } = params

    if (info.exchange === 'mexc') {
      const msym = 'mexcSymbol' in info ? info.mexcSymbol : symbol
      ws = new WebSocket('wss://contract.mexc.com/edge')
      ws.onopen = () => {
        if (params.cancelled()) {
          closeWebSocketSafe(ws)
          return
        }
        ws.send(
          JSON.stringify({
            method: 'sub.kline',
            param: { symbol: msym, interval: MEXC_INTERVAL[interval] },
          }),
        )
        params.setWsStatus({ text: 'Live', tone: 'live' })
        params.setLastUpdate(tsNow())
      }
      ws.onmessage = (ev) => {
        if (params.cancelled()) return
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
        applyCandleUpdate(candle, k.end, throttledPriceUpdate, throttledRender)
      }
    } else if (info.exchange === 'bybit') {
      const cat = 'bybitCategory' in info ? info.bybitCategory : 'linear'
      ws = new WebSocket(`wss://stream.bybit.com/v5/public/${cat}`)
      ws.onopen = () => {
        if (params.cancelled()) {
          closeWebSocketSafe(ws)
          return
        }
        ws.send(
          JSON.stringify({
            op: 'subscribe',
            args: [`kline.${BYBIT_INTERVAL[interval]}.${symbol}`],
          }),
        )
        params.setWsStatus({ text: 'Live', tone: 'live' })
        params.setLastUpdate(tsNow())
      }
      ws.onmessage = (ev) => {
        if (params.cancelled()) return
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
        applyCandleUpdate(candle, k.confirm, throttledPriceUpdate, throttledRender)
      }
    } else if (info.exchange === 'okx') {
      const instId = 'okxInstId' in info ? info.okxInstId : symbol
      ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/business')
      ws.onopen = () => {
        if (params.cancelled()) {
          closeWebSocketSafe(ws)
          return
        }
        ws.send(
          JSON.stringify({
            op: 'subscribe',
            args: [{ channel: 'candle' + OKX_INTERVAL[interval], instId }],
          }),
        )
        params.setWsStatus({ text: 'Live', tone: 'live' })
        params.setLastUpdate(tsNow())
      }
      ws.onmessage = (ev) => {
        if (params.cancelled()) return
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
        applyCandleUpdate(candle, k[8] === '1', throttledPriceUpdate, throttledRender)
      }
    } else {
      const wsUrl = spotMode
        ? `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
        : `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${interval}`
      ws = new WebSocket(wsUrl)
      ws.onerror = () => {
        if (!spotMode && !params.cancelled()) {
          closeWebSocketSafe(ws)
          const spotWs = new WebSocket(
            `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`,
          )
          spotWs.onopen = () => {
            if (params.cancelled()) {
              closeWebSocketSafe(spotWs)
              return
            }
            params.setWsStatus({ text: 'Live', tone: 'live' })
            params.setLastUpdate(tsNow())
          }
          spotWs.onmessage = ws.onmessage
          spotWs.onerror = () => params.setWsStatus({ text: 'Error', tone: 'err' })
          spotWs.onclose = () => {
            if (!params.cancelled()) params.setWsStatus({ text: 'Closed', tone: 'muted' })
          }
          params.wsRef.current = spotWs
          return
        }
        params.setWsStatus({ text: 'Error', tone: 'err' })
      }
      ws.onopen = () => {
        if (params.cancelled()) {
          closeWebSocketSafe(ws)
          return
        }
        params.setWsStatus({ text: 'Live', tone: 'live' })
        params.setLastUpdate(tsNow())
      }
      ws.onmessage = (ev) => {
        if (params.cancelled()) return
        const k = JSON.parse(ev.data).k
        const candle: Candle = {
          time: Math.floor(k.t / 1000),
          open: +k.o,
          high: +k.h,
          low: +k.l,
          close: +k.c,
          volume: +k.v,
        }
        const arr = params.candlesRef.current
        const last = arr[arr.length - 1]
        if (last && last.time === candle.time) arr[arr.length - 1] = candle
        else if (!last || candle.time > last.time) {
          arr.push(candle)
          if (arr.length > LIMIT + 50) arr.shift()
        }
        params.chartRefs.current?.candleSeries.update({
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })
        params.chartRefs.current?.volSeries.update({
          time: candle.time,
          value: candle.volume,
          color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
        })
        throttledPriceUpdate(candle.close)
        const ctx = {
          price: candle.close,
          prevPrice: params.lastPriceRef.current,
          nweUpper: params.sidebarRef.current.nweUp,
          nweLower: params.sidebarRef.current.nweLo,
          rsi: params.sidebarRef.current.rsiNow,
        }
        params.lastPriceRef.current = candle.close
        const fired = evaluateAlerts(params.alertsRef.current, ctx)
        if (fired.length) {
          if (params.soundEnabledRef.current) params.soundRef.current.play()
          for (const f of fired)
            pushNotification('BTC Chart Alert', `${describeRule(f.rule)} — ${f.message}`)
          params.setFiredToast(fired.map((f) => describeRule(f.rule)).join(' · '))
          params.setAlerts([...params.alertsRef.current])
        }
        throttledRender(arr)
      }
    }

    function applyCandleUpdate(
      candle: Candle,
      _closed: boolean,
      onPrice: (close: number) => void,
      onRender: (arr: Candle[]) => void,
    ) {
      const arr = params.candlesRef.current
      const last = arr[arr.length - 1]
      if (last && last.time === candle.time) arr[arr.length - 1] = candle
      else if (!last || candle.time > last.time) {
        arr.push(candle)
        if (arr.length > LIMIT + 50) arr.shift()
      }
      params.chartRefs.current?.candleSeries.update({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })
      params.chartRefs.current?.volSeries.update({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? CHART.upSoft : CHART.dnSoft,
      })
      onPrice(candle.close)
      onRender(arr)
    }

    if (!ws.onerror) ws.onerror = () => params.setWsStatus({ text: 'Error', tone: 'err' })
    ws.onclose = () => {
      if (!params.cancelled()) params.setWsStatus({ text: 'Closed', tone: 'muted' })
    }
    params.wsRef.current = ws
  }

  if (data) {
    if (data.symbol !== params.symbol || data.interval !== params.interval) return true

    params.candlesRef.current = data.candles
    if (params.chartRefs.current?.candleSeries && data.candles.length) {
      const lastClose = data.candles[data.candles.length - 1].close
      const precision = lastClose < 0.01 ? 6 : lastClose < 1 ? 5 : lastClose < 100 ? 4 : 2
      const minMove = Math.pow(10, -precision)
      const pf = { type: 'price', precision, minMove }
      params.chartRefs.current.candleSeries.applyOptions({ priceFormat: pf })
      params.chartRefs.current.nweMidS.applyOptions({ priceFormat: pf })
      params.chartRefs.current.nweUpS.applyOptions({ priceFormat: pf })
      params.chartRefs.current.nweLowS.applyOptions({ priceFormat: pf })
      params.chartRefs.current.ma50S.applyOptions({ priceFormat: pf })
      params.chartRefs.current.ma200S.applyOptions({ priceFormat: pf })
      params.chartRefs.current.mainChart.priceScale('right').applyOptions({ autoScale: true })
    }
    params.fitNextRef.current = true
    params.renderData(data.candles)
    connectWs(data.usedSpot)
    params.setLoading(false)
  } else if (error) {
    console.error(error)
    const step =
      { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[params.interval] ||
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
    params.candlesRef.current = cands
    params.fitNextRef.current = true
    params.renderData(cands)
    params.setWsStatus({ text: 'Demo data (offline)', tone: 'err' })
    params.setLoading(false)
  }

  return true
}
