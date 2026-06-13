import type { RoundStatus } from './types'

/**
 * Round lifecycle visualization logic (shared, pure, unit-tested).
 *
 * Maps the 8 on-chain `RoundStatus` values onto a 5-step member-facing
 * lifecycle. Countdown helpers are deliberately truthful: a real timer is
 * returned ONLY when a real deadline exists (status `executed` with a future
 * oracle expiry). User-driven phases never get a fabricated countdown.
 */

export type LifecyclePhase = 'setup' | 'fund' | 'live' | 'settle' | 'claim'

/** The 5 visible steps, in order. `stepIndex` is 1-based against this. */
export const PHASE_ORDER: readonly LifecyclePhase[] = [
  'setup',
  'fund',
  'live',
  'settle',
  'claim',
] as const

export const PHASE_LABEL: Record<LifecyclePhase, string> = {
  setup: 'Setup',
  fund: 'Fund',
  live: 'Live',
  settle: 'Settle',
  claim: 'Claim',
}

export const PHASE_HINT: Record<LifecyclePhase, string> = {
  setup: 'Leader is configuring the round',
  fund: 'Pledge DUSDC to join the round',
  live: 'Position is live until settlement',
  settle: 'Oracle settled — claim when ready',
  claim: 'Round complete',
}

export interface PhaseMapping {
  phase: LifecyclePhase
  /** 1-based index into PHASE_ORDER. */
  stepIndex: number
  cancelled: boolean
  terminal: boolean
}

/** Map an on-chain round status to its lifecycle phase + step index. */
export function mapStatusToPhase(status: RoundStatus): PhaseMapping {
  switch (status) {
    case 'draft':
    case 'open':
      return { phase: 'setup', stepIndex: 1, cancelled: false, terminal: false }
    case 'confirmed':
    case 'funding':
      return { phase: 'fund', stepIndex: 2, cancelled: false, terminal: false }
    case 'executed':
      return { phase: 'live', stepIndex: 3, cancelled: false, terminal: false }
    case 'settled':
      return { phase: 'settle', stepIndex: 4, cancelled: false, terminal: false }
    case 'claimed':
      return { phase: 'claim', stepIndex: 5, cancelled: false, terminal: true }
    case 'cancelled':
      return { phase: 'setup', stepIndex: 0, cancelled: true, terminal: true }
  }
}

/**
 * Seconds until settlement — a positive number ONLY when the round is live
 * (`executed`) and the oracle expiry is in the future. Returns `null` for every
 * other status, and when the deadline is missing or already past, so callers
 * never render a fabricated countdown.
 */
export function secondsToSettlement(args: {
  status: RoundStatus
  oracleExpiryMs: number | null
  nowMs: number
}): number | null {
  if (args.status !== 'executed') return null
  if (args.oracleExpiryMs === null) return null
  const remainingMs = args.oracleExpiryMs - args.nowMs
  if (remainingMs <= 0) return null
  return Math.floor(remainingMs / 1000)
}

/**
 * Settlement progress in 0..1 spanning `confirmedAt` → `oracleExpiry`.
 * Returns `null` when either anchor is missing. Clamped to [0, 1].
 */
export function settlementProgress(args: {
  confirmedAtMs?: number
  oracleExpiryMs: number | null
  nowMs: number
}): number | null {
  if (args.confirmedAtMs === undefined || args.oracleExpiryMs === null) return null
  const span = args.oracleExpiryMs - args.confirmedAtMs
  if (span <= 0) return null
  const elapsed = args.nowMs - args.confirmedAtMs
  if (elapsed <= 0) return 0
  if (elapsed >= span) return 1
  return elapsed / span
}

/** Format seconds as `MM:SS`, clamped at zero. Minutes are not capped at 59. */
export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
