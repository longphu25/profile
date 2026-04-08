---
inclusion: fileMatch
fileMatchPattern: "plugins/**"
---

# Plugin Development Guide

Khi tạo hoặc chỉnh sửa plugin, tuân thủ chính xác các quy tắc sau.

## Cấu trúc bắt buộc

Mỗi plugin nằm trong `plugins/<plugin-name>/` với tối thiểu 2 file:

```
plugins/<plugin-name>/
├── plugin.tsx    ← Entry point, export default Plugin object
└── style.css     ← CSS riêng, dùng prefix .<plugin-name>__*
```

## Type Contract

Import types từ `../../src/plugins/types`:

```typescript
import type { Plugin, HostAPI } from '../../src/plugins/types'
```

### HostAPI interface (host expose cho plugin)

```typescript
interface HostAPI {
  registerComponent: (name: string, component: ComponentType<unknown>) => void
  getComponent: (name: string) => ComponentType<unknown> | undefined
  log: (message: string) => void
}
```

### Plugin interface (plugin phải implement)

```typescript
interface Plugin {
  name: string           // PascalCase, unique
  version: string        // semver
  styleUrls?: string[]   // paths to CSS files for Shadow DOM scoping
  init: (host: HostAPI) => void   // BẮT BUỘC
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

## Quy tắc CSS

- Mỗi plugin có file `style.css` riêng
- Dùng BEM-like prefix: `.<plugin-name>__<element>` (ví dụ: `.sui-wallet__title`)
- KHÔNG dùng global selectors (`body`, `*`, `h1`)
- KHÔNG dùng inline styles — luôn dùng class từ style.css
- Plugin CSS được scope qua Shadow DOM khi render bởi host

## Quy tắc quan trọng

1. Plugin KHÔNG truy cập DOM trực tiếp — chỉ tương tác qua HostAPI
2. Plugin KHÔNG import từ `src/` ngoại trừ `src/plugins/types` và `src/sui-dashboard/sui-types`
3. Component name trong `registerComponent()` phải PascalCase và unique
4. `export default` phải là Plugin object
5. File phải là `.tsx` (không phải `.ts`) nếu có JSX
6. Nếu plugin cần context riêng (ví dụ: DAppKitProvider), wrap trong component
7. Cleanup resources trong `unmount()` — unsubscribe, clear intervals, etc.

## Sử dụng DAppKitProvider (Sui wallet plugins)

Khi plugin cần kết nối Sui wallet, tuân thủ chính xác các quy tắc sau để tránh lỗi TypeScript:

### 1. Networks phải khai báo ĐẦY ĐỦ 3 network

`DAppKitProvider` expect type `DAppKit<('devnet' | 'testnet' | 'mainnet')[]>`. Nếu thiếu bất kỳ network nào sẽ gây lỗi TS2322.

```typescript
// ❌ SAI — thiếu devnet → TS2322 tại <DAppKitProvider dAppKit={dAppKit}>
const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet'],
  ...
})

// ✅ ĐÚNG — luôn khai báo đủ 3 network
const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})
```

### 2. switchNetwork phải cast type

`switchNetwork()` expect union type literal, không nhận `string`. Phải cast khi dùng với `<select>` onChange:

```typescript
// ❌ SAI — TS2345: string not assignable to 'devnet' | 'testnet' | 'mainnet'
const handleNetworkChange = (newNetwork: string) => {
  dAppKitInstance.switchNetwork(newNetwork)
}

// ✅ ĐÚNG — cast sang union type
const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const

const handleNetworkChange = (newNetwork: string) => {
  dAppKitInstance.switchNetwork(newNetwork as typeof NETWORKS[number])
}
```

### 3. GRPC_URLS phải có entry cho tất cả networks

```typescript
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}
```

### 4. Template cho Sui wallet plugin

```tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentClient,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { useState, useEffect } from 'react'
import './style.css'

const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

function PluginContent() {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const dAppKitInstance = useDAppKit()

  const handleNetworkChange = (newNetwork: string) => {
    dAppKitInstance.switchNetwork(newNetwork as typeof NETWORKS[number])
  }

  // ... plugin logic
}

function PluginComponent() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <PluginContent />
    </DAppKitProvider>
  )
}
```

### 5. Lưu ý quan trọng

- `ConnectButton` KHÔNG tồn tại trong `@mysten/dapp-kit-react` — đó là web component từ `@mysten/dapp-kit-core/web`. Phải tự tạo UI connect wallet bằng `useWallets()` + `dAppKit.connectWallet({ wallet })`.
- Mỗi plugin tạo `createDAppKit()` instance riêng — KHÔNG share giữa các plugin (trừ khi dùng dual-mode, xem bên dưới).
- `useCurrentClient()` trả về client đã configured cho network hiện tại, dùng `client.core.*` để query.

### 6. KHÔNG dùng lazy init cho createDAppKit — TS2322

`DAppKitProvider` expect exact generic type từ `createDAppKit()`. Nếu dùng lazy init pattern (`let dAppKit = null`), TypeScript mất type inference và gây TS2322.

```typescript
// ❌ SAI — lazy init mất type → TS2322 tại <DAppKitProvider dAppKit={...}>
let standaloneDAppKit: ReturnType<typeof createDAppKit> | null = null
function getStandaloneDAppKit() {
  if (!standaloneDAppKit) {
    standaloneDAppKit = createDAppKit({ ... })
  }
  return standaloneDAppKit
}

// ✅ ĐÚNG — tạo instance ngay + declare module
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

Lý do: `DAppKitProvider` dùng generic type `DAppKit<('devnet' | 'testnet' | 'mainnet')[], SuiGrpcClient>`. Khi assign `null` vào biến, TypeScript widen type thành `DAppKit<Networks, ClientWithCoreApi> | null` — không match với expected type. `declare module` augmentation giúp TypeScript biết exact type của dAppKit instance.

## Dual-Mode Plugin Pattern (plugin-demo + sui-dashboard)

SUI plugins cần hoạt động trên cả 2 trang:
- `plugin-demo.html` — nhận `HostAPI` thường, plugin tự tạo DAppKitProvider riêng
- `sui-plugin.html` — nhận `SuiHostAPI` (extends HostAPI), dashboard đã có DAppKitProvider shared

### Cách implement

1. Import type guard `isSuiHostAPI` từ `src/sui-dashboard/sui-types`
2. Tách content component (logic + UI) ra riêng
3. Tạo 2 wrapper: `Standalone` (có DAppKitProvider) và `Shared` (không có)
4. Trong `init()`, detect mode và register wrapper phù hợp

```tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { DAppKitProvider } from '@mysten/dapp-kit-react'

// Content component — dùng dApp-kit hooks bình thường
function PluginContent() {
  const account = useCurrentAccount()
  // ... plugin logic (KHÔNG thay đổi giữa 2 mode)
}

// Standalone: plugin-demo (tự tạo DAppKitProvider)
function PluginStandalone() {
  return (
    <DAppKitProvider dAppKit={standaloneDAppKit}>
      <PluginContent />
    </DAppKitProvider>
  )
}

// Shared: sui-dashboard (DAppKitProvider đã có từ dashboard)
function PluginShared() {
  return <PluginContent />
}

const MyPlugin: Plugin = {
  name: 'MyPlugin',
  version: '1.0.0',

  init(host: HostAPI) {
    const Component = isSuiHostAPI(host) ? PluginShared : PluginStandalone
    host.registerComponent('MyPlugin', Component)
  },
}
```

### SuiHostAPI — API mở rộng cho sui-dashboard

Khi `isSuiHostAPI(host)` trả về `true`, plugin có thể dùng thêm:

```typescript
// Đọc shared wallet context
const ctx = host.getSuiContext()
// → { address: string | null, network: string, isConnected: boolean }

// Subscribe thay đổi context (wallet connect/disconnect, network switch)
const unsub = host.onSuiContextChange((ctx) => { ... })

// Chia sẻ data giữa các plugin
host.setSharedData('balances', balanceData)
const data = host.getSharedData('balances')
const unsub = host.onSharedDataChange('balances', (value) => { ... })

// Yêu cầu dashboard connect/disconnect/switch network
host.requestConnect()
host.requestDisconnect()
host.requestNetworkSwitch('testnet')
```

### Lưu ý dual-mode

- Content component dùng dApp-kit hooks (`useCurrentAccount`, `useCurrentClient`, etc.) — hoạt động ở cả 2 mode vì luôn có DAppKitProvider bọc bên ngoài
- Plugin không cần DAppKit hooks (ví dụ: hello-world-sui dùng raw SuiGrpcClient) có thể dùng `sharedHost` reference để auto-fill data từ shared context
- Mỗi plugin file cần `declare module '@mysten/dapp-kit-react'` riêng cho standalone instance — không conflict vì chúng là separate build entry points

## Đăng ký plugin

### Plugin Demo page

Thêm vào `AVAILABLE_PLUGINS` trong `src/plugin-demo/PluginDemoApp.tsx`:

```typescript
const AVAILABLE_PLUGINS = [
  // ... existing plugins
  { name: 'MyPlugin', src: '/plugins/my-plugin/plugin.tsx' },
]
```

### SUI Dashboard page

Thêm vào `SUI_PLUGINS` trong `src/sui-dashboard/SuiDashboard.tsx`:

```typescript
const SUI_PLUGINS = [
  // ... existing plugins
  {
    id: 'my-plugin',
    name: 'MyPlugin',
    label: 'My Plugin',
    desc: 'Short description',
    src: pluginPath('my-plugin'),
    icon: '🔌',
  },
]
```

### Vite build config

Thêm entry point trong `vite.config.ts` → `build.rollupOptions.input`:

```typescript
'plugins/my-plugin': resolve(__dirname, 'plugins/my-plugin/plugin.tsx'),
```

## CLI tạo plugin mới

Chạy script để scaffold:

```bash
node scripts/create-plugin.mjs <plugin-name>
```

Ví dụ: `node scripts/create-plugin.mjs token-swap` sẽ tạo `plugins/token-swap/` với template sẵn.
