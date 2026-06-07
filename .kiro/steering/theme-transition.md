---
inclusion: manual
---

# Wavy Circle Theme Transition Effect

Light/Dark mode transition using View Transitions API — a wavy circle expanding from click position.

## Reference File

- `src/hooks/useTheme.ts` — React hook implementation

## How It Works

Animation has 3 phases:

1. **Phase 1 (0-30%)**: Wavy circle expands from 0 to ~50% viewport
2. **Phase 2 (30-60%)**: Pauses in middle, waves ripple up/down creating a "breathing" effect
3. **Phase 3 (60-100%)**: Expands to full screen, waves fade out

## Configurable Parameters

```ts
const CONFIG = {
  duration: 1200,           // Total animation time (ms)
  midRadiusRatio: 0.5,      // Circle size at mid pause (0.5 = 50% viewport)
  midRadiusMultiplier: 1.25,// Extra multiplier for mid radius
  waveAmplitudeStart: 20,   // Initial wave amplitude
  waveAmplitudeMiddle: 30,  // Max wave amplitude at middle
  waveAmplitudeEnd: 25,     // Wave amplitude during final expansion
  waveFrequency: 3,         // Number of waves around the circle
  phase1End: 0.3,           // Phase 1 end point
  phase2End: 0.6,           // Phase 2 end point
}
```

## Key Techniques

- `polygon()` with 72 points creating wavy border
- 2 overlapping wave layers (`wave + wave2`) for organic feel
- `easeOutCubic` for smooth motion
- `flushSync` from React to synchronize DOM with View Transition
- Fallback for browsers without View Transitions API support

## Required CSS

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) { z-index: 1; }
::view-transition-new(root) { z-index: 9999; }
```

## Browser Support

- Chrome/Edge 111+
- Safari 18+
- Firefox: not supported (falls back to instant switch)
