import type { RoundStatus } from './types'

export type LifecycleEvent =
  | 'publish'
  | 'confirm'
  | 'fund'
  | 'execute'
  | 'settle'
  | 'claim'
  | 'cancel'

export interface TransitionResult {
  ok: boolean
  newStatus?: RoundStatus
  error?: string
}

const TRANSITION_MAP: Record<RoundStatus, Partial<Record<LifecycleEvent, RoundStatus>>> = {
  draft: { publish: 'open' },
  open: { confirm: 'confirmed', cancel: 'cancelled' },
  confirmed: { fund: 'funding', cancel: 'cancelled' },
  funding: { execute: 'executed' },
  executed: { settle: 'settled' },
  settled: { claim: 'claimed' },
  claimed: {},
  cancelled: {},
}

export function transition(current: RoundStatus, event: LifecycleEvent): TransitionResult {
  const targets = TRANSITION_MAP[current]
  if (!targets) return { ok: false, error: `Unknown status: ${current}` }
  const next = targets[event]
  if (!next) return { ok: false, error: `Cannot ${event} from ${current}` }
  return { ok: true, newStatus: next }
}

export function validEvents(status: RoundStatus): LifecycleEvent[] {
  const targets = TRANSITION_MAP[status]
  if (!targets) return []
  return Object.keys(targets) as LifecycleEvent[]
}
