import { useEffect, useReducer } from 'react'

/**
 * THROWAWAY prototype switcher (UI prototype skill, sub-shape A).
 *
 * Floating pill that cycles the `?variant=` URL param across the redesign
 * candidates rendered on the same Next route. Hidden in production builds so a
 * stray merge can never ship it. Delete this — and the losing variants — once a
 * direction is chosen.
 */

export type VariantKey = 'A' | 'B' | 'C'

export const VARIANT_LABELS: Record<VariantKey, string> = {
  A: 'Swipe Deck',
  B: 'Bottom-Sheet Trader',
  C: 'Single Scroll Feed',
}

const ORDER: VariantKey[] = ['A', 'B', 'C']

/** Read the current `?variant=` value, or null when none is set (legacy R1–R8). */
export function readVariant(): VariantKey | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return raw === 'A' || raw === 'B' || raw === 'C' ? raw : null
}

function writeVariant(next: VariantKey) {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', next)
  window.history.replaceState(null, '', url.toString())
  window.dispatchEvent(new Event('pc-variant-change'))
}

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
  // Arrow keys cycle, except while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const i = ORDER.indexOf(current)
      const delta = e.key === 'ArrowRight' ? 1 : -1
      writeVariant(ORDER[(i + delta + ORDER.length) % ORDER.length])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (import.meta.env.PROD) return null

  function cycle(delta: number) {
    const i = ORDER.indexOf(current)
    writeVariant(ORDER[(i + delta + ORDER.length) % ORDER.length])
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-full border border-primary-fixed-dim bg-surface-container-lowest px-2 py-1.5 shadow-2xl [padding-bottom:max(0.375rem,env(safe-area-inset-bottom))]"
      role="group"
      aria-label="Prototype variant switcher"
    >
      <button
        type="button"
        onClick={() => cycle(-1)}
        aria-label="Previous variant"
        className="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-primary-fixed-dim"
      >
        chevron_left
      </button>
      <span className="font-data text-data-sm tabular-nums text-on-surface whitespace-nowrap px-1">
        <span className="font-bold text-primary-fixed-dim">{current}</span>
        <span className="mx-1 text-outline-variant">·</span>
        {VARIANT_LABELS[current]}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        aria-label="Next variant"
        className="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-primary-fixed-dim"
      >
        chevron_right
      </button>
    </div>
  )
}

/** Subscribe a component to `?variant=` changes (popstate + our custom event). */
export function useVariant(): VariantKey | null {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const onChange = () => force()
    window.addEventListener('pc-variant-change', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('pc-variant-change', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  return readVariant()
}
