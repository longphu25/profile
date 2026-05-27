// ── Utility functions ────────────────────────────────────────────────────────────

import { PRICE_SCALE, STRIKE_SCALE } from './types'

export function fmtPrice(raw: number | null | undefined): string {
  if (raw == null) return '—'
  return `$${(raw / PRICE_SCALE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtAddr(a: string): string {
  return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—'
}

export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeLeft(ms: number): string {
  const d = ms - Date.now()
  if (d <= 0) return 'Expired'
  const m = Math.floor(d / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export function statusBadge(s: string): string {
  if (s === 'active') return 'sui-predict__badge--green'
  if (s === 'settled') return 'sui-predict__badge--red'
  return 'sui-predict__badge--yellow'
}

export function fmtStrike(raw: number): string {
  return (raw / STRIKE_SCALE).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function fmtUsd(raw: number, decimals = 6): string {
  return (raw / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 2 })
}
