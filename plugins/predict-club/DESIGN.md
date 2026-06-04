---
name: Predict Club Terminal
colors:
  surface: '#0c1512'
  surface-dim: '#0c1512'
  surface-bright: '#323b37'
  surface-container-lowest: '#07100d'
  surface-container-low: '#151d1a'
  surface-container: '#19211e'
  surface-container-high: '#232c28'
  surface-container-highest: '#2e3733'
  on-surface: '#dbe5df'
  on-surface-variant: '#b9cbc2'
  inverse-surface: '#dbe5df'
  inverse-on-surface: '#29322f'
  outline: '#83958d'
  outline-variant: '#3a4a44'
  surface-tint: '#00e0b3'
  primary: '#fdfffc'
  on-primary: '#00382b'
  primary-container: '#00ffcc'
  on-primary-container: '#00725a'
  inverse-primary: '#006b54'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#fffeff'
  on-tertiary: '#393000'
  tertiary-container: '#ffe150'
  on-tertiary-container: '#746300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#24ffcd'
  primary-fixed-dim: '#00e0b3'
  on-primary-fixed: '#002118'
  on-primary-fixed-variant: '#00513f'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffe257'
  tertiary-fixed-dim: '#e2c635'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#534600'
  background: '#0c1512'
  on-background: '#dbe5df'
  surface-variant: '#2e3733'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  panel-gutter: 1px
---

## Brand & Style

The visual identity of the design system is anchored in high-performance utility and technical precision. It is designed for professional traders who require high information density without cognitive overload. The style is **Modern/Corporate** with a **Minimalist** finish, prioritizing legibility and rapid decision-making over decorative elements. 

By utilizing a "Terminal-First" approach, the UI minimizes distractions through a strictly dark-mode environment, allowing critical data points—like price action and execution status—to command attention through high-contrast accents. The aesthetic is inspired by advanced IDEs and institutional trading platforms, emphasizing a sense of control, speed, and reliability within the Sui and DeepBook ecosystems.

## Colors

The palette is optimized for long-duration sessions and critical monitoring. 

- **Primary Neutrals:** The foundation uses a deep navy-black scale (`#020617` to `#1E293B`). This provides a low-strain backdrop that makes transactional data stand out.
- **Action & Health (Mint):** Used for primary actions, bullish price movements, and "Ready" states. It signifies growth and system health.
- **Caution (Amber):** Reserved for non-blocking warnings, pending states, or slippage alerts.
- **Danger (Red-Orange):** High-urgency color for liquidation risks, blocked orders, or negative price action.
- **Information (Blue-Gray):** Applied to metadata, inactive labels, and secondary UI elements to keep them from competing with primary data.

## Typography

Typography is divided into two functional roles: **System Interface** and **Data Display**.

1.  **System Interface (Inter):** Used for navigation, labels, and descriptive text. It provides a modern, accessible feel.
2.  **Data Display (JetBrains Mono):** Crucial for all numerical values. Monospaced characters ensure that prices, countdowns, and balance sheets remain perfectly aligned in vertical columns, preventing "shimmering" or horizontal shifting when numbers update rapidly.

**Hierarchy Rules:**
- Use `label-caps` for table headers and section titles to maximize screen real estate.
- Use `data-md` for standard table cells.
- Use `data-lg` for primary tickers and balance summaries.

## Layout & Spacing

This design system utilizes a **Fluid Panel Grid**. The screen is treated as a single viewport divided into functional modules (Order Book, Charts, Position List).

- **Module Gutters:** Panels are separated by 1px borders rather than wide gaps to maintain the "Terminal" feel and maximize data density.
- **Internal Padding:** Modules should use a standard `md` (12px) or `sm` (8px) padding to ensure content is readable but compact.
- **Mobile Adaptation:** On mobile devices, panels reflow into a vertical stack or a tabbed interface. Gutters increase to `sm` (8px) to provide touch-target safety.
- **Density:** High density is the priority. Vertical rhythm should favor 4px increments.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **High-Contrast Outlines** rather than traditional drop shadows, which can appear muddy in dark-mode trading environments.

- **Surface Levels:** The background follows a "lighter as it lifts" logic. The base deck is the darkest, while active modals or dropdowns use the `background_overlay` color.
- **Borders:** Every panel and input is defined by a 1px border (`border_contrast`). This creates a structural grid.
- **Active States:** Active or focused elements are highlighted with a **Subtle Glow** (a 2px blur using the `primary_color` at 30% opacity) or a high-contrast Mint border.
- **Backdrop:** Use a heavy background blur (20px+) for overlays to maintain context of the underlying price action.

## Shapes

The shape language is disciplined and professional. 

- **Radius:** A consistent `0.25rem` (4px) radius is applied to buttons, inputs, and panel corners. This "Soft" setting keeps the UI feeling modern without losing the precision associated with sharp-edged technical tools.
- **Interactive Elements:** Buttons and form inputs share this radius to create a unified component language.
- **Data Tags:** Small status chips (e.g., "SUI/USDC") may use a slightly more rounded `rounded-lg` (8px) to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid Mint background with Navy text. Compact height (32px or 36px).
- **Secondary:** Outlined with `border_contrast`, Mint text.
- **Ghost:** No background, Blue-gray text, appearing Mint on hover.

### Inputs
- **Trading Fields:** Dark background with a 1px border. On focus, the border turns Mint with a subtle outer glow. Use JetBrains Mono for all numeric input.
- **Suffix/Prefix:** Integrated labels (e.g., "MAX" or "SUI") should be Blue-gray and use `label-caps`.

### Data Tables (Order Books / Positions)
- **Rows:** Subtle hover state (background lightens by 5%). No vertical borders between columns to keep the view clean.
- **Cells:** Use color-coding for data (Mint for Buy/Long, Red-orange for Sell/Short).

### Chips & Badges
- **Status Indicators:** Small, pill-shaped badges. "Ready" uses a Mint outline; "Risk" uses a Red-orange solid fill.

### Cards & Panels
- **Containers:** Defined by `background_surface` and a 1px border. Headers should have a distinct bottom border to separate them from the content.