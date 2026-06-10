import { describe, it, expect } from 'bun:test'
import { canClaim, resolveSettlement } from './settleQuickRound'
import { activateRound, createQuickRound, lockRound, settleRound } from '../domain/quickRound'
import type { ClubOracleSnapshot } from '../infrastructure/deepbookOracleService'

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

function makeRoundWithParticipants() {
  let round = lockRound(activateRound(createQuickRound(config)))
  round = {
    ...round,
    participants: [
      { address: '0xAlice', name: 'Alice', direction: 'UP', quantity: 1, joinedAt: Date.now() },
      { address: '0xBob', name: 'Bob', direction: 'DOWN', quantity: 1, joinedAt: Date.now() },
    ],
  }
  return round
}

describe('settleQuickRound', () => {
  describe('canClaim', () => {
    it('returns true for winner who has not claimed', () => {
      const round = settleRound(makeRoundWithParticipants(), 96000_000_000_000) // UP wins
      expect(canClaim(round, '0xAlice')).toBe(true)
      expect(canClaim(round, '0xalice')).toBe(true) // case-insensitive
    })

    it('returns false for loser', () => {
      const round = settleRound(makeRoundWithParticipants(), 96000_000_000_000) // UP wins
      expect(canClaim(round, '0xBob')).toBe(false)
    })

    it('returns false for non-participant', () => {
      const round = settleRound(makeRoundWithParticipants(), 96000_000_000_000)
      expect(canClaim(round, '0xCharlie')).toBe(false)
    })

    it('returns false if already claimed', () => {
      let round = settleRound(makeRoundWithParticipants(), 96000_000_000_000)
      round = {
        ...round,
        participants: round.participants.map((p) =>
          p.address === '0xAlice' ? { ...p, redeemDigest: '0xdigest' } : p,
        ),
      }
      expect(canClaim(round, '0xAlice')).toBe(false)
    })

    it('returns false if round not settled', () => {
      const round = makeRoundWithParticipants() // still 'locked'
      expect(canClaim(round, '0xAlice')).toBe(false)
    })
  })

  describe('resolveSettlement', () => {
    it('returns null when oracle has no settlement price', () => {
      const round = makeRoundWithParticipants()
      const snapshot = {
        oracleState: { settlement_price: null },
      } as unknown as ClubOracleSnapshot
      expect(resolveSettlement(round, snapshot)).toBeNull()
    })

    it('settles round when oracle has settlement price', () => {
      const round = makeRoundWithParticipants()
      const snapshot = {
        oracleState: { settlement_price: 96000 }, // USD, will be scaled
      } as unknown as ClubOracleSnapshot
      const settled = resolveSettlement(round, snapshot)
      expect(settled).not.toBeNull()
      expect(settled!.status).toBe('settled')
      expect(settled!.result).toBe('UP')
    })

    it('returns round as-is if already settled', () => {
      const round = settleRound(makeRoundWithParticipants(), 96000_000_000_000)
      const snapshot = {
        oracleState: { settlement_price: 96000 },
      } as unknown as ClubOracleSnapshot
      const result = resolveSettlement(round, snapshot)
      expect(result).toEqual(round)
    })
  })
})
