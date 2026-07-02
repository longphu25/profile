/* eslint-disable react-refresh/only-export-components -- throwaway prototype entry */
// PROTOTYPE — throwaway. 3 round-lifecycle UI variants on one route.
// Switch via ?variant=A|B|C, floating bottom bar, or ← / → keys.
// Auto-advances through the lifecycle; use the phase scrubber to jump.
// Question: how does a user see where a round is, time-to-end, and when to claim?
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { VariantA, VariantB, VariantC } from './variants'
import { initialRound, tick, jumpTo, PHASES, PHASE_LABEL, type RoundMock, type Phase } from './mock'

const VARIANTS = ['A', 'B', 'C'] as const
type VariantKey = (typeof VARIANTS)[number]
const VARIANT_NAME: Record<VariantKey, string> = {
  A: 'Horizontal stepper',
  B: 'Vertical timeline',
  C: 'Focused status card',
}

function readVariant(): VariantKey {
  const p = new URLSearchParams(location.search).get('variant')?.toUpperCase()
  return (VARIANTS as readonly string[]).includes(p ?? '') ? (p as VariantKey) : 'A'
}

function setVariantParam(v: VariantKey) {
  const url = new URL(location.href)
  url.searchParams.set('variant', v)
  history.replaceState(null, '', url)
}

function App() {
  const [variant, setVariant] = useState<VariantKey>(readVariant)
  const [round, setRound] = useState<RoundMock>(initialRound)
  const [paused, setPaused] = useState(false)

  // Auto-advance the mock lifecycle.
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setRound((r) => tick(r, 1)), 1000)
    return () => clearInterval(id)
  }, [paused])

  // Keyboard variant switching.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const i = VARIANTS.indexOf(variant)
      const next = e.key === 'ArrowRight' ? (i + 1) % 3 : (i + 2) % 3
      const v = VARIANTS[next]
      setVariant(v)
      setVariantParam(v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant])

  const Current = variant === 'A' ? VariantA : variant === 'B' ? VariantB : VariantC

  const pill = (active: boolean) => ({
    background: active ? '#00e0b3' : 'transparent',
    color: active ? '#0c1512' : '#83958d',
    border: `1px solid ${active ? '#00e0b3' : '#3a4a44'}`,
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    cursor: 'pointer',
  })

  return (
    <div style={{ minHeight: '100vh', paddingTop: 32, paddingBottom: 120 }}>
      <Current round={round} />

      {/* Floating prototype switcher */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          background: '#071011',
          border: '1px solid #3a4a44',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            style={{ ...pill(false), fontSize: 14 }}
            onClick={() => {
              const i = (VARIANTS.indexOf(variant) + 2) % 3
              setVariant(VARIANTS[i])
              setVariantParam(VARIANTS[i])
            }}
          >
            ←
          </button>
          <span
            style={{
              color: '#dbe5df',
              fontSize: 12,
              fontWeight: 700,
              minWidth: 170,
              textAlign: 'center',
            }}
          >
            {variant} — {VARIANT_NAME[variant]}
          </span>
          <button
            type="button"
            style={{ ...pill(false), fontSize: 14 }}
            onClick={() => {
              const i = (VARIANTS.indexOf(variant) + 1) % 3
              setVariant(VARIANTS[i])
              setVariantParam(VARIANTS[i])
            }}
          >
            →
          </button>
        </div>

        {/* Phase scrubber + pause */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {PHASES.map((p: Phase) => (
            <button
              type="button"
              key={p}
              style={pill(round.phase === p)}
              onClick={() => setRound((r) => jumpTo(r, p))}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
          <button type="button" style={pill(false)} onClick={() => setPaused((v) => !v)}>
            {paused ? '▶ play' : '⏸ pause'}
          </button>
          <button type="button" style={pill(false)} onClick={() => setRound(initialRound())}>
            ↺ reset
          </button>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
