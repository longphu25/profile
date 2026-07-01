// BTC Chart — ICT (Inner Circle Trader) session & Judas Swing analysis.
//
// Pure logic, no side-effects. Decodes the Asian / London / New York trading
// sessions from UTC candle timestamps, tracks each Asian session's high/low
// (the liquidity pool the crowd's stops sit behind), and detects the London
// "Judas Swing": an early-session sweep of Asian liquidity that reverses —
// smart money running stops before price moves the real direction.
//
// Killzone windows are fixed UTC (crypto trades 24/7, no DST). Session logic
// only applies to intraday timeframes; 4h/1d return an empty result.

import type { Candle } from './types'
import type { Interval } from './constants'

export type SessionName = 'asia' | 'london' | 'ny'

/** High/low range of one session on one UTC day (a liquidity pool). */
export interface SessionRange {
  name: SessionName
  /** UTC day bucket = floor(time / 86400). */
  dayStart: number
  high: number
  low: number
  startTime: number
  endTime: number
}

/** A detected London Judas Swing (sweep of Asian liquidity + rejection). */
export interface JudasSignal {
  time: number
  index: number
  /** 'bullish' = swept Asia low then reversed up; 'bearish' = swept high, reversed down. */
  type: 'bullish' | 'bearish'
  /** The Asian-session level that was swept. */
  sweptLevel: number
  sweptSide: 'high' | 'low'
  /** True when the sweep bar had a volume spike (>1.5x 20-bar avg). */
  volConfirm: boolean
  /** 0-100 heuristic confidence. */
  confidence: number
}

export interface KillzoneWindow {
  name: 'london' | 'ny'
  startTime: number
  endTime: number
  /** True when the latest candle falls inside this killzone. */
  active: boolean
}

export interface ICTResult {
  sessions: SessionRange[]
  judas: JudasSignal[]
  killzones: KillzoneWindow[]
  /** Session the latest candle sits in (null outside all sessions). */
  activeSession: SessionName | null
  /** Percent of average daily range already spent today (0-100). */
  adrPct: number
}

/** Session windows in UTC hours [startHour, endHour). */
const SESSION_HOURS: Record<SessionName, [number, number]> = {
  asia: [0, 8],
  london: [7, 10], // London killzone (Judas window)
  ny: [12, 15], // New York killzone
}

const DAY_SECONDS = 86400
const HOUR_SECONDS = 3600

const EMPTY_RESULT: ICTResult = {
  sessions: [],
  judas: [],
  killzones: [],
  activeSession: null,
  adrPct: 0,
}

/** Intraday-only: session decoding is meaningless above 1h. */
const INTRADAY: ReadonlySet<Interval> = new Set<Interval>(['1m', '5m', '15m', '1h'])

/** Hour-of-day (UTC) for a Unix-seconds timestamp. */
function utcHour(time: number): number {
  return Math.floor((((time % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / HOUR_SECONDS)
}

/** UTC day bucket for a Unix-seconds timestamp. */
function utcDay(time: number): number {
  return Math.floor(time / DAY_SECONDS)
}

function inSession(hour: number, name: SessionName): boolean {
  const [start, end] = SESSION_HOURS[name]
  return hour >= start && hour < end
}

// PLACEHOLDER_COMPUTE
/**
 * Decode ICT sessions + Judas Swings from candle data.
 * Returns an empty result on non-intraday timeframes or too-short data.
 */
export function computeICT(data: Candle[], interval: Interval): ICTResult {
  if (!INTRADAY.has(interval) || data.length < 10) return EMPTY_RESULT

  const n = data.length

  // ── Build per-day session ranges (Asia/London/NY high & low) ──
  // Keyed by `${day}:${session}` so we accumulate each session's extent.
  const rangeMap = new Map<string, SessionRange>()
  for (let i = 0; i < n; i++) {
    const c = data[i]
    const hour = utcHour(c.time)
    const day = utcDay(c.time)
    for (const name of ['asia', 'london', 'ny'] as SessionName[]) {
      if (!inSession(hour, name)) continue
      const key = `${day}:${name}`
      const r = rangeMap.get(key)
      if (r) {
        r.high = Math.max(r.high, c.high)
        r.low = Math.min(r.low, c.low)
        r.endTime = c.time
      } else {
        rangeMap.set(key, {
          name,
          dayStart: day,
          high: c.high,
          low: c.low,
          startTime: c.time,
          endTime: c.time,
        })
      }
    }
  }
  const sessions = [...rangeMap.values()].sort((a, b) => a.startTime - b.startTime)

  // Quick lookup: Asian range for a given UTC day.
  const asiaByDay = new Map<number, SessionRange>()
  for (const s of sessions) if (s.name === 'asia') asiaByDay.set(s.dayStart, s)

  // ── Volume baseline (20-bar SMA) for sweep confirmation ──
  const volSma = new Array<number>(n).fill(0)
  {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += data[i].volume
      if (i >= 20) sum -= data[i - 20].volume
      const period = Math.min(20, i + 1)
      volSma[i] = sum / period
    }
  }

  // ── Judas Swing detection ──
  // Inside the London killzone, a bar whose wick sweeps the same-day Asian
  // high (or low) but closes back inside the range is a stop-hunt reversal.
  const judas: JudasSignal[] = []
  for (let i = 1; i < n; i++) {
    const c = data[i]
    if (!inSession(utcHour(c.time), 'london')) continue
    const asia = asiaByDay.get(utcDay(c.time))
    if (!asia) continue

    const volConfirm = volSma[i] > 0 && c.volume > volSma[i] * 1.5

    // Bearish Judas: swept Asia high, rejected back below it.
    if (c.high > asia.high && c.close < asia.high) {
      const wick = c.high - Math.max(c.close, c.open)
      const body = Math.abs(c.close - c.open) || 1e-9
      const rejection = wick / body // bigger wick vs body = cleaner rejection
      const confidence = Math.min(100, 50 + (volConfirm ? 20 : 0) + Math.min(30, rejection * 10))
      judas.push({
        time: c.time,
        index: i,
        type: 'bearish',
        sweptLevel: asia.high,
        sweptSide: 'high',
        volConfirm,
        confidence: Math.round(confidence),
      })
    }
    // Bullish Judas: swept Asia low, rejected back above it.
    else if (c.low < asia.low && c.close > asia.low) {
      const wick = Math.min(c.close, c.open) - c.low
      const body = Math.abs(c.close - c.open) || 1e-9
      const rejection = wick / body
      const confidence = Math.min(100, 50 + (volConfirm ? 20 : 0) + Math.min(30, rejection * 10))
      judas.push({
        time: c.time,
        index: i,
        type: 'bullish',
        sweptLevel: asia.low,
        sweptSide: 'low',
        volConfirm,
        confidence: Math.round(confidence),
      })
    }
  }

  // ── Killzone windows for the latest UTC day + active state ──
  const last = data[n - 1]
  const lastHour = utcHour(last.time)
  const killzones: KillzoneWindow[] = (['london', 'ny'] as const).map((name) => {
    const day = utcDay(last.time)
    const [sh, eh] = SESSION_HOURS[name]
    return {
      name,
      startTime: day * DAY_SECONDS + sh * HOUR_SECONDS,
      endTime: day * DAY_SECONDS + eh * HOUR_SECONDS,
      active: inSession(lastHour, name),
    }
  })

  // Active session for the latest candle (Asia takes precedence in overlap).
  let activeSession: SessionName | null = null
  if (inSession(lastHour, 'asia')) activeSession = 'asia'
  else if (inSession(lastHour, 'london')) activeSession = 'london'
  else if (inSession(lastHour, 'ny')) activeSession = 'ny'

  // ── ADR% spent today (mirror of lien-reversal.ts ADR calc) ──
  let adrPct = 0
  if (n >= 14) {
    let adrSum = 0
    for (let i = n - 14; i < n; i++) adrSum += data[i].high - data[i].low
    const adr = adrSum / 14
    const todayRange = last.high - last.low
    adrPct = adr > 0 ? Math.min(100, (todayRange / adr) * 100) : 0
  }

  return { sessions, judas, killzones, activeSession, adrPct }
}
