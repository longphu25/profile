// WASM-aware Plugin Loader
// Loads TS/ESM plugins that may internally use WASM modules
// Architecture: Plugin entry is always TS/ESM, heavy crypto/logic runs in WASM
//
// Supported patterns:
// 1. Standard plugin: plugin.tsx exports Plugin object directly
// 2. WASM-enhanced plugin: plugin.tsx imports @noble/curves (WASM-grade crypto),
//    WebAssembly modules, or uses fetch+instantiate pattern internally
//
// The loader doesn't need to know about WASM — it loads the ESM wrapper,
// which handles WASM initialization internally. This matches the architecture
// described in docs/plugin-wasm.md: "Plugin entry vẫn là TypeScript/ESM,
// phần logic nặng được chuyển sang WASM module và load bên trong plugin TS"

import type { Plugin, HostAPI } from '../plugins/types'

export interface WasmPluginMeta {
  /** Whether this plugin uses WASM-grade crypto or actual WASM modules */
  usesWasm: boolean
  /** Description of WASM usage */
  wasmInfo?: string
  /** WASM modules loaded (detected after init) */
  wasmModules?: string[]
}

export interface WasmPlugin extends Plugin {
  /** WASM metadata — set by loader after detection */
  _wasmMeta?: WasmPluginMeta
}

/** Detect if a plugin uses WASM-grade crypto by checking its module imports */
function detectWasmUsage(module: Record<string, unknown>): WasmPluginMeta {
  const plugin = module.default as Plugin
  const moduleStr = String(module.default?.toString?.() ?? '')
  const initStr = String(plugin?.init?.toString?.() ?? '')
  const combined = moduleStr + initStr

  // Check for known WASM-grade crypto patterns
  const patterns = [
    { pattern: /noble.*curves/i, name: '@noble/curves (secp256k1/ed25519)' },
    { pattern: /noble.*hashes/i, name: '@noble/hashes (BLAKE2b/SHA)' },
    { pattern: /WebAssembly/i, name: 'WebAssembly native' },
    { pattern: /\.wasm/i, name: 'WASM module' },
    { pattern: /scure.*bip39/i, name: '@scure/bip39 (mnemonic)' },
    { pattern: /scure.*bip32/i, name: '@scure/bip32 (HD keys)' },
  ]

  const detected = patterns.filter((p) => p.pattern.test(combined))

  return {
    usesWasm: detected.length > 0,
    wasmInfo: detected.length > 0 ? detected.map((d) => d.name).join(', ') : undefined,
    wasmModules: detected.map((d) => d.name),
  }
}

/** Load a plugin with WASM detection */
export async function loadWasmPlugin(url: string, host: HostAPI): Promise<WasmPlugin> {
  const bustUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
  const module = await import(/* @vite-ignore */ bustUrl)
  const plugin = module.default as WasmPlugin

  if (!plugin.name || !plugin.init) {
    throw new Error(`Invalid plugin at ${url}: missing 'name' or 'init'`)
  }

  // Detect WASM usage
  plugin._wasmMeta = detectWasmUsage(module)

  // Initialize plugin
  plugin.init(host)

  return plugin
}
