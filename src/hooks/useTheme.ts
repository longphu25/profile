import { useState, useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'

// ============================================
// CUSTOMIZATION CONFIG
// ============================================
const CONFIG = {
  // Total animation duration (ms)
  duration: 1200,

  // Size of circle when it pauses in the middle
  // 0.4 = 40% of viewport, 0.5 = 50%, etc.
  midRadiusRatio: 0.5,

  // Multiplier for mid radius (1.25 = 25% larger)
  midRadiusMultiplier: 1.25,

  // Wave amplitude (higher = more wavy)
  waveAmplitudeStart: 20,
  waveAmplitudeMiddle: 30,
  waveAmplitudeEnd: 25,

  // Wave frequency (number of waves around the circle)
  waveFrequency: 3,

  // Animation phases timing (must sum to 1.0)
  phase1End: 0.3,
  phase2End: 0.6,
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme') as Theme | null
  return stored ?? getSystemTheme()
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const isAnimatingRef = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    if (isAnimatingRef.current) return

    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'

    const applyTheme = () => {
      flushSync(() => setTheme(nextTheme))
      localStorage.setItem('theme', nextTheme)
      document.documentElement.setAttribute('data-theme', nextTheme)
    }

    // Calculate circle center from the toggle button
    const btn = toggleRef.current
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2

    if (btn) {
      const rect = btn.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    }

    // Fallback if View Transitions not supported
    if (!document.startViewTransition) {
      applyTheme()
      return
    }

    isAnimatingRef.current = true

    const transition = document.startViewTransition(applyTheme)

    transition.ready.then(() => {
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )
      const midRadius = Math.min(window.innerWidth, window.innerHeight) * CONFIG.midRadiusRatio

      const keyframes = generateWavyKeyframes(x, y, maxRadius, midRadius)

      document.documentElement.animate(keyframes, {
        duration: CONFIG.duration,
        easing: 'ease-out',
        pseudoElement: '::view-transition-new(root)',
      })
    })

    transition.finished.then(() => {
      isAnimatingRef.current = false
    })
  }, [theme])

  return { theme, toggleTheme, toggleRef }
}

function generateWavyKeyframes(
  cx: number,
  cy: number,
  maxRadius: number,
  midRadius: number,
): Keyframe[] {
  const keyframes: Keyframe[] = []
  const totalFrames = 80
  const adjustedMidRadius = midRadius * CONFIG.midRadiusMultiplier
  const waveSpeed = 0.4

  for (let i = 0; i <= totalFrames; i++) {
    const progress = i / totalFrames
    let radius: number
    let waveAmplitude: number
    let wavePhase: number

    if (progress < CONFIG.phase1End) {
      // Phase 1: Expand to middle with wave from start
      const phaseProgress = progress / CONFIG.phase1End
      radius = adjustedMidRadius * easeOutCubic(phaseProgress)
      waveAmplitude = CONFIG.waveAmplitudeStart * phaseProgress
      wavePhase = phaseProgress * Math.PI * waveSpeed
    } else if (progress < CONFIG.phase2End) {
      // Phase 2: Wave at middle - slower animation
      const phaseProgress = (progress - CONFIG.phase1End) / (CONFIG.phase2End - CONFIG.phase1End)
      radius = adjustedMidRadius
      waveAmplitude =
        CONFIG.waveAmplitudeStart +
        (CONFIG.waveAmplitudeMiddle - CONFIG.waveAmplitudeStart) * Math.sin(phaseProgress * Math.PI)
      wavePhase = Math.PI * waveSpeed + phaseProgress * Math.PI * waveSpeed
    } else {
      // Phase 3: Expand to full
      const phaseProgress = (progress - CONFIG.phase2End) / (1 - CONFIG.phase2End)
      radius = adjustedMidRadius + (maxRadius - adjustedMidRadius) * easeOutCubic(phaseProgress)
      waveAmplitude = CONFIG.waveAmplitudeEnd * (1 - phaseProgress)
      wavePhase = Math.PI * waveSpeed * 2 + phaseProgress * Math.PI * waveSpeed
    }

    const clipPath = generateWavyCirclePath(
      cx,
      cy,
      radius,
      waveAmplitude,
      CONFIG.waveFrequency,
      wavePhase,
    )
    keyframes.push({ clipPath, offset: progress })
  }

  return keyframes
}

function generateWavyCirclePath(
  cx: number,
  cy: number,
  radius: number,
  waveAmplitude: number,
  waveFrequency: number,
  wavePhase: number,
): string {
  const points: string[] = []
  const segments = 72

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const wave = waveAmplitude * Math.sin(angle * waveFrequency + wavePhase)
    const wave2 = waveAmplitude * 0.5 * Math.sin(angle * 8 - wavePhase * 0.7)
    const r = radius + wave + wave2
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    points.push(`${x}px ${y}px`)
  }

  return `polygon(${points.join(', ')})`
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
