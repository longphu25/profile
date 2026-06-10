import { describe, it, expect } from 'bun:test'
import {
  createQuickRound,
  activateRound,
  lockRound,
  settleRound,
  isJoinWindowOpen,
  hasJoined,
  remainingJoinSeconds,
  remainingExpirySeconds,
  resolveATMStrike,
  determineResult,
} from './quickRound'

const config = {
  oracleId: '0xabc',
  underlyingAsset: 'BTC/USD',
  expiry: Math.floor(Date.now() / 1000) + 300,
  strike: 95000_000_000_000,
  tickSize: 500_000_000_000,
  minStrike: 80000_000_000_000,
  joinWindowSeconds: 30,
  maxQuantityPerMember: 1,
}

describe('quickRound', () => {
  it('creates round in draft status', () => {
    const round = createQuickRound(config)
    expect(round.status).toBe('draft')
    expect(round.startedAt).toBe(0)
    expect(round.participants).toEqual([])
  })

  it('activates round to live', () => {
    const round = activateRound(createQuickRound(config))
    expect(round.status).toBe('live')
    expect(round.startedAt).toBeGreaterThan(0)
  })

  it('join window open immediately after start', () => {
    const round = activateRound(createQuickRound(config))
    expect(isJoinWindowOpen(round)).toBe(true)
    expect(remainingJoinSeconds(round)).toBeGreaterThan(28)
  })

  it('join window closed after timeout', () => {
    const round = { ...activateRound(createQuickRound(config)), startedAt: Date.now() - 31_000 }
    expect(isJoinWindowOpen(round)).toBe(false)
    expect(remainingJoinSeconds(round)).toBe(0)
  })

  it('join window closed for non-live status', () => {
    const round = lockRound(activateRound(createQuickRound(config)))
    expect(isJoinWindowOpen(round)).toBe(false)
  })

  it('remainingExpirySeconds counts down', () => {
    const round = activateRound(createQuickRound(config))
    expect(remainingExpirySeconds(round)).toBeGreaterThan(290)
    expect(remainingExpirySeconds(round)).toBeLessThanOrEqual(300)
  })

  it('hasJoined detects participant (case-insensitive)', () => {
    const round = {
      ...activateRound(createQuickRound(config)),
      participants: [
        {
          address: '0xABCdef',
          name: 'Alice',
          direction: 'UP' as const,
          quantity: 1,
          joinedAt: Date.now(),
        },
      ],
    }
    expect(hasJoined(round, '0xabcdef')).toBe(true)
    expect(hasJoined(round, '0xABCDEF')).toBe(true)
    expect(hasJoined(round, '0x123456')).toBe(false)
  })

  it('resolveATMStrike snaps to tick grid', () => {
    const strike = resolveATMStrike(95420, 500_000_000_000, 80000_000_000_000)
    const offset = strike - 80000_000_000_000
    expect(offset % 500_000_000_000).toBe(0)
    expect(strike).toBeGreaterThan(80000_000_000_000)
  })

  it('resolveATMStrike handles zero tickSize', () => {
    const strike = resolveATMStrike(95000, 0, 80000_000_000_000)
    expect(strike).toBe(95000_000_000_000)
  })

  it('resolveATMStrike respects minStrike', () => {
    const strike = resolveATMStrike(50, 500_000_000_000, 80000_000_000_000)
    expect(strike).toBe(80000_000_000_000)
  })

  it('determineResult UP when settlement > strike', () => {
    expect(determineResult(95000_000_000_000, 95500_000_000_000)).toBe('UP')
  })

  it('determineResult DOWN when settlement <= strike', () => {
    expect(determineResult(95000_000_000_000, 94500_000_000_000)).toBe('DOWN')
    expect(determineResult(95000_000_000_000, 95000_000_000_000)).toBe('DOWN')
  })

  it('lockRound transitions to locked', () => {
    const round = lockRound(activateRound(createQuickRound(config)))
    expect(round.status).toBe('locked')
    expect(round.lockedAt).toBeGreaterThan(0)
  })

  it('settleRound transitions to settled with result', () => {
    let round = lockRound(activateRound(createQuickRound(config)))
    round = settleRound(round, 96000_000_000_000)
    expect(round.status).toBe('settled')
    expect(round.result).toBe('UP')
    expect(round.settlementPrice).toBe(96000_000_000_000)
    expect(round.settledAt).toBeGreaterThan(0)
  })

  it('settleRound DOWN result', () => {
    let round = lockRound(activateRound(createQuickRound(config)))
    round = settleRound(round, 90000_000_000_000)
    expect(round.result).toBe('DOWN')
  })
})
