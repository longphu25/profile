/** Centralized motion tokens for the redesigned (Next) Predict Club surface.
 * Durations are milliseconds; easings are CSS cubic-beziers. Use these instead
 * of ad-hoc values so animation stays consistent and reduced-motion is honored
 * in one place.
 *
 * Motion policy (cockpit rebuild, decision 11): restrained / institutional.
 * Motion fires ONLY on genuine state change (phase advance, execute confirm,
 * claim ready, sheet open/close). Numbers never bounce or shimmer on oracle
 * ticks. Everything collapses to instant under prefers-reduced-motion. */

import { useEffect, useState } from 'react'

export const MOTION = {
  duration: { instant: 0, fast: 120, base: 220, slow: 360 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  )
}

/** A duration collapsed to 0 when the user prefers reduced motion. */
export function motionDuration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms
}

/** Reactive reduced-motion preference — re-renders when the OS setting flips
 * mid-session, so motion-gated components stay correct without a reload. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReduced(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
