import { describe, it, expect } from 'bun:test'
import {
  mapStatusToPhase,
  secondsToSettlement,
  settlementProgress,
  formatTimer,
  PHASE_ORDER,
} from '../../plugins/predict-club/domain/roundPhase'
import type { RoundStatus } from '../../plugins/predict-club/domain/types'

const ALL_STATUSES: RoundStatus[] = [
  'draft',
  'open',
  'confirmed',
  'funding',
  'executed',
  'settled',
  'claimed',
  'cancelled',
]

describe('mapStatusToPhase', () => {
  it('maps setup statuses to step 1', () => {
    for (const s of ['draft', 'open'] as RoundStatus[]) {
      const m = mapStatusToPhase(s)
      expect(m.phase).toBe('setup')
      expect(m.stepIndex).toBe(1)
      expect(m.cancelled).toBe(false)
      expect(m.terminal).toBe(false)
    }
  })

  it('maps fund statuses to step 2', () => {
    for (const s of ['confirmed', 'funding'] as RoundStatus[]) {
      const m = mapStatusToPhase(s)
      expect(m.phase).toBe('fund')
      expect(m.stepIndex).toBe(2)
    }
  })

  it('maps executed to live (step 3)', () => {
    const m = mapStatusToPhase('executed')
    expect(m.phase).toBe('live')
    expect(m.stepIndex).toBe(3)
    expect(m.terminal).toBe(false)
  })

  it('maps settled to settle (step 4)', () => {
    const m = mapStatusToPhase('settled')
    expect(m.phase).toBe('settle')
    expect(m.stepIndex).toBe(4)
  })

  it('maps claimed to claim (step 5), terminal', () => {
    const m = mapStatusToPhase('claimed')
    expect(m.phase).toBe('claim')
    expect(m.stepIndex).toBe(5)
    expect(m.terminal).toBe(true)
    expect(m.cancelled).toBe(false)
  })

  it('flags cancelled with no active step', () => {
    const m = mapStatusToPhase('cancelled')
    expect(m.cancelled).toBe(true)
    expect(m.terminal).toBe(true)
    expect(m.stepIndex).toBe(0)
  })

  it('covers every status', () => {
    for (const s of ALL_STATUSES) {
      expect(() => mapStatusToPhase(s)).not.toThrow()
    }
    expect(PHASE_ORDER).toHaveLength(5)
  })
})

describe('secondsToSettlement', () => {
  const now = 1_000_000

  it('returns null for every status except executed', () => {
    for (const s of ALL_STATUSES) {
      if (s === 'executed') continue
      expect(
        secondsToSettlement({ status: s, oracleExpiryMs: now + 60_000, nowMs: now }),
      ).toBeNull()
    }
  })

  it('returns positive seconds when executed with a future expiry', () => {
    expect(
      secondsToSettlement({ status: 'executed', oracleExpiryMs: now + 65_000, nowMs: now }),
    ).toBe(65)
  })

  it('returns null when executed but expiry is in the past', () => {
    expect(
      secondsToSettlement({ status: 'executed', oracleExpiryMs: now - 1, nowMs: now }),
    ).toBeNull()
  })

  it('returns null when expiry is missing', () => {
    expect(secondsToSettlement({ status: 'executed', oracleExpiryMs: null, nowMs: now })).toBeNull()
  })
})

describe('settlementProgress', () => {
  it('returns null when an anchor is missing', () => {
    expect(settlementProgress({ oracleExpiryMs: 100, nowMs: 50 })).toBeNull()
    expect(settlementProgress({ confirmedAtMs: 0, oracleExpiryMs: null, nowMs: 50 })).toBeNull()
  })

  it('returns 0 before the span starts and 1 after it ends', () => {
    expect(settlementProgress({ confirmedAtMs: 100, oracleExpiryMs: 200, nowMs: 50 })).toBe(0)
    expect(settlementProgress({ confirmedAtMs: 100, oracleExpiryMs: 200, nowMs: 999 })).toBe(1)
  })

  it('returns a fraction mid-span', () => {
    expect(settlementProgress({ confirmedAtMs: 0, oracleExpiryMs: 100, nowMs: 25 })).toBe(0.25)
  })
})

describe('formatTimer', () => {
  it('formats zero', () => {
    expect(formatTimer(0)).toBe('00:00')
  })

  it('formats sub-minute and minute values', () => {
    expect(formatTimer(125)).toBe('02:05')
    expect(formatTimer(9)).toBe('00:09')
  })

  it('clamps negatives to zero', () => {
    expect(formatTimer(-5)).toBe('00:00')
  })

  it('does not cap minutes at 59', () => {
    expect(formatTimer(3661)).toBe('61:01')
  })
})
