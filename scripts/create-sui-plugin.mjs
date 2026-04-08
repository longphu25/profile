#!/usr/bin/env node

/**
 * SUI Plugin Scaffold CLI
 *
 * Creates a dual-mode SUI plugin that works on both:
 *   - plugin-demo.html (standalone DAppKitProvider)
 *   - sui-plugin.html  (shared DAppKitProvider from dashboard)
 *
 * Usage:
 *   node scripts/create-sui-plugin.mjs <plugin-name>
 *
 * Example:
 *   node scripts/create-sui-plugin.mjs token-swap
 *   → creates plugins/token-swap/plugin.tsx  (dual-mode SUI template)
 *   → creates plugins/token-swap/style.css
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const args = process.argv.slice(2)
const pluginName = args[0]

if (!pluginName) {
  console.error('Usage: node scripts/create-sui-plugin.mjs <plugin-name>')
  console.error('Example: node scripts/create-sui-plugin.mjs token-swap')
  process.exit(1)
}

if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
  console.error(`Invalid plugin name "${pluginName}". Use lowercase letters, numbers, and hyphens.`)
  process.exit(1)
}

const pluginDir = resolve('plugins', pluginName)

if (existsSync(pluginDir)) {
  console.error(`Plugin "${pluginName}" already exists at ${pluginDir}`)
  process.exit(1)
}

function toPascalCase(str) {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

const pascal = toPascalCase(pluginName)
const css = pluginName

// --- plugin.tsx ---
const pluginTsx = `// ${pascal} Plugin
// Dual-mode: standalone (plugin-demo) + shared context (sui-dashboard)
// TODO: Describe what this plugin does

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
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

// --- Standalone DAppKit (only used in plugin-demo, NOT in sui-dashboard) ---
const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const

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

// Store shared host reference (set during init if in sui-dashboard)
let sharedHost: SuiHostAPI | null = null

// --- Core UI (works in both modes) ---
function ${pascal}Content() {
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const connection = useWalletConnection()

  // TODO: Replace with your plugin logic
  return (
    <div className="${css}">
      <h3 className="${css}__title">${pascal}</h3>
      <p className="${css}__desc">
        {connection.isConnected
          ? \`Connected: \${account?.address?.slice(0, 10)}... on \${network}\`
          : 'Connect your wallet to get started.'}
      </p>
      {/* TODO: Add your plugin UI here */}
    </div>
  )
}

// --- Standalone wrapper (plugin-demo: own DAppKitProvider) ---
function ${pascal}Standalone() {
  return (
    <DAppKitProvider dAppKit={standaloneDAppKit}>
      <${pascal}Content />
    </DAppKitProvider>
  )
}

// --- Shared wrapper (sui-dashboard: DAppKitProvider already exists) ---
function ${pascal}Shared() {
  return <${pascal}Content />
}

const ${pascal}Plugin: Plugin = {
  name: '${pascal}',
  version: '1.0.0',
  styleUrls: ['/plugins/${pluginName}/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    const Component = sharedHost ? ${pascal}Shared : ${pascal}Standalone
    host.registerComponent('${pascal}', Component)
    host.log('${pascal} plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'))
  },

  mount() {
    console.log('[${pascal}] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[${pascal}] unmounted')
  },
}

export default ${pascal}Plugin
`

// --- style.css ---
const styleCss = `.${css} {
  font-family: system-ui, -apple-system, sans-serif;
}

.${css}__title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.${css}__desc {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: #888;
}

.${css}__section {
  margin-bottom: 1.25rem;
}

.${css}__section-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.${css}__btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  background: #4da2ff;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.${css}__btn:hover {
  background: #3d8ce6;
}

.${css}__btn:disabled {
  background: #444;
  cursor: not-allowed;
}

.${css}__error {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: #2a0a0a;
  border: 1px solid #5a1a1a;
  color: #ff6b6b;
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.${css}__loading {
  text-align: center;
  padding: 1rem;
  color: #888;
  font-size: 0.85rem;
}

.${css}__empty {
  text-align: center;
  padding: 1rem;
  color: #666;
  font-size: 0.85rem;
}
`

// --- Create files ---
mkdirSync(pluginDir, { recursive: true })
writeFileSync(join(pluginDir, 'plugin.tsx'), pluginTsx)
writeFileSync(join(pluginDir, 'style.css'), styleCss)

console.log(`\n✅ SUI Plugin "${pluginName}" created at plugins/${pluginName}/\n`)
console.log('Files:')
console.log(`  plugins/${pluginName}/plugin.tsx  (dual-mode: standalone + shared)`)
console.log(`  plugins/${pluginName}/style.css`)
console.log('')
console.log('Next steps:')
console.log(`  1. Edit plugins/${pluginName}/plugin.tsx — add your SUI logic`)
console.log(`  2. Register in plugin-demo (src/plugin-demo/PluginDemoApp.tsx):`)
console.log(`     { name: '${pascal}', src: pluginPath('${pluginName}') }`)
console.log(`  3. Register in sui-dashboard (src/sui-dashboard/SuiDashboard.tsx):`)
console.log(
  `     { id: '${pluginName}', name: '${pascal}', label: '${pascal}', desc: '...', src: pluginPath('${pluginName}'), icon: '🔌' }`,
)
console.log(`  4. Add build entry in vite.config.ts → rollupOptions.input:`)
console.log(`     'plugins/${pluginName}': resolve(__dirname, 'plugins/${pluginName}/plugin.tsx')`)
console.log('')
