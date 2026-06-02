// BTC Chart — localStorage persistence + JSON import/export.

import type { AlertRule } from './alerts'

const KEY = 'btc-chart:config:v1'

export interface VisFlags {
  nwe: boolean
  ma50: boolean
  ma200: boolean
  of: boolean
  vp: boolean
  rsi: boolean
  vol: boolean
}

export interface ZoomState {
  /** Logical range from lightweight-charts time-scale */
  from: number
  to: number
}

export interface SoundConfig {
  enabled: boolean
  volume: number // 0..1
}

export interface ChartConfig {
  version: 1
  interval: string
  symbol: string
  vis: VisFlags
  zoom: ZoomState | null
  alerts: AlertRule[]
  sound: SoundConfig
  notifications: boolean
  minimal: boolean
}

export const DEFAULT_CONFIG: ChartConfig = {
  version: 1,
  interval: '1h',
  symbol: 'BTCUSDT',
  vis: { nwe: true, ma50: true, ma200: true, of: true, vp: true, rsi: true, vol: true },
  zoom: null,
  alerts: [],
  sound: { enabled: true, volume: 0.4 },
  notifications: false,
  minimal: false,
}

/** Read full config from localStorage, with safe fallback. */
export function loadConfig(): ChartConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<ChartConfig>
    if (parsed.version !== 1) return { ...DEFAULT_CONFIG }
    return mergeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/** Merge a partial config onto defaults — used by load + import. */
export function mergeConfig(p: Partial<ChartConfig>): ChartConfig {
  return {
    ...DEFAULT_CONFIG,
    ...p,
    vis: { ...DEFAULT_CONFIG.vis, ...(p.vis ?? {}) },
    sound: { ...DEFAULT_CONFIG.sound, ...(p.sound ?? {}) },
    alerts: Array.isArray(p.alerts) ? p.alerts : [],
    zoom: p.zoom ?? null,
  }
}

/** Throttled writer — avoid hammering localStorage on every zoom frame. */
let writeTimer: ReturnType<typeof setTimeout> | null = null
let pending: ChartConfig | null = null

export function saveConfig(cfg: ChartConfig): void {
  if (typeof localStorage === 'undefined') return
  pending = cfg
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (!pending) return
    try {
      localStorage.setItem(KEY, JSON.stringify(pending))
    } catch {
      /* quota or private mode — silent */
    }
    pending = null
  }, 250)
}

/** Synchronous flush — call before unload to avoid losing pending writes. */
export function flushConfig(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  if (!pending) return
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    /* noop */
  }
  pending = null
}

/** Trigger a download of the current config as a JSON file. */
export function exportConfig(cfg: ChartConfig, filename = 'btc-chart-config.json'): void {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Read a user-selected JSON file, parse + validate, return merged config. */
export function importConfigFromFile(file: File): Promise<ChartConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result as string) as Partial<ChartConfig>
        resolve(mergeConfig(obj))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
