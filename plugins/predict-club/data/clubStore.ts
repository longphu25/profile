/**
 * Shared global store for Predict Club state.
 * This enables multiple React roots (one per panel) to share the same state.
 * When any panel updates state, all other panels re-render.
 */
import { loadClubState, saveClubState } from './localClubStore'
import type { ClubState, EscrowOfferView, ModalKind } from '../domain/types'

type Listener = () => void

interface StoreState {
  club: ClubState
  modal: ModalKind | null
  selectedOffer: EscrowOfferView | null
  toastMessage: string | null
}

const listeners = new Set<Listener>()
let state: StoreState = {
  club: loadClubState(),
  modal: null,
  selectedOffer: null,
  toastMessage: null,
}

function notify() {
  for (const fn of listeners) fn()
}

export function getStoreState(): StoreState {
  return state
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setClub(club: ClubState) {
  state = { ...state, club }
  saveClubState(club)
  notify()
}

export function updateClub(updater: (prev: ClubState) => ClubState) {
  const next = updater(state.club)
  setClub(next)
}

export function setModal(modal: ModalKind | null) {
  state = { ...state, modal }
  notify()
}

export function setSelectedOffer(offer: EscrowOfferView | null) {
  state = { ...state, selectedOffer: offer }
  notify()
}

export function setToast(message: string | null) {
  state = { ...state, toastMessage: message }
  notify()
  if (message) {
    setTimeout(() => {
      state = { ...state, toastMessage: null }
      notify()
    }, 3000)
  }
}
