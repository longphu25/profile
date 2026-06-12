import { demoClubState } from '../domain/fixtures'
import type { ClubState } from '../domain/types'

const STORAGE_KEY = 'predict-club:v1'

/** De-duplicate an array of records by `id`, keeping the last occurrence. */
function dedupById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) {
    if (item && typeof item.id === 'string') byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

/** Sanitize persisted club state: remove duplicate ids that accumulated across sessions. */
function sanitizeClubState(club: ClubState): ClubState {
  return {
    ...club,
    escrowOffers: Array.isArray(club.escrowOffers)
      ? dedupById(club.escrowOffers)
      : club.escrowOffers,
    history: Array.isArray(club.history) ? dedupById(club.history) : club.history,
    members: Array.isArray(club.members) ? dedupById(club.members) : club.members,
  }
}

export interface PersistedClubStateV1 {
  _version: 1
  _updatedAt: number
  club: ClubState
}

/**
 * Saves club state to localStorage wrapped in a versioned envelope.
 * No-op in non-browser environments.
 */
export function saveClubState(state: ClubState): void {
  if (typeof window === 'undefined') {
    return
  }

  const persisted: PersistedClubStateV1 = {
    _version: 1,
    _updatedAt: Date.now(),
    club: state,
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch (e) {
    console.warn('[predict-club] Failed to save state to localStorage:', e)
  }
}

/**
 * Loads club state from localStorage with version validation.
 * Returns default state on corruption, missing data, or version mismatch.
 * Never throws.
 */
export function loadClubState(): ClubState {
  if (typeof window === 'undefined') {
    return demoClubState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return demoClubState
    }

    const parsed = JSON.parse(raw)

    // Validate versioned envelope
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[predict-club] localStorage data is not an object, using default state')
      return demoClubState
    }

    if (parsed._version !== 1) {
      console.warn(
        '[predict-club] Unknown schema version:',
        parsed._version,
        '— using default state',
      )
      return demoClubState
    }

    if (!parsed.club || typeof parsed.club !== 'object') {
      console.warn(
        '[predict-club] Missing or invalid club field in persisted state, using default state',
      )
      return demoClubState
    }

    // Validate required ClubState fields exist
    const club = parsed.club
    if (
      typeof club.name !== 'string' ||
      typeof club.leaderName !== 'string' ||
      !club.activeRound ||
      !Array.isArray(club.members)
    ) {
      console.warn(
        '[predict-club] Persisted club state missing required fields, using default state',
      )
      return demoClubState
    }

    return sanitizeClubState(club as ClubState)
  } catch (e) {
    console.warn('[predict-club] Failed to load state from localStorage:', e)
    return demoClubState
  }
}
