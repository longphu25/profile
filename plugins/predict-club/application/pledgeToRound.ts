import type { ClubState } from '../domain/types'
import { canMemberPledge } from '../domain/policies'

export interface PledgeParams {
  memberId: string
  amountDusdc: number
  walletBalance: number
}

export function pledgeToRound(
  club: ClubState,
  params: PledgeParams,
): { ok: boolean; club?: ClubState; error?: string } {
  const member = club.members.find((m) => m.id === params.memberId)
  if (!member) return { ok: false, error: 'Member not found' }

  if (!canMemberPledge(club.activeRound, member.state)) {
    return {
      ok: false,
      error: `Cannot pledge: round is ${club.activeRound.status}, member is ${member.state}`,
    }
  }

  if (params.amountDusdc > params.walletBalance) {
    return {
      ok: false,
      error: `Insufficient balance: need ${params.amountDusdc}, have ${params.walletBalance}`,
    }
  }

  const previousPledge = member.pledgedDusdc
  const updatedMembers = club.members.map((m) =>
    m.id === params.memberId
      ? { ...m, state: 'pledged' as const, pledgedDusdc: params.amountDusdc }
      : m,
  )
  const pledgeDelta = params.amountDusdc - previousPledge

  return {
    ok: true,
    club: {
      ...club,
      members: updatedMembers,
      activeRound: {
        ...club.activeRound,
        totalPledgedDusdc: club.activeRound.totalPledgedDusdc + pledgeDelta,
      },
    },
  }
}
