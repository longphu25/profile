# WASM Integration — Technical Reference

> Native Rust → WebAssembly trong plugin system. Bao gồm build pipeline, runtime loading, và hướng dẫn tạo WASM plugin mới.
>
> See also: [[plugin-architecture-wasm|WASM Dashboard Architecture]] · [[defi/navi/EXPANSION|NAVI Expansion]]

---

## Tổng quan

Plugin system hỗ trợ 2 loại WASM:

| Loại | Ví dụ | Cách dùng |
|------|-------|-----------|
| **WASM-grade JS** | `sui-create-wallet` dùng `@noble/curves` | Import trực tiếp, không cần toolchain |
| **Native WASM** | `sui-navi-analysis` dùng Rust → `.wasm` | Compile Rust, load runtime qua `fetch()` |

Quy tắc: Plugin entry **luôn là TS/ESM**. WASM module được load bên trong plugin, không thay thế plugin.

---

## Kiến trúc Native WASM

```
vite build
    │
    ├── buildWasm() plugin (vite.config.ts)
    │   ├── Scan plugins/*/wasm/Cargo.toml
    │   ├── wasm-pack build --target web --release
    │   ├── Output → plugins/*/pkg/ (JS bindings + .wasm)
    │   └── Copy .wasm → public/wasm/ (runtime fetch)
    │
    ├── Vite bundle (TS/ESM plugins)
    │   └── plugin.tsx import analysis.ts (TS fallback)
    │
    └── copyPluginAssets() plugin
        └── Copy pkg/*.{js,wasm,d.ts} → dist/plugins/*/pkg/
```

### Runtime flow

```
Browser load plugin.tsx
    │
    ├── initWasm() — parallel với UI render
    │   ├── import(pkg/navi_analysis_wasm.js)  ← JS bindings
    │   ├── fetch(/wasm/navi-analysis.wasm)    ← WASM binary
    │   └── WebAssembly.instantiate()
    │
    ├── Mỗi 15s refresh:
    │   ├── fetch MCP data (network I/O)
    │   └── wasmAnalyze(pools, vaults, ...) hoặc buildSnapshot() (TS fallback)
    │
    └── Footer hiển thị: "WASM 120ms init" hoặc "TS fallback"
```

---

## Cấu trúc thư mục

```
plugins/sui-navi-analysis/
├── wasm/
│   ├── Cargo.toml              ← Rust crate config
│   └── src/
│       └── lib.rs              ← Rust analysis engine
├── pkg/                        ← wasm-pack output (git-ignored)
│   ├── navi_analysis_wasm.js   ← JS bindings (16KB)
│   ├── navi_analysis_wasm.d.ts ← TypeScript types
│   └── navi_analysis_wasm_bg.wasm  ← WASM binary (128KB)
├── analysis.ts                 ← TS engine (fallback)
├── plugin.tsx                  ← React UI + WASM loader
└── style.css

public/wasm/
└── navi-analysis.wasm          ← Copy cho runtime fetch
```

---

## Build Pipeline

### Tự động (khuyến nghị)

`vite build` tự chạy `wasm-pack` trước khi bundle:

```bash
bun run build    # hoặc: npx vite build
# Output:
# [wasm] Building sui-navi-analysis...
# [INFO]: 📦 Your wasm pkg is ready...
# ✓ built in 9.35s
```

Vite plugin `buildWasm()` trong `vite.config.ts`:
1. Scan tất cả `plugins/*/wasm/Cargo.toml`
2. Chạy `wasm-pack build --target web --release`
3. Copy `.wasm` vào `public/wasm/`

### Thủ công

```bash
# Build WASM riêng
make wasm

# Hoặc trực tiếp
cd plugins/sui-navi-analysis/wasm
wasm-pack build --target web --release --out-dir ../pkg
```

### Yêu cầu toolchain

```bash
# Rust + wasm-pack (cài 1 lần)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

---

## Rust WASM Crate — Cargo.toml

```toml
[package]
name = "navi-analysis-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"

# Tắt wasm-opt vì bundled version không hỗ trợ bulk memory ops (Rust 1.82+)
[package.metadata.wasm-pack.profile.release]
wasm-opt = false

[profile.release]
opt-level = "s"    # Optimize for size
lto = true
strip = true
```

### Tại sao `wasm-opt = false`?

Rust 1.82+ emit `memory.copy`/`memory.fill` (bulk memory ops). `wasm-opt` bundled trong `wasm-pack` chưa hỗ trợ, gây lỗi:

```
[wasm-validator error] unexpected false: Bulk memory operations require bulk memory
```

Tắt `wasm-opt` là workaround. Khi `wasm-pack` update `wasm-opt`, có thể bật lại.

---

## Rust API Pattern

### Export function qua `wasm-bindgen`

```rust
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Pool {
    pub symbol: String,
    pub price: f64,
    #[serde(rename = "supplyApy")]
    pub supply_apy: f64,
    // ...
}

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub opportunities: Vec<Opportunity>,
    pub deltas: Vec<PoolDelta>,
    // ...
}

#[wasm_bindgen]
pub fn analyze(
    pools_js: JsValue,
    vaults_js: JsValue,
    prev_pools_js: JsValue,
    wallet_coins_js: JsValue,
) -> JsValue {
    // Deserialize JS → Rust structs
    let pools: Vec<Pool> = serde_wasm_bindgen::from_value(pools_js).unwrap_or_default();
    // ... computation ...
    // Serialize Rust → JS
    serde_wasm_bindgen::to_value(&result).unwrap()
}
```

### Quy tắc serde

- Dùng `#[serde(rename = "camelCase")]` để match JS field names
- `serde_wasm_bindgen` cho zero-copy serialization (nhanh hơn `serde_json`)
- `unwrap_or_default()` để graceful fallback khi data không hợp lệ

---

## TS Plugin — WASM Loader Pattern

```typescript
// Trong plugin.tsx

let wasmAnalyze: ((pools, vaults, prevPools, walletCoins) => unknown) | null = null
let wasmStatus: 'loading' | 'ready' | 'fallback' = 'loading'
let wasmLoadTimeMs = 0

async function initWasm() {
  try {
    const t0 = performance.now()
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/sui-navi-analysis/pkg/navi_analysis_wasm.js`
    const wasmMod = await import(/* @vite-ignore */ pkgUrl)
    const wasmUrl = new URL(
      `${import.meta.env.BASE_URL}wasm/navi-analysis.wasm`,
      window.location.origin,
    )
    await wasmMod.default(wasmUrl)
    wasmAnalyze = wasmMod.analyze
    wasmLoadTimeMs = performance.now() - t0
    wasmStatus = 'ready'
  } catch (e) {
    console.warn('[WASM] load failed, using TS fallback:', e)
    wasmStatus = 'fallback'
  }
}

// Start loading immediately (parallel với React render)
const wasmReady = initWasm()
```

### Sử dụng trong refresh cycle

```typescript
await wasmReady // đảm bảo init đã attempt

if (wasmAnalyze) {
  // WASM path
  const result = wasmAnalyze(pools, vaults, prevPools, walletCoins)
} else {
  // TS fallback
  const result = buildSnapshot(pools, vaults, stats, prevPools, walletCoins)
}
```

---

## Tạo WASM Plugin Mới

### Bước 1: Scaffold Rust crate

```bash
mkdir -p plugins/my-plugin/wasm/src

# Cargo.toml — copy template từ sui-navi-analysis
cat > plugins/my-plugin/wasm/Cargo.toml << 'EOF'
[package]
name = "my-plugin-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"

[package.metadata.wasm-pack.profile.release]
wasm-opt = false

[profile.release]
opt-level = "s"
lto = true
strip = true
EOF
```

### Bước 2: Viết Rust logic

```rust
// plugins/my-plugin/wasm/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compute(data_js: JsValue) -> JsValue {
    let data: Vec<f64> = serde_wasm_bindgen::from_value(data_js).unwrap_or_default();
    let result = data.iter().sum::<f64>();
    serde_wasm_bindgen::to_value(&result).unwrap()
}
```

### Bước 3: Viết TS fallback

```typescript
// plugins/my-plugin/analysis.ts
export function compute(data: number[]): number {
  return data.reduce((a, b) => a + b, 0)
}
```

### Bước 4: Plugin entry với WASM loader

```typescript
// plugins/my-plugin/plugin.tsx
import type { Plugin, HostAPI } from '../../src/plugins/types'
import { compute as computeTS } from './analysis'

let wasmCompute: ((data: number[]) => number) | null = null

async function initWasm() {
  try {
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/my-plugin/pkg/my_plugin_wasm.js`
    const mod = await import(/* @vite-ignore */ pkgUrl)
    await mod.default(new URL(`${import.meta.env.BASE_URL}wasm/my-plugin.wasm`, location.origin))
    wasmCompute = mod.compute
  } catch { /* TS fallback */ }
}
const wasmReady = initWasm()

function MyComponent() {
  // Dùng wasmCompute ?? computeTS
}

const MyPlugin: Plugin = {
  name: 'MyPlugin',
  version: '1.0.0',
  styleUrls: ['/plugins/my-plugin/style.css'],
  init(host: HostAPI) {
    host.registerComponent('MyPlugin', MyComponent)
  },
}
export default MyPlugin
```

### Bước 5: Đăng ký

```typescript
// vite.config.ts → build.rollupOptions.input
'plugins/my-plugin': resolve(__dirname, 'plugins/my-plugin/plugin.tsx'),

// src/sui-wasm/SuiWasmDashboard.tsx → PLUGIN_GROUPS
{
  id: 'my-plugin',
  name: 'MyPlugin',
  label: 'My Plugin',
  desc: 'Description',
  src: pluginPath('my-plugin'),
  wasmDesc: 'Rust WASM — custom compute',
},
```

### Bước 6: Build & test

```bash
bun run build   # Auto: wasm-pack → vite bundle → copy assets
bun run preview # Test tại http://localhost:4173/sui-plugin-wasm.html
```

---

## File Reference

| File | Vai trò |
|------|---------|
| `vite.config.ts` → `buildWasm()` | Auto-discover & build tất cả Rust WASM crates |
| `vite.config.ts` → `copyPluginAssets()` | Copy pkg/ vào dist/ khi build |
| `src/sui-wasm/wasm-loader.ts` | WASM-aware plugin loader + detection |
| `src/sui-wasm/SuiWasmDashboard.tsx` | Dashboard UI, WASM badges |
| `sui-plugin-wasm.html` | Page entry point |
| `public/wasm/*.wasm` | WASM binaries cho runtime fetch |
| `plugins/*/wasm/Cargo.toml` | Rust crate config (auto-discovered) |
| `plugins/*/pkg/` | wasm-pack output (JS bindings + .wasm) |
| `plugins/*/analysis.ts` | TS fallback engine |
| `Makefile` → `make wasm` | Build WASM riêng |

---

## Hiện có

| Plugin | Engine | WASM Size | Fallback |
|--------|--------|-----------|----------|
| `sui-navi-analysis` | Rust → WASM | 128KB | `analysis.ts` |
| `sui-create-wallet` | `@noble/curves` (WASM-grade JS) | N/A | N/A |

---

## Troubleshooting

### `wasm-pack` not found

```bash
cargo install wasm-pack
# Hoặc: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### `wasm-opt` bulk memory error

Thêm vào `Cargo.toml`:
```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = false
```

### WASM load fails in browser (CORS/MIME)

- Dev: Vite serve `public/wasm/` tự động, không cần config
- Prod: Server phải trả `Content-Type: application/wasm` cho `.wasm` files
- GitHub Pages: OK mặc định

### Import path error

Plugin dùng `import(/* @vite-ignore */ url)` — path là runtime URL, không phải module path:
```typescript
// ✅ Đúng — runtime URL
const pkgUrl = `${import.meta.env.BASE_URL}plugins/my-plugin/pkg/my_wasm.js`
const mod = await import(/* @vite-ignore */ pkgUrl)

// ❌ Sai — Vite cố resolve lúc build
import init from '/plugins/my-plugin/pkg/my_wasm.js'
```

### TS type cho WASM module

Cast khi import:
```typescript
const wasmMod = await import(/* @vite-ignore */ pkgUrl) as {
  default: (input: URL) => Promise<unknown>
  analyze: (a: unknown, b: unknown, c: unknown, d: unknown) => unknown
}
```
