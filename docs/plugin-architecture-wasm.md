# WASM Plugin Architecture — Technical Reference

> Mở rộng từ [plugin-architecture.md](./plugin-architecture.md). Tài liệu này mô tả cách tích hợp WASM và WASM-grade crypto vào plugin system hiện tại.

---

## 1. Nguyên tắc kiến trúc

WASM không thay thế plugin system — nó **chạy bên trong** plugin TS/ESM hiện tại.

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST APPLICATION                          │
│                                                             │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │   Host API   │  │  WASM Loader   │  │   Registry     │  │
│  │  (types.ts)  │  │(wasm-loader.ts)│  │  (host.ts)     │  │
│  │              │  │                │  │                │  │
│  │ • register   │  │ • import()     │  │ • components   │  │
│  │ • getComp    │  │ • detectWasm() │  │ • get/set      │  │
│  │ • log        │  │ • meta attach  │  │ • unregister   │  │
│  └──────┬───────┘  └──────┬─────────┘  └───────┬────────┘  │
│         │                 │                     │           │
│         └────────┬────────┘                     │           │
│                  │                              │           │
│    ┌─────────────▼──────────────────────────────▼────┐      │
│    │         SuiWasmDashboard.tsx                     │      │
│    │   (WASM badge, load time, architecture info)    │      │
│    └─────────────────────┬───────────────────────────┘      │
└──────────────────────────┼──────────────────────────────────┘
                           │ dynamic import()
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────▼──────┐    │    ┌───────▼────────┐
    │ sui-create-     │    │    │ sui-lending    │
    │ wallet          │    │    │ (standard ESM) │
    │                 │    │    └────────────────┘
    │ plugin.tsx ─────┤    │
    │   │             │    │
    │   ├─ @noble/    │    │
    │   │  curves     │◄───┤ WASM-grade crypto
    │   │  secp256k1  │    │ (audited, pure JS,
    │   │             │    │  same perf as WASM)
    │   ├─ @noble/    │    │
    │   │  hashes     │    │
    │   │  blake2b    │    │
    │   │             │    │
    │   ├─ @scure/    │    │
    │   │  bip39      │    │
    │   │             │    │
    │   └─ @scure/    │    │
    │      bip32      │    │
    │                 │    │
    │ style.css       │    │
    └─────────────────┘    │
                           │
              ┌────────────▼────────────┐
              │  Future: native .wasm   │
              │  (Rust → wasm-bindgen)  │
              │                         │
              │  fetch() + instantiate  │
              │  hoặc vite-plugin-wasm  │
              └─────────────────────────┘
```

### Quy tắc cốt lõi

1. **Plugin entry luôn là TS/ESM** — loader `import()` file `.tsx`, không phải `.wasm`
2. **WASM không truy cập DOM** — mọi tương tác browser đi qua JS wrapper
3. **WASM không truy cập Wallet API** — `window.suiWallet`, DAppKit hooks chỉ chạy trong JS
4. **Loader không cần biết về WASM** — plugin tự quản lý init/load WASM bên trong

---

## 2. Cấu trúc thư mục

```
src/
├── sui-wasm/
│   ├── main.tsx                ← Entry point cho /sui-plugin-wasm.html
│   ├── SuiWasmDashboard.tsx    ← Dashboard UI (WASM badges, metrics)
│   ├── wasm-loader.ts          ← WASM-aware plugin loader
│   └── sui-wasm.css            ← Dark theme CSS
├── plugins/
│   ├── types.ts                ← Plugin + HostAPI interfaces (không đổi)
│   ├── host.ts                 ← Component registry (không đổi)
│   ├── loader.ts               ← Base loader (không đổi)
│   └── ShadowContainer.tsx     ← Shadow DOM isolation (không đổi)

plugins/
├── sui-create-wallet/          ← WASM-grade crypto plugin
│   ├── plugin.tsx              ← ESM wrapper + @noble/curves crypto
│   └── style.css
├── sui-lending/                ← Standard ESM plugin (API fetch)
│   ├── plugin.tsx
│   └── style.css
└── hello-world-sui/            ← Standard ESM plugin
    ├── plugin.tsx
    └── style.css

sui-plugin-wasm.html            ← Page entry
```

---

## 3. WASM Loader — `wasm-loader.ts`

Mở rộng base loader với WASM detection. Không thay đổi cách load — chỉ thêm metadata.

### Interface

```typescript
export interface WasmPluginMeta {
  usesWasm: boolean        // Plugin có dùng WASM-grade crypto không
  wasmInfo?: string        // Mô tả: "@noble/curves (secp256k1), @noble/hashes (BLAKE2b)"
  wasmModules?: string[]   // Danh sách modules detected
}

export interface WasmPlugin extends Plugin {
  _wasmMeta?: WasmPluginMeta   // Gắn bởi loader sau khi detect
}
```

### Detection logic

Loader kiểm tra source code của plugin (toString) để phát hiện WASM patterns:

```typescript
const patterns = [
  { pattern: /noble.*curves/i, name: '@noble/curves (secp256k1/ed25519)' },
  { pattern: /noble.*hashes/i, name: '@noble/hashes (BLAKE2b/SHA)' },
  { pattern: /WebAssembly/i,   name: 'WebAssembly native' },
  { pattern: /\.wasm/i,        name: 'WASM module' },
  { pattern: /scure.*bip39/i,  name: '@scure/bip39 (mnemonic)' },
  { pattern: /scure.*bip32/i,  name: '@scure/bip32 (HD keys)' },
]
```

### Load flow

```
loadWasmPlugin(url, host)
    │
    ├── import(url + cache-bust)     ← Dynamic import ESM
    │
    ├── detectWasmUsage(module)      ← Scan source cho WASM patterns
    │   └── Gắn _wasmMeta vào plugin object
    │
    ├── plugin.init(host)            ← Init bình thường qua HostAPI
    │
    └── return plugin                ← Trả về WasmPlugin với metadata
```

---

## 4. Crypto Stack — WASM-grade Libraries

Project dùng `@noble/*` và `@scure/*` — cùng stack mà `@mysten/sui` SDK dùng bên dưới.

### Tại sao gọi là "WASM-grade"

Các thư viện này là **pure JavaScript** nhưng đạt performance tương đương WASM vì:
- Tối ưu hóa bitwise operations cho JS engine (V8/SpiderMonkey JIT)
- Zero dependencies, audited bởi Trail of Bits và Cure53
- Cùng tác giả (Paul Miller) với nhiều WASM crypto implementations
- `@mysten/sui` SDK chọn dùng thay vì compile Rust → WASM

### Dependency tree

```
@noble/curves v2.0.1          ← Elliptic curve crypto
├── secp256k1.js               ← ECDSA keypair, sign, verify
└── @noble/hashes v2.0.1      ← Hash functions
    └── blake2.js              ← BLAKE2b-256 (Sui address derivation)

@scure/bip39 v1.6.0           ← BIP-39 mnemonic generation
├── generateMnemonic()         ← 12/24 word phrases
├── validateMnemonic()         ← Wordlist validation
└── mnemonicToSeedSync()       ← Mnemonic → 64-byte seed

@scure/bip32 v1.6.2           ← BIP-32 HD key derivation
└── HDKey.fromMasterSeed()     ← Seed → derived keypair
    └── .derive(path)          ← m/54'/784'/0'/0/0
```

### Import paths — `.js` extension bắt buộc

`@noble/*` v2 dùng strict ESM exports. Import **phải** có `.js`:

```typescript
// ✅ Đúng
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { blake2b } from '@noble/hashes/blake2.js'

// ❌ Sai — Vite error: "./secp256k1" is not exported
import { secp256k1 } from '@noble/curves/secp256k1'
import { blake2b } from '@noble/hashes/blake2b'    // blake2b.js không tồn tại, dùng blake2.js
```

---

## 5. Sui Address Derivation — Secp256k1

Quy trình tạo ví Sui từ Secp256k1 keypair:

```
                    ┌──────────────────────┐
                    │  Random / Mnemonic   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         Random Key      BIP-39 Mnemonic    Import Mnemonic
              │                │                │
              │         mnemonicToSeedSync()    │
              │                │                │
              │         HDKey.fromMasterSeed()  │
              │                │                │
              │         .derive("m/54'/784'/0'/0/0")
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────────────────────────────────┐
    │           32-byte Secret Key                 │
    └──────────────────┬──────────────────────────┘
                       │
          secp256k1.getPublicKey(secretKey, true)
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │      33-byte Compressed Public Key           │
    └──────────────────┬──────────────────────────┘
                       │
          BLAKE2b-256( 0x01 || publicKey )
          ─────────────────────────────
          scheme flag: 0x01 = Secp256k1
          (Ed25519 = 0x00, Secp256r1 = 0x02)
                       │
                       ▼
    ┌─────────────────────────────────────────────┐
    │     0x + 64 hex chars = Sui Address          │
    │     0x7a8b...3f2e                            │
    └─────────────────────────────────────────────┘
```

### Derivation path

| Scheme    | Path format                              | Ví dụ                  |
|-----------|------------------------------------------|------------------------|
| Ed25519   | `m/44'/784'/{acc}'/{change}'/{addr}'`     | `m/44'/784'/0'/0'/0'`  |
| Secp256k1 | `m/54'/784'/{acc}'/{change}/{addr}`       | `m/54'/784'/0'/0/0`    |
| Secp256r1 | `m/74'/784'/{acc}'/{change}/{addr}`       | `m/74'/784'/0'/0/0`    |

Lưu ý: Ed25519 dùng **hardened** path (tất cả `'`), Secp256k1/r1 dùng **BIP-32** (2 level cuối không hardened).

### Implementation

```typescript
const SECP256K1_SCHEME_FLAG = 0x01

function deriveSuiAddress(compressedPubKey: Uint8Array): string {
  const payload = new Uint8Array(1 + compressedPubKey.length)
  payload[0] = SECP256K1_SCHEME_FLAG
  payload.set(compressedPubKey, 1)
  const hash = blake2b(payload, { dkLen: 32 })
  return `0x${bytesToHex(hash)}`
}
```

---

## 6. Dashboard UI — `SuiWasmDashboard.tsx`

### Khác biệt so với SuiDashboard

| Feature              | SuiDashboard              | SuiWasmDashboard           |
|----------------------|---------------------------|----------------------------|
| Loader               | `sui-loader.ts`           | `wasm-loader.ts`           |
| Host API             | `SuiHostAPI` (shared ctx) | Base `HostAPI`             |
| DAppKit              | Shared provider           | Không có (plugin tự quản)  |
| WASM detection       | Không                     | Có — badge + metadata      |
| Load time tracking   | Không                     | Có — `performance.now()`   |
| WebAssembly check    | Không                     | Có — header indicator      |

### UI Components

```
┌─────────────────────────────────────────────────────────┐
│ Header: "SUI WASM Plugin Dashboard"    [WebAssembly OK] │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Sidebar     │  Main Content                            │
│              │                                          │
│  ┌────────┐  │  ┌────────────────────────────────────┐  │
│  │ Create │  │  │ Create Wallet          [WASM] v1.0 │  │
│  │ Wallet │  │  │                     loaded in 42ms │  │
│  │ [WASM] │  │  ├────────────────────────────────────┤  │
│  │ ●      │  │  │ ┌──────────────────────────────┐   │  │
│  └────────┘  │  │ │ WASM-Grade Crypto Active     │   │  │
│  ┌────────┐  │  │ │ @noble/curves, @noble/hashes │   │  │
│  │Lending │  │  │ └──────────────────────────────┘   │  │
│  │ [ESM]  │  │  │                                    │  │
│  └────────┘  │  │ ┌──────────────────────────────┐   │  │
│  ┌────────┐  │  │ │  Plugin content (Shadow DOM) │   │  │
│  │ Faucet │  │  │ │  ...                         │   │  │
│  │ [ESM]  │  │  │ └──────────────────────────────┘   │  │
│  └────────┘  │  └────────────────────────────────────┘  │
│              │                                          │
│  Active (1)  │                                          │
│  Create v1.0 │                                          │
│  42ms    ✕   │                                          │
│              │                                          │
│  Architecture│                                          │
│  ┌─────────┐ │                                          │
│  │ESM wrap │ │                                          │
│  │ └noble  │ │                                          │
│  │ └hashes │ │                                          │
│  │ └bip39  │ │                                          │
│  │ └DOM/JS │ │                                          │
│  └─────────┘ │                                          │
├──────────────┴──────────────────────────────────────────┤
```

---

## 7. Hai hướng tích hợp WASM

### Hướng 1: WASM-grade JS (hiện tại)

Plugin dùng `@noble/curves` — pure JS, performance tương đương WASM, không cần toolchain Rust.

```
Plugin.tsx ──import──▶ @noble/curves/secp256k1.js
                       (pure JS, JIT-optimized)
```

**Ưu điểm**: Zero toolchain overhead, audited, cùng stack với Sui SDK.
**Nhược điểm**: Không phải "native WASM" — vẫn là JS.

### Hướng 2: Native WASM (tương lai)

Plugin load `.wasm` file compiled từ Rust/AssemblyScript.

```
Plugin.tsx ──fetch──▶ /wasm/sui_core.wasm
                      │
                      ▼
              WebAssembly.instantiate(bytes, imports)
                      │
                      ▼
              instance.exports.create_keypair()
```

**Yêu cầu thêm**:
- `vite-plugin-wasm` + `vite-plugin-top-level-await` trong vite.config.ts
- Rust toolchain: `wasm-pack build --target web`
- JS host functions cho WASM imports (logging, random, etc.)

### So sánh

| Tiêu chí          | WASM-grade JS (@noble)     | Native WASM (Rust)          |
|--------------------|----------------------------|-----------------------------|
| Toolchain          | Không cần thêm             | Rust + wasm-pack + vite plugin |
| Performance        | Rất tốt (JIT optimized)    | Tốt nhất (native speed)    |
| Bundle size        | ~50KB (tree-shakeable)     | ~100-500KB (.wasm file)    |
| Debug              | Source maps bình thường    | Khó — WASM stack traces    |
| DOM access         | Trực tiếp                  | Phải qua JS host functions |
| Audit              | Trail of Bits, Cure53      | Tùy thư viện Rust          |
| Phù hợp khi       | Crypto, hashing, encoding  | zk-proofs, heavy compute   |

---

## 8. Thêm WASM plugin mới

### Bước 1: Tạo plugin

```bash
# Scaffold
mkdir plugins/my-wasm-plugin
```

### Bước 2: Plugin entry (ESM wrapper)

```typescript
// plugins/my-wasm-plugin/plugin.tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import { secp256k1 } from '@noble/curves/secp256k1.js'  // WASM-grade
import { blake2b } from '@noble/hashes/blake2.js'
import './style.css'

function MyComponent() {
  // Crypto logic dùng @noble — chạy ở WASM-grade performance
  const keypair = secp256k1.utils.randomPrivateKey()
  // ...
}

const MyPlugin: Plugin = {
  name: 'MyWasmPlugin',
  version: '1.0.0',
  styleUrls: ['/plugins/my-wasm-plugin/style.css'],
  init(host: HostAPI) {
    host.registerComponent('MyWasmPlugin', MyComponent)
  },
}

export default MyPlugin
```

### Bước 3: Đăng ký trong dashboard

```typescript
// src/sui-wasm/SuiWasmDashboard.tsx → WASM_PLUGINS array
{
  id: 'my-wasm-plugin',
  name: 'MyWasmPlugin',
  label: 'My WASM Plugin',
  desc: 'Description',
  src: pluginPath('my-wasm-plugin'),
  wasmDesc: '@noble/curves secp256k1 + @noble/hashes BLAKE2b',
},
```

### Bước 4: Vite build entry

```typescript
// vite.config.ts → build.rollupOptions.input
'plugins/my-wasm-plugin': resolve(__dirname, 'plugins/my-wasm-plugin/plugin.tsx'),
```

---

## 9. Native WASM — Hướng dẫn tương lai

Khi cần native `.wasm` (Rust compiled), plugin wrapper sẽ trông như:

```typescript
// plugins/zk-prover/plugin.tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'

let wasmReady = false
let wasmExports: any = null

async function ensureWasm() {
  if (wasmReady) return
  const resp = await fetch('/wasm/zk_prover.wasm')
  const { instance } = await WebAssembly.instantiateStreaming(resp, {
    env: {
      // Host functions mà WASM có thể gọi
      log: (ptr: number, len: number) => { /* read string from WASM memory */ },
      random: () => crypto.getRandomValues(new Uint8Array(32)),
    },
  })
  wasmExports = instance.exports
  wasmReady = true
}

function ZkProverComponent() {
  const handleProve = async () => {
    await ensureWasm()
    const result = wasmExports.generate_proof(/* ... */)
    // ...
  }
  // ...
}

const ZkProverPlugin: Plugin = {
  name: 'ZkProver',
  version: '1.0.0',
  init(host: HostAPI) {
    host.registerComponent('ZkProver', ZkProverComponent)
  },
}

export default ZkProverPlugin
```

### Vite config cho native WASM

```typescript
// vite.config.ts
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
})
```

---

## 10. Security

### WASM-grade crypto

| Concern              | Mitigation                                              |
|----------------------|---------------------------------------------------------|
| Randomness           | `@noble/curves` dùng `crypto.getRandomValues()` (CSPRNG)|
| Side-channel         | Constant-time operations trong @noble implementations   |
| Key storage          | Plugin KHÔNG lưu key — user tự backup mnemonic          |
| XSS                  | Shadow DOM isolation, nhưng JS vẫn shared context       |
| Supply chain         | @noble/@scure audited, zero dependencies                |

### Native WASM

| Concern              | Mitigation                                              |
|----------------------|---------------------------------------------------------|
| Memory safety        | WASM linear memory isolated từ JS heap                  |
| Host function abuse  | Chỉ expose minimal imports (log, random)                |
| MIME type            | Server phải trả `Content-Type: application/wasm`        |
| Integrity            | Subresource Integrity hash cho `.wasm` files            |

---

## 11. File Reference

| File                                | Vai trò                                    |
|-------------------------------------|--------------------------------------------|
| `sui-plugin-wasm.html`              | Page entry point                           |
| `src/sui-wasm/main.tsx`             | React mount                                |
| `src/sui-wasm/SuiWasmDashboard.tsx` | Dashboard UI với WASM badges và metrics    |
| `src/sui-wasm/wasm-loader.ts`       | WASM-aware loader (extends base loader)    |
| `src/sui-wasm/sui-wasm.css`         | Dark theme CSS                             |
| `plugins/sui-create-wallet/`        | WASM-grade crypto plugin (Secp256k1)       |
| `docs/plugin-wasm.md`               | Design rationale và kiến trúc ban đầu      |
| `docs/plugin-architecture.md`       | Base plugin architecture reference         |
