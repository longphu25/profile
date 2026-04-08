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
2. Plugin KHÔNG import từ `src/` ngoại trừ `src/plugins/types`
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
- Mỗi plugin tạo `createDAppKit()` instance riêng — KHÔNG share giữa các plugin.
- `useCurrentClient()` trả về client đã configured cho network hiện tại, dùng `client.core.*` để query.

## Đăng ký plugin vào demo page

Sau khi tạo plugin, thêm vào `AVAILABLE_PLUGINS` trong `src/plugin-demo/PluginDemoApp.tsx`:

```typescript
const AVAILABLE_PLUGINS = [
  // ... existing plugins
  { name: 'MyPlugin', src: '/plugins/my-plugin/plugin.tsx' },
]
```

## CLI tạo plugin mới

Chạy script để scaffold:

```bash
node scripts/create-plugin.mjs <plugin-name>
```

Ví dụ: `node scripts/create-plugin.mjs token-swap` sẽ tạo `plugins/token-swap/` với template sẵn.
