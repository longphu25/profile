import { demoClubState } from '../domain/fixtures'
import type { ClubState } from '../domain/types'

const STORAGE_KEY = 'predict-club:v1'

export function loadClubState(): ClubState {
  if (typeof window === 'undefined') {
    return demoClubState
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return demoClubState
    }
    return { ...demoClubState, ...JSON.parse(saved) } as ClubState
  } catch {
    return demoClubState
  }
}

export function saveClubState(state: ClubState): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
