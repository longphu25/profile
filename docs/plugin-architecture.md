# Type-Safe, Lazy, and Secure Plugin Architecture in React

> Ghi chú kỹ thuật dựa trên bài viết [freeCodeCamp](https://www.freecodecamp.org/news/how-to-design-a-type-safe-lazy-and-secure-plugin-architecture-in-react/) — kết hợp mô phỏng technical từ codebase thực tế.

---

## 1. Tổng quan kiến trúc

Plugin architecture cho phép ứng dụng load các module bên ngoài để mở rộng chức năng tại runtime, thay vì nhúng mọi feature trực tiếp vào core app.

### Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                    HOST APPLICATION                      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Host API   │  │   Loader     │  │   Registry    │ │
│  │  (types.ts)  │  │ (loader.ts)  │  │  (host.ts)    │ │
│  │              │  │              │  │               │ │
│  │ • register   │  │ • import()   │  │ • components  │ │
│  │ • getComp    │  │ • validate   │  │ • get/set     │ │
│  │ • log        │  │ • cache-bust │  │ • unregister  │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
│         └────────┬────────┘                   │         │
│                  │                            │         │
│         ┌────────▼────────────────────────────▼───┐     │
│         │          Plugin Demo Page                │     │
│         │   (PluginDemoApp.tsx / PluginRenderer)   │     │
│         └────────────────┬────────────────────────┘     │
└──────────────────────────┼──────────────────────────────┘
                           │ dynamic import()
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
   │ HelloPlugin │ │ HelloSui    │ │  SuiWallet   │
   │             │ │             │ │              │
   │ plugin.tsx  │ │ plugin.tsx  │ │ plugin.tsx   │
   │ style.css   │ │ style.css   │ │ style.css    │
   └─────────────┘ └─────────────┘ └──────────────┘
        plugins/         plugins/        plugins/
```

### Cấu trúc thư mục thực tế

```
src/
├── plugins/
│   ├── types.ts              ← Type contracts (HostAPI + Plugin)
│   ├── host.ts               ← Host API implementation + component registry
│   ├── loader.ts             ← Dynamic plugin loader (lazy-load + cache-bust)
│   ├── PluginRenderer.tsx    ← React component tự động load + render plugin
│   ├── usePlugin.ts          ← Hook tiện lợi cho loading plugin
│   └── index.ts              ← Barrel export
├── plugin-demo/
│   ├── main.tsx              ← Entry point cho /plugin-demo.html
│   ├── PluginDemoApp.tsx     ← Trang demo load/unload plugins
│   └── plugin-demo.css
plugins/                       ← Plugins nằm NGOÀI src/ (độc lập)
├── hello-plugin/
│   ├── plugin.tsx
│   └── style.css
├── hello-world-sui/
│   ├── plugin.tsx
│   └── style.css
└── sui-wallet/
    ├── plugin.tsx
    └── style.css
```

---

## 2. Host API — Hợp đồng giữa Host và Plugin

Host API là interface duy nhất mà plugin được phép tương tác. Plugin KHÔNG truy cập trực tiếp state hay DOM của host app.

### Type Contract

```typescript
// src/plugins/types.ts

import type { ComponentType } from 'react'

/** API mà host expose cho plugin */
export interface HostAPI {
  registerComponent: (name: string, component: ComponentType<unknown>) => void
  getComponent: (name: string) => ComponentType<unknown> | undefined
  log: (message: string) => void
}

/** Lifecycle interface — mọi plugin phải implement */
export interface Plugin {
  name: string
  version: string
  init: (host: HostAPI) => void      // Bắt buộc — nhận HostAPI
  mount?: () => void                  // Khi UI hiển thị
  update?: () => void                 // Khi re-render
  unmount?: () => void                // Khi bị gỡ — cleanup
}
```

### Implementation

```typescript
// src/plugins/host.ts

const componentRegistry: Record<string, ComponentType<unknown>> = {}

export const hostAPI: HostAPI = {
  registerComponent(name, component) {
    componentRegistry[name] = component
  },
  getComponent(name) {
    return componentRegistry[name]
  },
  log(message) {
    console.log(`[Plugin LOG]: ${message}`)
  },
}

// Hỗ trợ unload plugin
export function unregisterComponent(name: string): void {
  delete componentRegistry[name]
}
```

### Luồng hoạt động

```
Plugin được load
    │
    ▼
init(hostAPI) được gọi
    │
    ▼
Plugin gọi hostAPI.registerComponent('MyComp', MyComponent)
    │
    ▼
Component được lưu vào componentRegistry
    │
    ▼
Host gọi hostAPI.getComponent('MyComp') để render
    │
    ▼
mount() được gọi khi UI hiển thị
    │
    ▼
unmount() được gọi khi plugin bị gỡ
    │
    ▼
unregisterComponent('MyComp') xóa khỏi registry
```

---

## 3. Plugin Lifecycle — Vòng đời của Plugin

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐
│  LOAD   │────▶│  INIT   │────▶│  MOUNT  │────▶│  UPDATE  │
│         │     │         │     │         │     │ (repeat)  │
└─────────┘     └─────────┘     └─────────┘     └────┬─────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │ UNMOUNT  │
                                                │ (cleanup)│
                                                └──────────┘
```

| Phase   | Khi nào                        | Làm gì                                    |
|---------|--------------------------------|-------------------------------------------|
| load    | `import()` dynamic             | Fetch module từ URL                       |
| init    | Ngay sau load                  | Nhận HostAPI, register components         |
| mount   | Component hiển thị trên UI     | Setup subscriptions, event listeners      |
| update  | Props/state thay đổi           | Re-render (optional)                      |
| unmount | Plugin bị gỡ                   | Cleanup: unsubscribe, remove listeners    |

### Ví dụ thực tế — HelloPlugin

```typescript
// plugins/hello-plugin/plugin.tsx

const HelloPlugin: Plugin = {
  name: 'HelloPlugin',
  version: '1.0.0',

  init(host: HostAPI) {
    // Register component qua Host API — KHÔNG truy cập DOM trực tiếp
    host.registerComponent('Hello', () => (
      <div className="hello-plugin">
        <h3>👋 Hello from Plugin!</h3>
      </div>
    ))
    host.log('HelloPlugin initialized successfully')
  },

  mount() {
    console.log('[HelloPlugin] mounted')
  },

  unmount() {
    console.log('[HelloPlugin] unmounted — resources cleaned up')
  },
}

export default HelloPlugin
```

---

## 4. Lazy Loading — Dynamic Import

Plugin được load on-demand bằng `import()`, không bundle chung với host app.

### Loader Implementation

```typescript
// src/plugins/loader.ts

export async function loadPlugin(url: string): Promise<Plugin> {
  // Cache-bust: thêm timestamp để browser không cache module cũ
  // Giải quyết vấn đề: unload → load lại → import() trả module cached → init() không chạy
  const bustUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

  const module = await import(/* @vite-ignore */ bustUrl)
  const plugin = module.default as Plugin

  // Validate plugin structure
  if (!plugin.name || !plugin.init) {
    throw new Error(`Invalid plugin at ${url}: missing 'name' or 'init'`)
  }

  plugin.init(hostAPI)
  return plugin
}
```

### Vấn đề Cache và cách giải quyết

```
Lần 1: import('/plugins/hello.tsx')  → Browser fetch + execute → init() ✅
Lần 2: import('/plugins/hello.tsx')  → Browser trả cached module → init() KHÔNG chạy ❌

Fix: import('/plugins/hello.tsx?t=1720000001')  → URL khác → force re-fetch ✅
```

### Sử dụng trong React — 2 cách

```typescript
// Cách 1: usePlugin hook
function MyPage() {
  const { plugin, loading, error } = usePlugin('/plugins/hello-plugin/plugin.tsx')
  const Hello = hostAPI.getComponent('Hello')

  if (loading) return <span>Loading...</span>
  if (error) return <span>Error: {error}</span>
  return Hello ? <Hello /> : null
}

// Cách 2: PluginRenderer component (declarative)
<PluginRenderer
  src="/plugins/hello-plugin/plugin.tsx"
  componentName="Hello"
  fallback={<span>Đang tải...</span>}
/>
```

---

## 5. Security & Permission Model

### Nguyên tắc

```
┌──────────────────────────────────────────────┐
│              HOST APPLICATION                 │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │            Host API (Firewall)          │ │
│  │                                         │ │
│  │  ✅ registerComponent()                 │ │
│  │  ✅ getComponent()                      │ │
│  │  ✅ log()                               │ │
│  │                                         │ │
│  │  ❌ Direct DOM access                   │ │
│  │  ❌ Global state mutation               │ │
│  │  ❌ localStorage/cookies (trực tiếp)    │ │
│  │  ❌ Network requests (không qua API)    │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Các cấp độ isolation

| Cấp độ        | Cách thực hiện                    | Trade-off                          |
|---------------|-----------------------------------|------------------------------------|
| API boundary  | HostAPI interface                 | Nhẹ, nhưng plugin vẫn chạy cùng thread |
| Shadow DOM    | ShadowContainer cho CSS isolation | CSS scoped, nhưng JS vẫn shared    |
| iframe        | `<iframe sandbox="allow-scripts">`| Isolation mạnh, nhưng communication phức tạp |
| Web Worker    | Plugin chạy trong Worker          | Isolation tối đa, không truy cập DOM |

### Mở rộng HostAPI cho permission

```typescript
// Ví dụ: Restricted API cho third-party plugins
export interface SecureHostAPI {
  log: (message: string) => void
  registerComponent: (name: string, component: ComponentType) => void
  // Chỉ expose fetchData nếu plugin có permission
  fetchData?: (endpoint: string) => Promise<unknown>
}
```

---

## 6. Plugin Demo Page — Load/Unload Runtime

### Luồng Load Plugin

```
User click "Load"
    │
    ▼
handleLoad(src, name)
    │
    ├── Ghi nhận beforeComponents (snapshot registry)
    │
    ├── loadPlugin(src)
    │   ├── import(url + cache-bust)
    │   ├── Validate plugin.name && plugin.init
    │   └── plugin.init(hostAPI)  →  registerComponent()
    │
    ├── Ghi nhận afterComponents
    │   └── newComponents = after - before
    │
    ├── plugin.mount()
    │
    └── setLoaded([...prev, { plugin, componentNames }])
            │
            ▼
        React re-render → hostAPI.getComponent(name) → <Component />
```

### Luồng Unload Plugin

```
User click "Unload"
    │
    ▼
handleUnload(name)
    │
    ├── plugin.unmount()           ← Cleanup resources
    │
    ├── unregisterComponent(name)  ← Xóa khỏi registry
    │
    └── setLoaded(prev.filter(...))
            │
            ▼
        React re-render → Component biến mất
```

---

## 7. Bundle Plugin Riêng Biệt (Production)

Mỗi plugin được build thành bundle độc lập, deploy riêng:

```typescript
// plugins/hello-plugin/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'plugin.tsx',
      name: 'HelloPlugin',
      fileName: 'hello-plugin',
      formats: ['es'],
    },
    rollupOptions: {
      // Plugin dùng React của host, không bundle riêng
      external: ['react', 'react-dom'],
    },
  },
})
```

### Deployment flow

```
Plugin repo          Build              CDN/Registry
┌──────────┐    ┌──────────────┐    ┌──────────────────┐
│ plugin/  │───▶│ vite build   │───▶│ /plugins/v1.0.0/ │
│ src/     │    │ → ES module  │    │   hello-plugin.js│
│ style/   │    │ → CSS        │    │   style.css      │
└──────────┘    └──────────────┘    └──────────────────┘
                                            │
                                            ▼
                                    Host app import()
```

---

## 8. Hot-Loading (Development)

```typescript
// Vite HMR cho plugin development
if (import.meta.hot) {
  import.meta.hot.accept('/plugins/my-plugin.js', (newModule) => {
    const updatedPlugin = newModule.default as Plugin
    updatedPlugin.init(hostAPI)
    setPlugin(updatedPlugin)
  })
}
```

---

## 9. Ví dụ thực tế — SUI Wallet Plugin

Plugin phức tạp nhất trong project, demo đầy đủ lifecycle:

```
SuiWalletPlugin
│
├── init(host)
│   └── host.registerComponent('SuiWallet', SuiWalletComponent)
│
├── SuiWalletComponent
│   └── <DAppKitProvider>        ← Plugin tự quản lý context riêng
│       └── <WalletContent>
│           ├── useWallets()     ← Detect installed wallets
│           ├── useWalletConnection()
│           ├── useCurrentAccount()
│           ├── useCurrentClient()
│           │
│           ├── [Not Connected]
│           │   ├── Network selector (mainnet/testnet/devnet)
│           │   └── Wallet list → connectWallet()
│           │
│           └── [Connected]
│               ├── Address display
│               ├── client.core.listBalances() → Token list
│               └── SuiScan API → 5 recent transactions
│                   ├── 🔗 SuiScan link
│                   └── 🔗 SuiVision link
│
├── mount()  → console.log
└── unmount() → console.log (DAppKit tự cleanup)
```

### Điểm đáng chú ý

1. Plugin tự tạo `createDAppKit()` instance — không phụ thuộc host
2. Plugin wrap component trong `<DAppKitProvider>` — tự quản lý state
3. CSS riêng biệt (`style.css`) với prefix `sui-wallet__*` tránh xung đột
4. Network switching qua `dAppKit.switchNetwork()` — client tự cập nhật

### ⚠️ Gotchas với DAppKitProvider

Các lỗi TypeScript thường gặp khi dùng `@mysten/dapp-kit-react` trong plugin:

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| TS2322 tại `<DAppKitProvider dAppKit={...}>` | `createDAppKit` thiếu network trong array (ví dụ thiếu `devnet`) | Luôn khai báo đủ `['mainnet', 'testnet', 'devnet']` |
| TS2345 tại `switchNetwork(newNetwork)` | `newNetwork` là `string`, nhưng expect union literal | Cast: `newNetwork as typeof NETWORKS[number]` |
| Runtime: `ConnectButton` not found | `ConnectButton` là web component, không export từ React package | Tự tạo UI bằng `useWallets()` + `connectWallet()` |

```typescript
// ❌ Thiếu devnet → TS2322
createDAppKit({ networks: ['mainnet', 'testnet'], ... })

// ✅ Đủ 3 network
createDAppKit({ networks: ['mainnet', 'testnet', 'devnet'], ... })

// ❌ string → TS2345
dAppKit.switchNetwork(e.target.value)

// ✅ Cast type
const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const
dAppKit.switchNetwork(e.target.value as typeof NETWORKS[number])
```

---

## 10. Best Practices

| Practice              | Lý do                                                    |
|-----------------------|----------------------------------------------------------|
| TypeScript interfaces | Catch lỗi compile-time, không phải runtime               |
| Lazy loading          | Chỉ load plugin khi cần, giảm initial bundle             |
| Minimal API surface   | Plugin chỉ truy cập những gì được phép                   |
| Isolated state        | Mỗi plugin quản lý state riêng, không ảnh hưởng nhau     |
| CSS prefix/scoping    | Tránh style xung đột giữa plugins                        |
| Cache-bust on reload  | Đảm bảo `import()` luôn re-execute khi load lại          |
| Versioning            | Plugin có version, host kiểm tra compatibility            |
| Validate on load      | Check `name` + `init` trước khi chạy plugin               |

---

## 11. Khi nào KHÔNG nên dùng Plugin Architecture

| Trường hợp                    | Lý do                                              |
|-------------------------------|-----------------------------------------------------|
| App nhỏ, 1 team               | Overhead không đáng, modular structure đủ rồi       |
| Feature tightly coupled       | Plugin cần deep access vào state → abstraction thừa |
| Performance-critical           | Dynamic import thêm latency                         |
| Chưa rõ boundary              | Thiết kế plugin quá sớm → phải refactor liên tục   |

---

## 12. Hướng mở rộng

```
Hiện tại                          Tương lai
─────────                         ────────
HostAPI cố định          →   Dynamic permissions (plugin request capabilities)
Manual plugin list       →   Plugin marketplace / registry
CSS prefix isolation     →   Shadow DOM / iframe sandboxing
Console.log              →   Event bus (plugin-to-plugin communication)
No versioning check      →   Semver compatibility validation
No signature             →   Plugin signing + hash verification
```

---

*Tài liệu này tổng hợp từ bài viết gốc trên freeCodeCamp, được diễn giải lại và bổ sung mô phỏng technical dựa trên implementation thực tế trong project.*
