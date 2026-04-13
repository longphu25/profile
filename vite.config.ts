import { resolve } from 'path'
import { readdirSync, copyFileSync, mkdirSync } from 'fs'
import { defineConfig, type Plugin as VitePlugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

/** Copy plugin CSS files into dist so Shadow DOM <link> tags work in production */
function copyPluginAssets(): VitePlugin {
  return {
    name: 'copy-plugin-assets',
    apply: 'build',
    closeBundle() {
      const pluginsDir = resolve(__dirname, 'plugins')
      for (const name of readdirSync(pluginsDir)) {
        const src = resolve(pluginsDir, name, 'style.css')
        try {
          const dest = resolve(__dirname, 'dist/plugins', name)
          mkdirSync(dest, { recursive: true })
          copyFileSync(src, resolve(dest, 'style.css'))
        } catch {
          // plugin has no style.css — skip
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    copyPluginAssets(),
  ],
  optimizeDeps: {
    include: [
      '@mysten/dapp-kit-react',
      '@mysten/dapp-kit-core',
      '@mysten/sui/grpc',
      '@mysten/sui/faucet',
      '@mysten/sui/utils',
      'nanostores',
    ],
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        'plugin-demo': resolve(__dirname, 'plugin-demo.html'),
        'sui-plugin': resolve(__dirname, 'sui-plugin.html'),
        'sui-plugin-wasm': resolve(__dirname, 'sui-plugin-wasm.html'),
        // Build plugins as separate entry points
        'plugins/hello-plugin': resolve(__dirname, 'plugins/hello-plugin/plugin.tsx'),
        'plugins/hello-world-sui': resolve(__dirname, 'plugins/hello-world-sui/plugin.tsx'),
        'plugins/sui-wallet': resolve(__dirname, 'plugins/sui-wallet/plugin.tsx'),
        'plugins/sui-link': resolve(__dirname, 'plugins/sui-link/plugin.tsx'),
        'plugins/sui-dual-wallet': resolve(__dirname, 'plugins/sui-dual-wallet/plugin.tsx'),
        'plugins/sui-lending': resolve(__dirname, 'plugins/sui-lending/plugin.tsx'),
        'plugins/sui-create-wallet': resolve(__dirname, 'plugins/sui-create-wallet/plugin.tsx'),
        'plugins/sui-pool-explorer': resolve(__dirname, 'plugins/sui-pool-explorer/plugin.tsx'),
        'plugins/sui-price-feed': resolve(__dirname, 'plugins/sui-price-feed/plugin.tsx'),
        'plugins/sui-deepbook-portfolio': resolve(
          __dirname,
          'plugins/sui-deepbook-portfolio/plugin.tsx',
        ),
        'plugins/sui-deepbook-history': resolve(
          __dirname,
          'plugins/sui-deepbook-history/plugin.tsx',
        ),
        'plugins/sui-swap': resolve(__dirname, 'plugins/sui-swap/plugin.tsx'),
        'plugins/sui-deepbook-orderbook': resolve(
          __dirname,
          'plugins/sui-deepbook-orderbook/plugin.tsx',
        ),
        'plugins/sui-hedging-monitor': resolve(__dirname, 'plugins/sui-hedging-monitor/plugin.tsx'),
        'plugins/sui-margin-manager': resolve(__dirname, 'plugins/sui-margin-manager/plugin.tsx'),
        'plugins/sui-walrus-earn': resolve(__dirname, 'plugins/sui-walrus-earn/plugin.tsx'),
        'plugins/sui-wal-swap': resolve(__dirname, 'plugins/sui-wal-swap/plugin.tsx'),
      },
      external: ['gsap', 'motion'],
      preserveEntrySignatures: 'exports-only',
      output: {
        globals: {
          gsap: 'gsap',
          motion: 'Motion',
        },
        // Keep plugin entry points at predictable paths (no hash)
        entryFileNames(chunk) {
          if (chunk.name.startsWith('plugins/')) {
            return `assets/${chunk.name}.js`
          }
          return 'assets/[name]-[hash].js'
        },
        manualChunks(id) {
          // Heavy @mysten/* deps → dedicated chunk, loaded only when a Sui plugin is used
          if (id.includes('node_modules/@mysten/')) {
            return 'vendor-mysten'
          }
        },
      },
    },
  },
})
