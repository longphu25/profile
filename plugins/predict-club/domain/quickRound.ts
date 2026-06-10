import type { Direction } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuickRoundConfig {
  oracleId: string
  underlyingAsset: string
  expiry: number
  strike: number
  tickSize: number
  minStrike: number
  joinWindowSeconds: number
  maxQuantityPerMember: number
}

export interface QuickRoundParticipant {
  address: string
  name: string
  direction: Direction
  quantity: number
  joinedAt: number
  txDigest?: string
  redeemDigest?: string
  payout?: number
}

export type QuickRoundStatus = 'draft' | 'live' | 'locked' | 'settling' | 'settled' | 'claimed'

export interface QuickRound {
  id: string
  config: QuickRoundConfig
  status: QuickRoundStatus
  startedAt: number
  lockedAt?: number
  settledAt?: number
  settlementPrice?: number
  participants: QuickRoundParticipant[]
  result?: 'UP' | 'DOWN'
}

// ── Pure Logic ────────────────────────────────────────────────────────────────

export function resolveATMStrike(spotPrice: number, tickSize: number, minStrike: number): number {
  const STRIKE_SCALE = 1e9
  const raw = Math.floor(spotPrice * STRIKE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}

export function isJoinWindowOpen(round: QuickRound): boolean {
  if (round.status !== 'live') return false
  const elapsedMs = Date.now() - round.startedAt
  return elapsedMs < round.config.joinWindowSeconds * 1000
}

export function remainingJoinSeconds(round: QuickRound): number {
  if (round.status !== 'live') return 0
  const elapsed = (Date.now() - round.startedAt) / 1000
  return Math.max(0, round.config.joinWindowSeconds - elapsed)
}

export function remainingExpirySeconds(round: QuickRound): number {
  const now = Date.now() / 1000
  return Math.max(0, round.config.expiry - now)
}

export function determineResult(strike: number, settlementPrice: number): 'UP' | 'DOWN' {
  // strike is in raw scale (1e9), settlementPrice also raw
  return settlementPrice > strike ? 'UP' : 'DOWN'
}

export function hasJoined(round: QuickRound, address: string): boolean {
  return round.participants.some((p) => p.address.toLowerCase() === address.toLowerCase())
}

export function createQuickRound(config: QuickRoundConfig): QuickRound {
  return {
    id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    config,
    status: 'draft',
    startedAt: 0,
    participants: [],
  }
}

export function activateRound(round: QuickRound): QuickRound {
  return { ...round, status: 'live', startedAt: Date.now() }
}

export function lockRound(round: QuickRound): QuickRound {
  return { ...round, status: 'locked', lockedAt: Date.now() }
}

export function settleRound(round: QuickRound, settlementPrice: number): QuickRound {
  const result = determineResult(round.config.strike, settlementPrice)
  return { ...round, status: 'settled', settledAt: Date.now(), settlementPrice, result }
}
