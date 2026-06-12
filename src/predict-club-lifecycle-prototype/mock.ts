// PROTOTYPE — throwaway. Shared mock lifecycle engine for the 3 UI variants.
// Question: "How does a user see where a round is, how long until it ends, and
// when they can claim?" Auto-advances through phases so the whole lifecycle is
// observable; also scrubbable manually.

export type Phase = 'fund' | 'lock' | 'live' | 'settle' | 'claim'

export const PHASES: Phase[] = ['fund', 'lock', 'live', 'settle', 'claim']

export const PHASE_LABEL: Record<Phase, string> = {
  fund: 'Funding',
  lock: 'Locked',
  live: 'Live',
  settle: 'Settling',
  claim: 'Claim',
}

export const PHASE_HINT: Record<Phase, string> = {
  fund: 'Members pledge DUSDC to reach the funding target.',
  lock: 'Funding closed. Position is being placed on-chain.',
  live: 'Prediction is active. Waiting for the oracle to settle.',
  settle: 'Oracle settling the final price.',
  claim: 'Settled. Winners can claim their payout.',
}

// Seconds each phase lasts in the mock (compressed for demo).
export const PHASE_DURATION_S: Record<Phase, number> = {
  fund: 30,
  lock: 8,
  live: 45,
  settle: 6,
  claim: 0, // terminal
}

export interface RoundMock {
  market: string
  direction: 'UP' | 'DOWN'
  strike: number
  spot: number
  stakeDusdc: number
  payoutDusdc: number
  phase: Phase
  phaseElapsedS: number
  result: 'pending' | 'won' | 'lost'
  claimed: boolean
}

export function initialRound(): RoundMock {
  return {
    market: 'BTC/USD 5m',
    direction: 'UP',
    strike: 68600,
    spot: 68421,
    stakeDusdc: 250,
    payoutDusdc: 1420,
    phase: 'fund',
    phaseElapsedS: 0,
    result: 'pending',
    claimed: false,
  }
}

/** Advance the mock by `dt` seconds, rolling over phases. */
export function tick(round: RoundMock, dt: number): RoundMock {
  if (round.phase === 'claim') return round
  let elapsed = round.phaseElapsedS + dt
  let phase: Phase = round.phase
  let result: RoundMock['result'] = round.result

  while (phase !== 'claim' && elapsed >= PHASE_DURATION_S[phase]) {
    elapsed -= PHASE_DURATION_S[phase]
    const idx = PHASES.indexOf(phase)
    phase = PHASES[idx + 1]
    if (phase === 'claim') {
      // Decide result when entering claim.
      result = Math.random() > 0.4 ? 'won' : 'lost'
      elapsed = 0
    }
  }

  // Drift spot a little for liveliness.
  const spot = round.spot + (Math.random() - 0.45) * 40

  return { ...round, phase, phaseElapsedS: elapsed, result, spot: Math.round(spot) }
}

/** Jump to a specific phase (manual scrub). */
export function jumpTo(round: RoundMock, phase: Phase): RoundMock {
  const result = phase === 'claim' ? (round.result === 'pending' ? 'won' : round.result) : 'pending'
  return { ...round, phase, phaseElapsedS: 0, result, claimed: false }
}

/** Seconds remaining in the current phase (0 for terminal claim). */
export function phaseSecondsLeft(round: RoundMock): number {
  if (round.phase === 'claim') return 0
  return Math.max(0, PHASE_DURATION_S[round.phase] - round.phaseElapsedS)
}

/** 0..1 progress through the current phase. */
export function phaseProgress(round: RoundMock): number {
  const dur = PHASE_DURATION_S[round.phase]
  if (dur <= 0) return 1
  return Math.min(1, round.phaseElapsedS / dur)
}

/** Total seconds until the round becomes claimable (sum of remaining phases). */
export function secondsToClaim(round: RoundMock): number {
  if (round.phase === 'claim') return 0
  let total = phaseSecondsLeft(round)
  for (let i = PHASES.indexOf(round.phase) + 1; i < PHASES.length; i++) {
    total += PHASE_DURATION_S[PHASES[i]]
  }
  return total
}

export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
