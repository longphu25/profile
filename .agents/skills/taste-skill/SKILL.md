# High-Agency Frontend Skill

| name | design-taste-frontend |
| --- | --- |
| description | Senior UI/UX Engineer. Architect digital interfaces overriding default LLM biases. Enforces metric-based rules, strict component architecture, CSS hardware acceleration, and balanced design engineering. |

## 1. ACTIVE BASELINE CONFIGURATION

- DESIGN_VARIANCE: 8 (1=Perfect Symmetry, 10=Artsy Chaos)
- MOTION_INTENSITY: 6 (1=Static/No movement, 10=Cinematic/Magic Physics)
- VISUAL_DENSITY: 4 (1=Art Gallery/Airy, 10=Pilot Cockpit/Packed Data)

AI Instruction: The standard baseline for all generations is strictly set to these values (8, 6, 4). Do not ask the user to edit this file. Otherwise, ALWAYS listen to the user: adapt these values dynamically based on what they explicitly request in their chat prompts. Use these baseline (or user-overridden) values as your global variables to drive the specific logic in Sections 3 through 7.

## 2. DEFAULT ARCHITECTURE & CONVENTIONS

Unless the user explicitly specifies a different stack, adhere to these structural constraints to maintain consistency:

- DEPENDENCY VERIFICATION [MANDATORY]: Before importing ANY 3rd party library, you MUST check `package.json`. If the package is missing, you MUST output the installation command before providing the code. Never assume a library exists.
- Framework & Interactivity: React or Next.js. Default to Server Components (RSC).
  - RSC SAFETY: Global state works ONLY in Client Components. In Next.js, wrap providers in a `"use client"` component.
  - INTERACTIVITY ISOLATION: If Sections 4 or 7 (Motion/Liquid Glass) are active, the specific interactive UI component MUST be extracted as an isolated leaf component with `'use client'` at the very top.
- State Management: Use local `useState`/`useReducer` for isolated UI. Use global state strictly for deep prop-drilling avoidance.
- Styling Policy: Use Tailwind CSS (v3/v4) for 90% of styling.
  - TAILWIND VERSION LOCK: Check `package.json` first. Do not use v4 syntax in v3 projects.
  - T4 CONFIG GUARD: For v4, do NOT use `tailwindcss` plugin in `postcss.config.js`. Use `@tailwindcss/postcss` or the Vite plugin.
- ANTI-EMOJI POLICY [CRITICAL]: NEVER use emojis in code, markup, text content, or alt text. Replace symbols with high-quality icons (Radix, Phosphor) or clean SVG primitives. Emojis are BANNED.
- Responsiveness & Spacing:
  - Standardize breakpoints (`sm`, `md`, `lg`, `xl`).
  - Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
  - Viewport Stability [CRITICAL]: NEVER use `h-screen` for full-height Hero sections. ALWAYS use `min-h-[100dvh]` to prevent layout jumping on mobile browsers (iOS Safari).
  - Grid over Flex-Math: NEVER use complex flexbox percentage math. ALWAYS use CSS Grid for reliable structures.
- Icons: Use `lucide-react` or SVG primitives. Standardize `strokeWidth` globally.

## 3. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

Rule 1: Deterministic Typography
- Display/Headlines: Default to `text-4xl md:text-6xl tracking-tighter leading-none`.
  - ANTI-SLOP: Discourage `Inter` for "Premium" or "Creative" vibes. Force unique character using `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
  - TECHNICAL UI RULE: Serif fonts are strictly BANNED for Dashboard/Software UIs.
- Body/Paragraphs: Default to `text-base text-gray-600 leading-relaxed max-w-[65ch]`.

Rule 2: Color Calibration
- Constraint: Max 1 Accent Color. Saturation < 80%.
- THE LILA BAN: The "AI Purple/Blue" aesthetic is strictly BANNED. No purple button glows, no neon gradients.
- COLOR CONSISTENCY: Stick to one palette for the entire output.

Rule 3: Layout Diversification
- ANTI-CENTER BIAS: Centered Hero/H1 sections are strictly BANNED when `LAYOUT_VARIANCE > 4`. Force "Split Screen" (50/50), "Left Aligned content/Right Aligned asset", or "Asymmetric White-space" structures.

Rule 4: Materiality, Shadows, and "Anti-Card Overuse"
- DASHBOARD HARDENING: For `VISUAL_DENSITY > 7`, generic card containers are strictly BANNED.
- Execution: Use cards ONLY when elevation communicates hierarchy. When a shadow is used, tint it to the background hue.

Rule 5: Interactive UI States
- Mandatory Generation: You MUST implement full interaction cycles:
  - Loading: Skeletal loaders matching layout sizes.
  - Empty States: Beautifully composed empty states.
  - Error States: Clear, inline error reporting.
  - Tactile Feedback: On `:active`, use `-translate-y-[1px]` or `scale-[0.98]`.

Rule 6: Data & Form Patterns
- Forms: Label MUST sit above input. Helper text optional. Error text below input. Use standard `gap-2` for input blocks.

## 4. CREATIVE PROACTIVITY (Anti-Slop Implementation)

- "Liquid Glass" Refraction: When glassmorphism is needed, go beyond `backdrop-blur`. Add a 1px inner border (`border-white/10`) and a subtle inner shadow.
- Perpetual Micro-Interactions: When `MOTION_INTENSITY > 5`, embed continuous, infinite micro-animations in standard components. Apply premium Spring Physics to all interactive elements.
- Staggered Orchestration: Do not mount lists or grids instantly. Use staggerChildren or CSS cascade animation-delay.

## 5. PERFORMANCE GUARDRAILS

- DOM Cost: Apply grain/noise filters exclusively to fixed, pointer-event-none pseudo-elements.
- Hardware Acceleration: Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`.
- Z-Index Restraint: NEVER spam arbitrary z-indexes. Use them strictly for systemic layer contexts.

## 6. TECHNICAL REFERENCE (Dial Definitions)

### DESIGN_VARIANCE (Level 1-10)
- 1-3: Flexbox justify-center, strict 12-column symmetrical grids.
- 4-7: Use margin-top overlapping, varied image aspect ratios, left-aligned headers.
- 8-10: Masonry layouts, CSS Grid with fractional units, massive empty zones.
- MOBILE OVERRIDE: For levels 4-10, any asymmetric layout MUST fall back to single-column on viewports < 768px.

### MOTION_INTENSITY (Level 1-10)
- 1-3: No automatic animations. CSS :hover and :active states only.
- 4-7: Use transition with cubic-bezier. Use animation-delay cascades. Focus on transform and opacity.
- 8-10: Complex scroll-triggered reveals or parallax.

### VISUAL_DENSITY (Level 1-10)
- 1-3: Lots of white space. Huge section gaps. Everything feels expensive and clean.
- 4-7: Normal spacing for standard web apps.
- 8-10: Tiny paddings. No card boxes; just 1px lines. Everything packed. Use font-mono for numbers.

## 7. AI TELLS (Forbidden Patterns)

### Visual & CSS
- NO Neon/Outer Glows: Use inner borders or subtle tinted shadows.
- NO Pure Black: Never use #000000. Use Off-Black, Zinc-950, or Charcoal.
- NO Oversaturated Accents: Desaturate accents to blend elegantly.
- NO Excessive Gradient Text.
- NO Custom Mouse Cursors.

### Typography
- NO Inter Font: Banned. Use Geist, Outfit, Cabinet Grotesk, or Satoshi.
- NO Oversized H1s: Control hierarchy with weight and color, not just massive scale.
- Serif Constraints: Use Serif ONLY for creative/editorial. NEVER on Dashboards.

### Layout & Spacing
- Align & Space Perfectly.
- NO 3-Column Card Layouts: Use 2-column Zig-Zag, asymmetric grid, or horizontal scrolling.

### Content & Data
- NO Generic Names: Use creative, realistic-sounding names.
- NO Generic Avatars.
- NO Fake Numbers: Use organic, messy data.
- NO Startup Slop Names.
- NO Filler Words: Avoid "Elevate", "Seamless", "Unleash", "Next-Gen". Use concrete verbs.

### External Resources
- NO Broken Unsplash Links: Use picsum.photos or SVG UI Avatars.
- Production-Ready Cleanliness: Code must be extremely clean, visually striking, and meticulously refined.

## 8. THE CREATIVE ARSENAL (High-End Inspiration)

Use GSAP (ScrollTrigger/Parallax) for complex scrolltelling. CRITICAL: Never mix GSAP with Framer Motion in the same component tree.

### Navigation
- Magnetic Button, Dynamic Island, Mega Menu Reveal, Floating Speed Dial.

### Layout & Grids
- Bento Grid, Masonry Layout, Split Screen Scroll, Curtain Reveal.

### Cards & Containers
- Parallax Tilt Card, Spotlight Border Card, Glassmorphism Panel, Holographic Foil Card.

### Scroll-Animations
- Sticky Scroll Stack, Horizontal Scroll Hijack, Zoom Parallax, Scroll Progress Path.

### Typography & Text
- Kinetic Marquee, Text Mask Reveal, Text Scramble Effect.

### Micro-Interactions
- Particle Explosion Button, Skeleton Shimmer, Directional Hover Aware Button, Mesh Gradient Background.

## 9. FINAL PRE-FLIGHT CHECK

- Is mobile layout collapse guaranteed for high-variance designs?
- Do full-height sections safely use `min-h-[100dvh]` instead of `h-screen`?
- Do `useEffect` animations contain strict cleanup functions?
- Are empty, loading, and error states provided?
- Are cards omitted in favor of spacing where possible?
- Did you strictly isolate CPU-heavy perpetual animations?
