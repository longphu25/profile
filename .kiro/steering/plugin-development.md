---
inclusion: fileMatch
fileMatchPattern: "plugins/**"
---

# Plugin Development Guide

When creating or editing plugins, follow these rules exactly.

## Required Structure

Each plugin lives in `plugins/<plugin-name>/` with at minimum 2 files:

```
plugins/<plugin-name>/
├── plugin.tsx    ← Entry point, export default Plugin object
└── style.css     ← Scoped CSS, prefix .<plugin-name>__*
```

## Type Contract

Import types from `../../src/plugins/types`:

```typescript
import type { Plugin, HostAPI } from '../../src/plugins/types'
```

### HostAPI interface (host exposes to plugin)

```typescript
interface HostAPI {
  registerComponent: (name: string, component: ComponentType<unknown>) => void
  getComponent: (name: string) => ComponentType<unknown> | undefined
  log: (message: string) => void
}
```

### Plugin interface (plugin must implement)

```typescript
interface Plugin {
  name: string           // PascalCase, unique
  version: string        // semver
  styleUrls?: string[]   // paths to CSS files for Shadow DOM scoping
  init: (host: HostAPI) => void   // REQUIRED
  mount?: () => void
  update?: () => void
  unmount?: () => void
}
```

## Template plugin.tsx

```tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import './style.css'

function MyComponent() {
  return (
    <div className="my-plugin">
      <h3 className="my-plugin__title">My Plugin</h3>
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

  mount() {
    console.log('[MyPlugin] mounted')
  },

  unmount() {
    console.log('[MyPlugin] unmounted')
  },
}

export default MyPlugin
```

## CSS Rules

- Each plugin has its own `style.css`
- Use BEM-like prefix: `.<plugin-name>__<element>` (e.g. `.sui-wallet__title`)
- NO global selectors (`body`, `*`, `h1`)
- NO inline styles — always use classes from style.css
- Plugin CSS is scoped via Shadow DOM when rendered by host

## Important Rules

1. Plugin MUST NOT access DOM directly — only interact via HostAPI
2. Plugin MUST NOT import from `src/` except `src/plugins/types` and `src/sui-dashboard/sui-types`
3. Component name in `registerComponent()` must be PascalCase and unique
4. `export default` must be the Plugin object
5. File must be `.tsx` (not `.ts`) if it contains JSX
6. If plugin needs its own context (e.g. DAppKitProvider), wrap in component
7. Cleanup resources in `unmount()` — unsubscribe, clear intervals, etc.

## DAppKitProvider Usage (Sui wallet plugins)

When a plugin needs Sui wallet connection, follow these rules to avoid TypeScript errors:

### 1. Networks must declare ALL 3

`DAppKitProvider` expects type `DAppKit<('devnet' | 'testnet' | 'mainnet')[]>`. Missing any network causes TS2322.

```typescript
// ✅ CORRECT — always declare all 3 networks
const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})
```

### 2. switchNetwork requires type cast

```typescript
const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const
dAppKitInstance.switchNetwork(newNetwork as typeof NETWORKS[number])
```

### 3. GRPC_URLS must have entries for all networks

```typescript
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}
```

### 4. NO lazy init for createDAppKit — causes TS2322

```typescript
// ✅ CORRECT — create instance immediately + declare module
const standaloneDAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof standaloneDAppKit
  }
}
```

### 5. Important notes

- `ConnectButton` does NOT exist in `@mysten/dapp-kit-react` — it's a web component from `@mysten/dapp-kit-core/web`. Build your own connect UI using `useWallets()` + `dAppKit.connectWallet({ wallet })`.
- Each plugin creates its own `createDAppKit()` instance — do NOT share between plugins (unless using dual-mode).

## Dual-Mode Plugin Pattern (plugin-demo + sui-dashboard)

SUI plugins must work on both pages:
- `plugin-demo.html` — receives normal `HostAPI`, plugin creates its own DAppKitProvider
- `sui-plugin.html` — receives `SuiHostAPI` (extends HostAPI), dashboard already has shared DAppKitProvider

### Implementation

1. Import type guard `isSuiHostAPI` from `src/sui-dashboard/sui-types`
2. Separate content component (logic + UI)
3. Create 2 wrappers: `Standalone` (with DAppKitProvider) and `Shared` (without)
4. In `init()`, detect mode and register appropriate wrapper

```tsx
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'

function PluginContent() { /* uses dApp-kit hooks */ }

function PluginStandalone() {
  return <DAppKitProvider dAppKit={standaloneDAppKit}><PluginContent /></DAppKitProvider>
}

function PluginShared() {
  return <PluginContent />
}

const MyPlugin: Plugin = {
  init(host: HostAPI) {
    const Component = isSuiHostAPI(host) ? PluginShared : PluginStandalone
    host.registerComponent('MyPlugin', Component)
  },
}
```

### SuiHostAPI — Extended API for sui-dashboard

When `isSuiHostAPI(host)` returns `true`, plugin can also use:

```typescript
host.getSuiContext()          // { address, network, isConnected }
host.onSuiContextChange(cb)  // subscribe to wallet/network changes
host.setSharedData(key, val) // share data between plugins
host.getSharedData(key)
host.onSharedDataChange(key, cb)
host.requestConnect()
host.requestDisconnect()
host.requestNetworkSwitch('testnet')
host.signAndExecuteTransaction(tx)
```

## Plugin Registration

### Plugin Demo page
Add to `AVAILABLE_PLUGINS` in `src/plugin-demo/PluginDemoApp.tsx`

### SUI Dashboard page
Add to `SUI_PLUGINS` in `src/sui-dashboard/SuiDashboard.tsx`

### Vite build config
Add entry point in `vite.config.ts` → `build.rollupOptions.input`

## Advanced Plugin Architecture (Multi-Adapter / Multi-Source)

For plugins that integrate multiple external sources (e.g., swap with 5 DEXes), follow this extended structure:

### Required Directory Layout

```
plugins/<name>/
├── plugin.tsx              # THIN entry — only wires host API + top-level component
├── style.css               # All scoped styles (BEM: .<name>__<element>)
├── components/             # UI layer (SRP per component)
│   ├── index.ts            # Barrel export
│   ├── <Component>.tsx     # Each file = 1 responsibility
│   └── ...
├── hooks/                  # React hooks (state + side effects)
│   ├── index.ts            # Barrel export
│   └── use<Feature>.ts    # Named by what it does
└── lib/                    # Pure logic layer (no React)
    ├── index.ts            # Barrel export (public API only)
    ├── types.ts            # ALL interfaces + type definitions
    ├── utils.ts            # Pure utility functions (formatters, timeout, cache)
    ├── <adapter>.ts        # One file per external source (Strategy pattern)
    └── router.ts           # Orchestrator (coordinates adapters)
```

### SOLID Checklist for Plugins

- [ ] **SRP:** `plugin.tsx` < 50 lines of wiring logic. Real logic lives in lib/.
- [ ] **OCP:** Adding a new adapter = 1 new file + `.register()` call. No edits to existing files.
- [ ] **LSP:** All adapters implement same `DexAdapter` (or equivalent) interface.
- [ ] **ISP:** Types file exports small focused interfaces, not monolithic ones.
- [ ] **DIP:** Hooks/router depend on interface, never import concrete adapter for logic.

### Adapter (Strategy) Pattern Template

```typescript
// lib/types.ts
export interface DataAdapter {
  readonly id: string
  readonly label: string
  readonly timeout: number
  supports(params: Params): boolean
  fetch(params: Params): Promise<Result>
}

// lib/<source>.ts
export class MySourceAdapter implements DataAdapter {
  readonly id = 'my-source'
  readonly label = 'My Source'
  readonly timeout = 3000
  supports(params) { return true }
  async fetch(params) { /* ... */ }
}

// lib/router.ts — Open/Closed orchestrator
export class Router {
  private adapters: DataAdapter[] = []
  register(adapter: DataAdapter): this { this.adapters.push(adapter); return this }
  async fetchAll(params: Params): Promise<Result[]> { /* parallel + timeout */ }
}
```

### Performance Patterns (Required for multi-source plugins)

1. **Parallel fetch:** Always `Promise.allSettled` — never sequential.
2. **Per-adapter timeout:** `withTimeout(adapter.fetch(p), adapter.timeout)`
3. **Debounce input:** 300ms minimum before triggering fetches.
4. **Cache with TTL:** 5s default. Key = `${adapter.id}:${inputHash}`.
5. **Streaming render:** Show results as they arrive, sort incrementally.
6. **Pre-warm:** Ping endpoints on mount to warm TCP/TLS connections.

### Code Quality for Plugins

- All public interfaces/functions have JSDoc.
- Adapter properties marked `readonly`.
- No `any` types — use `unknown` + type narrowing.
- Barrel exports ONLY re-export public API — internals stay private.
- No circular imports. Dependency flow: `types → utils → adapters → router → hooks → components → plugin`.
