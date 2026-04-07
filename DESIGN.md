# Design System: The Academic Technologist

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Academic Technologist."** 

This system rejects the "SaaS-template" look in favor of an editorial, high-end CV experience. It balances the intellectual weight of classic typography with the precision of modern engineering. The goal is to move beyond flat layouts by using **intentional asymmetry, overlapping surfaces, and extreme tonal depth.** This system feels like a curated digital portfolio rather than a generic resume—combining the warmth of fine stationery (`#fbfaeb`) with the authoritative depth of forest greens (`#013011`).

## 2. Color & Surface Philosophy
The palette is a sophisticated "High-Contrast Naturalist" scheme. It uses a base of warm paper tones paired with deep, structural greens.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined exclusively through background color shifts. 
- To separate a section, transition from `surface` to `surface-container-low`. 
- To highlight a section, move to `surface-container-high`.
- **Why:** Physical lines create visual clutter. Tonal shifts create "presence."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted glass. 
- **Base Layer:** `surface` (#fbfaeb).
- **Secondary Content Layer:** `surface-container`.
- **Interactive/Floating Elements:** `surface-container-lowest` (#ffffff).
- **Deep Inset/Information Wells:** `surface-container-highest` (#e4e3d5).

### The "Glass & Gradient" Rule
To elevate the "Modern Tech" feel, use **Glassmorphism** for navigation bars and floating action cards.
- **Recipe:** Use a semi-transparent `surface` color (80% opacity) combined with a `backdrop-filter: blur(20px)`.
- **Signature Texture:** For primary CTAs or hero background accents, use a linear gradient from `primary` (#013011) to `primary-container` (#1b4725) at a 135-degree angle. This adds "soul" and depth that flat hex codes cannot achieve.

## 3. Typography
We utilize a triad of typefaces to establish a clear editorial voice.

*   **Display & Headline (Newsreader):** A sophisticated serif that brings a "Humanist" and "Academic" feel. Use `display-lg` for your name and `headline-md` for major section titles.
*   **Body & Title (Manrope):** A highly legible, modern geometric sans-serif. It handles the "Professional" side of the CV.
*   **Labels (Space Grotesk):** A tech-forward, slightly quirky sans-serif used for metadata, dates, and tags. It signals the "Tech-focused" nature of the brand.

**Hierarchy Tip:** Always pair a `display-lg` Newsreader title with a `label-md` Space Grotesk subtitle in `primary` color for a high-end, intentional contrast.

## 4. Elevation & Depth

### The Layering Principle
Avoid the "Shadow-Heavy" look of 2010s design. Depth is achieved by **stacking tones**. Place a `surface-container-lowest` card on a `surface-container-low` background to create a soft, natural lift.

### Ambient Shadows
When a card must "float" (e.g., a modal or a floating menu):
- **Blur:** 40px - 60px.
- **Opacity:** 4% - 6%.
- **Color:** Use a tinted version of `on-surface` (dark green-grey) rather than pure black to keep the lighting natural.

### The "Ghost Border" Fallback
If a border is required for accessibility, it must be a **Ghost Border**: Use `outline-variant` at 15% opacity. Never use 100% opaque borders.

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), `on-primary` text, `xl` roundedness. No shadow.
*   **Secondary:** `surface-container-highest` background, `primary` text.
*   **Tertiary:** Ghost style. No background, `primary` text, underline on hover using `primary` at 30% opacity.

### Cards & Experience Items
**Forbid the use of divider lines.** 
- Separate "Work Experience" items using 48px of vertical whitespace.
- Use a `surface-container-low` background for the "Card" area, and place the "Company Logo" or "Date" in a `surface-container-lowest` inner box to create nested depth.

### Chips (Skills & Tech Stack)
*   **Style:** `surface-container-highest` background, `label-sm` (Space Grotesk) typography.
*   **Shape:** `full` (pill shape).
*   **Interaction:** On hover, shift background to `secondary-container` and text to `on-secondary-container`.

### Input Fields
*   **Resting:** `surface-container-low` fill, bottom-only "Ghost Border" (20% opacity).
*   **Focus:** Background shifts to `surface-container-lowest`, bottom border animates to 100% opacity `primary`.

### Specialized CV Components
*   **The "Timeline Node":** A 12px circle using `primary-fixed-dim`. Do not connect nodes with a solid line; use a dashed `outline-variant` line at 20% opacity.
*   **The "Status Pulse":** For "Available for Work" indicators, use a `secondary` color dot with a soft, 4-second infinite scale animation.

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins (e.g., 10% left margin, 20% right margin) to create an editorial feel.
*   **Do** allow for massive amounts of whitespace (`64px`+) between major sections.
*   **Do** use `Newsreader` in italic for emphasis within body text to maintain the academic tone.

### Don't
*   **Don't** use 100% black (#000000). Use `on-surface` (#1b1c13) for text.
*   **Don't** use standard "Drop Shadows." Use Tonal Layering or Ambient Shadows only.
*   **Don't** use sharp corners. Stick to the `md` (0.375rem) to `xl` (0.75rem) roundedness scale to keep the tech-aesthetic "soft" and approachable.