---
name: Shadow DOM & Web Components
description: Use when building, debugging, or extending the plugin system that uses Shadow DOM for style isolation. Covers attachShadow, React portals into shadow roots, scoped CSS injection, plugin lifecycle (init/mount/unmount), HostAPI component registry, and dynamic plugin loading patterns.
metadata:
    version: "1.0"
---

# Shadow DOM & Web Components for Plugin System

## Product Summary

This project uses Shadow DOM to isolate plugin styles from the host application. Each plugin renders inside its own shadow root via `ShadowContainer`, which uses `attachShadow({ mode: 'open' })` + `createPortal()` to mount React components. Plugins are loaded dynamically at runtime, register components through a `HostAPI`, and have their CSS scoped automatically.

Key files:
- `src/plugins/types.ts` — Plugin and HostAPI interfaces
- `src/plugins/ShadowContainer.tsx` — Shadow DOM + React portal wrapper
- `src/plugins/PluginRenderer.tsx` — Loads plugin, renders in shadow
- `src/plugins/loader.ts` — Dynamic import with cache-busting
- `src/plugins/host.ts` — Component registry (HostAPI implementation)
- `src/plugins/usePlugin.ts` — React hook for plugin loading
- `plugins/*/plugin.tsx` — Individual plugin entry points

## When to Use

- Creating new plugins for the plugin system
- Debugging CSS leaking in/out of plugins
- Extending the HostAPI with new capabilities
- Working with React components inside Shadow DOM
- Troubleshooting plugin loading, lifecycle, or rendering issues
- Adding external stylesheets to shadow roots

## Quick Reference

### Shadow DOM Fundamentals

```typescript
// Attach shadow root (done by ShadowContainer)
const shadow = host.attachShadow({ mode: 'open' })

// Inject CSS into shadow (scoped automatically)
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = '/plugins/my-plugin/style.css'
shadow.appendChild(link)

// Mount point for React portal
const mountPoint = document.createElement('div')
shadow.appendChild(mountPoint)

// Render React into shadow
createPortal(<MyComponent />, mountPoint)
```

### Plugin Architecture Flow

```
1. PluginRenderer receives `src` URL
2. loader.ts dynamically imports the plugin module
3. Plugin.init(hostAPI) is called — plugin registers components
4. Plugin.mount() is called
5. PluginRenderer gets component via hostAPI.getComponent()
6. ShadowContainer creates shadow root + injects CSS
7. React portal renders component inside shadow
8. On unmount: Plugin.unmount() is called for cleanup
```

### Creating a Plugin

```
plugins/my-plugin/
├── plugin.tsx    ← Entry point
└── style.css     ← Scoped styles (BEM prefix)
```

```tsx
// plugins/my-plugin/plugin.tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import './style.css'

function MyComponent() {
  return (
    <div className="my-plugin">
      <h3 className="my-plugin__title">My Plugin</h3>
      <p className="my-plugin__desc">Content here</p>
    </div>
  )
}

const MyPlugin: Plugin = {
  name: 'MyPlugin',
  version: '1.0.0',
  styleUrls: ['/plugins/my-plugin/style.css'],

  init(host: HostAPI) {
    host.registerComponent('MyComponent', MyComponent)
    host.log('MyPlugin initialized')
  },
  mount() { console.log('[MyPlugin] mounted') },
  unmount() { console.log('[MyPlugin] unmounted') },
}

export default MyPlugin
```

### Using PluginRenderer

```tsx
<PluginRenderer
  src="/plugins/my-plugin/plugin.tsx"
  componentName="MyComponent"
  fallback={<span>Loading...</span>}
/>
```

### Using usePlugin Hook

```tsx
const { plugin, loading, error } = usePlugin('/plugins/my-plugin/plugin.tsx')
```

## Shadow DOM CSS Rules

### Scoping Behavior

- Styles inside shadow root do NOT leak to host
- Host styles do NOT penetrate shadow root
- Global selectors (`body`, `*`, `h1`) inside shadow only affect shadow content
- `:host` selector targets the shadow host element itself

### CSS Best Practices for Plugins

```css
/* ✅ BEM-prefixed classes */
.my-plugin { padding: 1rem; }
.my-plugin__title { font-size: 1.25rem; }
.my-plugin__btn { cursor: pointer; }
.my-plugin__btn--active { background: #4caf50; }

/* ✅ :host for shadow host styling */
:host { display: block; }

/* ❌ NEVER use global selectors */
/* body { } */
/* * { } */
/* h1 { } */

/* ❌ NEVER use inline styles in JSX — use classes */
```

### Injecting External CSS

```typescript
// Via styleUrls in Plugin definition
const plugin: Plugin = {
  styleUrls: ['/plugins/my-plugin/style.css'],
  // ...
}

// ShadowContainer resolves paths with import.meta.env.BASE_URL
// and adds cache-bust query: style.css?t=<timestamp>
```

### CSS That Does NOT Work in Shadow DOM

| Pattern | Issue | Solution |
|---------|-------|----------|
| Tailwind global classes | Not available inside shadow | Include Tailwind CSS in `styleUrls` or use plain CSS |
| `@import url()` in shadow CSS | May not resolve correctly | Use `<link>` injection via `styleUrls` |
| CSS custom properties (vars) | DO inherit into shadow | Use `var(--my-color)` — they penetrate shadow boundary |
| `::part()` selector | Requires `part` attribute on elements | Add `part="name"` to expose elements for external styling |

### CSS Custom Properties (Inherited)

CSS custom properties defined on the host DO penetrate shadow DOM:

```css
/* Host app (index.css) */
:root {
  --primary: #013011;
  --surface: #fbfaeb;
}

/* Plugin CSS (inside shadow) — these work */
.my-plugin__title {
  color: var(--primary);
  background: var(--surface);
}
```

## Decision Guidance

| Scenario | Approach |
|----------|----------|
| Plugin needs host theme colors | Use CSS custom properties (`var(--primary)`) |
| Plugin needs Tailwind | Include compiled Tailwind CSS in `styleUrls` |
| Plugin needs React context (e.g., wallet) | Wrap component in its own Provider inside plugin |
| Plugin needs to communicate with host | Use HostAPI methods only |
| Plugin needs shared state | Extend HostAPI (add methods to `src/plugins/types.ts`) |
| Plugin needs cleanup | Implement `unmount()` — clear intervals, unsubscribe, etc. |
| Multiple plugins on same page | Each gets its own shadow root — no conflicts |

## Common Gotchas

- `attachShadow()` can only be called ONCE per element — `ShadowContainer` uses a ref guard (`initializedRef`) to prevent double-attach in React Strict Mode.
- `createPortal()` into shadow mount point is the only way to render React inside shadow DOM while maintaining React's event system.
- Plugin CSS files must be actual files served by Vite — they're loaded via `<link>` tags, not bundled inline.
- `import './style.css'` in plugin.tsx is for Vite dev mode HMR. Production uses `styleUrls` for shadow injection.
- Event bubbling: events from shadow DOM do NOT bubble to React event handlers on the host. Use native `addEventListener` if needed.
- `document.querySelector()` cannot reach inside shadow roots — use `shadowRoot.querySelector()` instead.
- React refs work normally inside portaled shadow content.
- `mode: 'open'` means JavaScript can access `element.shadowRoot`. Use `'closed'` only if you need to hide internals (not recommended for this plugin system).

## Build Configuration

Plugins are built as separate Vite entry points:

```typescript
// vite.config.ts
rollupOptions: {
  input: {
    'plugins/my-plugin': resolve(__dirname, 'plugins/my-plugin/plugin.tsx'),
  },
  output: {
    // Predictable paths (no hash) for plugins
    entryFileNames(chunk) {
      if (chunk.name.startsWith('plugins/')) {
        return `assets/${chunk.name}.js`
      }
      return 'assets/[name]-[hash].js'
    },
  },
}
```

Plugin CSS is copied to `dist/` by the `copyPluginAssets` Vite plugin.

## Registering New Plugins

After creating a plugin:

1. Add entry point to `vite.config.ts` `rollupOptions.input`
2. Add to `AVAILABLE_PLUGINS` in `src/plugin-demo/PluginDemoApp.tsx`
3. Or use CLI: `node scripts/create-plugin.mjs <plugin-name>`

## Verification Checklist

- [ ] Plugin exports `default` as Plugin object with `name` and `init`
- [ ] Component name in `registerComponent()` is PascalCase and unique
- [ ] CSS uses BEM prefix matching plugin name (`.my-plugin__*`)
- [ ] No global CSS selectors in plugin stylesheet
- [ ] No inline styles in JSX — all styling via CSS classes
- [ ] `styleUrls` paths are correct (start with `/plugins/`)
- [ ] `unmount()` cleans up intervals, subscriptions, event listeners
- [ ] Plugin does NOT import from `src/` except `src/plugins/types`
- [ ] Vite config has entry point for the plugin
- [ ] Plugin works in both dev mode and production build
- [ ] No CSS leaking between plugins or to/from host
