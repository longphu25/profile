#!/usr/bin/env node

/**
 * Plugin Scaffold CLI
 *
 * Usage:
 *   node scripts/create-plugin.mjs <plugin-name>
 *
 * Example:
 *   node scripts/create-plugin.mjs token-swap
 *   → creates plugins/token-swap/plugin.tsx
 *   → creates plugins/token-swap/style.css
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const args = process.argv.slice(2)
const pluginName = args[0]

if (!pluginName) {
  console.error('Usage: node scripts/create-plugin.mjs <plugin-name>')
  console.error('Example: node scripts/create-plugin.mjs token-swap')
  process.exit(1)
}

// Validate name: lowercase, hyphens only
if (!/^[a-z][a-z0-9-]*$/.test(pluginName)) {
  console.error(`Invalid plugin name "${pluginName}". Use lowercase letters, numbers, and hyphens.`)
  console.error('Example: my-plugin, token-swap, sui-nft-viewer')
  process.exit(1)
}

const pluginDir = resolve('plugins', pluginName)

if (existsSync(pluginDir)) {
  console.error(`Plugin "${pluginName}" already exists at ${pluginDir}`)
  process.exit(1)
}

// Convert kebab-case to PascalCase for code identifiers
function toPascalCase(str) {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

const pascalName = toPascalCase(pluginName)
const componentName = `${pascalName}Component`
const cssPrefix = pluginName

// --- Templates ---

const pluginTsx = `// ${pascalName} Plugin
// TODO: Describe what this plugin does

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useState } from 'react'
import './style.css'

function ${componentName}() {
  const [count, setCount] = useState(0)

  return (
    <div className="${cssPrefix}">
      <h3 className="${cssPrefix}__title">${pascalName}</h3>
      <p className="${cssPrefix}__desc">
        This is the ${pascalName} plugin. Edit <code>plugins/${pluginName}/plugin.tsx</code> to customize.
      </p>
      <button className="${cssPrefix}__btn" onClick={() => setCount((c) => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  )
}

const ${pascalName}Plugin: Plugin = {
  name: '${pascalName}',
  version: '1.0.0',
  styleUrls: ['/plugins/${pluginName}/style.css'],

  init(host: HostAPI) {
    host.registerComponent('${pascalName}', ${componentName})
    host.log('${pascalName} plugin initialized')
  },

  mount() {
    console.log('[${pascalName}] mounted')
  },

  unmount() {
    console.log('[${pascalName}] unmounted')
  },
}

export default ${pascalName}Plugin
`

const styleCss = `.${cssPrefix} {
  font-family: system-ui, -apple-system, sans-serif;
}

.${cssPrefix}__title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.${cssPrefix}__desc {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

.${cssPrefix}__btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #333;
  background: #1a1a1a;
  color: #ededed;
  font-size: 0.85rem;
  cursor: pointer;
}

.${cssPrefix}__btn:hover {
  border-color: #555;
  background: #222;
}
`

// --- Create files ---

mkdirSync(pluginDir, { recursive: true })
writeFileSync(join(pluginDir, 'plugin.tsx'), pluginTsx)
writeFileSync(join(pluginDir, 'style.css'), styleCss)

console.log(`\n✅ Plugin "${pluginName}" created at plugins/${pluginName}/\n`)
console.log('Files:')
console.log(`  plugins/${pluginName}/plugin.tsx`)
console.log(`  plugins/${pluginName}/style.css`)
console.log('')
console.log('Next steps:')
console.log(`  1. Edit plugins/${pluginName}/plugin.tsx`)
console.log(`  2. Add to PluginDemoApp.tsx:`)
console.log(`     { name: '${pascalName}', src: '/plugins/${pluginName}/plugin.tsx' }`)
console.log('')
