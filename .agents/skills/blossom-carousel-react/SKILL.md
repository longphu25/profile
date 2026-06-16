---
name: blossom-carousel-react
description: Use for Blossom Carousel React or Next.js installation, stylesheet setup, JSX examples, Tailwind examples, accessibility or a11y guidance, controls, overscroll events, and React-specific integration.
---

# Blossom Carousel React

Use this skill for Blossom Carousel React or Next.js tasks involving installation, stylesheet setup, JSX usage, root element customization, controls, or overscroll handling.

Blossom Carousel React wraps Blossom Carousel Core. For shared engine behavior, lifecycle, and direct DOM concepts, also consider the `blossom-carousel-core` skill.

For migration questions from Embla, Swiper, Splide, Slick, or Flickity, use the `blossom-carousel-migration` skill first.

## Package

Install the React package:

```bash
npm install @blossom-carousel/react
```

Import the core stylesheet once in app setup unless the user has already imported it elsewhere:

```js
import "@blossom-carousel/core/style.css";
```

## React Setup

Import `BlossomCarousel` from `@blossom-carousel/react` and use it as a React component:

```jsx
import { BlossomCarousel } from "@blossom-carousel/react";
import "@blossom-carousel/core/style.css";

function App() {
  return <BlossomCarousel>{/* slides */}</BlossomCarousel>;
}
```

Include the stylesheet import in a component example only when the example is standalone (no App, layout, or `_app` file is shown). When showing a component alongside an App/layout file, import the stylesheet only in the App/layout file.

## Next.js Setup

In Next.js App Router projects, import the stylesheet from the root layout or another global CSS entry point:

```jsx
// app/layout.jsx
import "@blossom-carousel/core/style.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Then import and use the component where the carousel is rendered:

```jsx
import { BlossomCarousel } from "@blossom-carousel/react";

export function FeaturedCarousel() {
  return (
    <BlossomCarousel>
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>Slide {index + 1}</div>
      ))}
    </BlossomCarousel>
  );
}
```

If a Next.js App Router carousel component uses browser-only behavior, add `"use client"` at the top of that component file.

For Pages Router projects, import the stylesheet in `pages/_app.jsx` or `pages/_app.tsx` instead of `app/layout`.

## Basic Usage

Use `<BlossomCarousel>` as the carousel root and pass slides as children:

```jsx
<BlossomCarousel>
  {Array.from({ length: 12 }, (_, index) => (
    <div key={index}>Slide {index + 1}</div>
  ))}
</BlossomCarousel>
```

Each direct child becomes a slide. In React examples, include a stable `key` for mapped slide elements.

## Root Element

Use the `as` prop to define the HTML element rendered for the carousel root:

```jsx
<BlossomCarousel as="ul">
  {Array.from({ length: 12 }, (_, index) => (
    <li key={index}>Slide {index + 1}</li>
  ))}
</BlossomCarousel>
```

This renders the carousel root as a `ul` and keeps the slide elements as `li` children:

```html
<ul>
  <li>Slide 1</li>
  <li>Slide 2</li>
  <li>Slide 3</li>
  ...
</ul>
```

Match the root element to the slide markup; for list-like carousels, use `as="ul"` with `li` slides.

## Button Controls

Use a React ref for previous and next buttons:

```tsx
import { useRef } from "react";

export function App() {
  const blossomCarousel = useRef<{
    prev(): void;
    next(): void;
    element: HTMLElement;
  } | null>(null);

  return (
    <>
      <BlossomCarousel ref={blossomCarousel}>
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index}>Slide {index + 1}</div>
        ))}
      </BlossomCarousel>

      <button onClick={() => blossomCarousel.current?.prev()}>Previous</button>
      <button onClick={() => blossomCarousel.current?.next()}>Next</button>
    </>
  );
}
```

Call `prev()` and `next()` on `ref.current` rather than manually changing scroll positions.
The ref returned by `<BlossomCarousel>` is an imperative handle with `prev()`, `next()`, and `element: HTMLElement`. When using TypeScript, type the ref as `useRef<{ prev(): void; next(): void; element: HTMLElement } | null>(null)`.

## Overscroll API

Use `onOverscroll` to customize Blossom's drag overscroll behavior. Prevent the event when replacing the default rubberbanding effect:

```tsx
import { useRef } from "react";
import { BlossomCarousel } from "@blossom-carousel/react";

export function App() {
  const blossomCarousel = useRef<{
    prev(): void;
    next(): void;
    element: HTMLElement;
  } | null>(null);

  function onOverscroll(event: CustomEvent<{ left: number }>) {
    event.preventDefault();

    const overScroll = event.detail.left;

    Array.from(blossomCarousel.current?.element.children ?? []).forEach(
      (slide) => {
        (slide as HTMLElement).style.transform =
          `scale(${1 - overScroll * 0.1})`;
      },
    );
  }

  return (
    <BlossomCarousel
      ref={blossomCarousel}
      onOverscroll={(event) => {
        onOverscroll(event as CustomEvent<{ left: number }>);
      }}
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>Slide {index + 1}</div>
      ))}
    </BlossomCarousel>
  );
}
```

Read offsets from `event.detail.left` and apply custom visual effects to slides or the root element.

## Examples Reference

For visual layout recipes, consult `/docs/examples/` and adapt the selected example to React or Next.js syntax.
When adapting docs examples, preserve React syntax from this skill: use `<BlossomCarousel>`, `className`, stable `key` props, React refs, and React event handlers. The docs examples often include both CSS and optional Tailwind versions; use Tailwind utility classes only when the user's project uses Tailwind or asks for it, and otherwise use regular CSS classes.

## Accessibility Reference

When the user explicitly asks about carousel accessibility, a11y, ARIA, keyboard support, focus behavior, reduced motion, screen readers, or WCAG, consult `/docs/a11y/accessibility-guide.md` and adapt its patterns to React or Next.js syntax.

Use the guide for deeper guidance on semantic slide structure, labelled regions, real previous and next buttons, unique control names, keyboard alternatives to dragging, focus visibility, inactive slides, auto-rotation, live regions, picker semantics, forced colors, and manual accessibility testing.

## Implementation Guidance

- Prefer `@blossom-carousel/react` for React and Next.js projects.
- Import styles from `@blossom-carousel/core/style.css`, not from the React package.
- Use `BlossomCarousel` as a React component, not as a custom element.
- Preserve valid JSX syntax: use `className`, add `key` to mapped children, and when generating visible slide text like `Slide N`, start numbering at 1 with `index + 1` unless the user asks for zero-based numbering.
- For custom controls, use a React ref and call `prev()` or `next()` on `ref.current`.
- For custom overscroll styling, use `onOverscroll`, call `event.preventDefault()` when replacing the default rubberbanding effect, and read offsets from `event.detail.left`.
- For Next.js examples, place global stylesheet imports in `app/layout.jsx`, `app/layout.tsx`, `pages/_app.jsx`, or `pages/_app.tsx`, depending on the user's router.
- Add `"use client"` when the carousel is rendered from a Next.js App Router component that must run on the client.
- For core carousel behavior rather than React integration, refer to the `blossom-carousel-core` skill when available.

## Common Fixes

If the carousel is unstyled, check that this import exists in the app entry file, root layout, or component:

```js
import "@blossom-carousel/core/style.css";
```

If React warns about missing keys, add a `key` prop to each mapped slide element:

```jsx
{
  Array.from({ length: 12 }, (_, index) => (
    <div key={index}>Slide {index + 1}</div>
  ));
}
```

If list markup is invalid, use the `as` prop to align the carousel root with the slide elements, such as `as="ul"` for `li` slides.

If a Next.js App Router component fails because it uses browser-only behavior, add `"use client"` to the top of the carousel component file.

If custom previous or next buttons do nothing, check that the ref is attached to `<BlossomCarousel>` and that button handlers call `blossomCarousel.current.prev()` or `blossomCarousel.current.next()` after the component is mounted.

If a custom overscroll effect runs in addition to the default rubberbanding, call `event.preventDefault()` in the `onOverscroll` handler.
