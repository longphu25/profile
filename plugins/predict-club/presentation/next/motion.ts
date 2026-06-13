/** Centralized motion tokens for the redesigned (Next) Predict Club surface.
 * Durations are milliseconds; easings are CSS cubic-beziers. Use these instead
 * of ad-hoc values so animation stays consistent and reduced-motion is honored
 * in one place. */

export const MOTION = {
  duration: { instant: 0, fast: 120, base: 220, slow: 360 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** A duration collapsed to 0 when the user prefers reduced motion. */
export function motionDuration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms
}
