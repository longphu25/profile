import { resolve } from 'path'
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs'
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
        // Copy WASM pkg if exists
        const pkgDir = resolve(pluginsDir, name, 'pkg')
        if (existsSync(pkgDir)) {
          const destPkg = resolve(__dirname, 'dist/plugins', name, 'pkg')
          mkdirSync(destPkg, { recursive: true })
          for (const f of readdirSync(pkgDir)) {
            if (f.endsWith('.js') || f.endsWith('.wasm') || f.endsWith('.d.ts')) {
              copyFileSync(resolve(pkgDir, f), resolve(destPkg, f))
            }
          }
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
      'ethers',
      '@scure/bip39',
      '@scure/bip39/wordlists/english.js',
    ],
    entries: [
      'index.html',
      'app.html',
      'plugin-demo.html',
      'sui-plugin.html',
      'sui-plugin-wasm.html',
      'sui-deepbook-hedging-bot.html',
      'sui-deepbook-predict.html',
      'deepbook.html',
      'polymarket-dashboard.html',
      'marketplace.html',
      'btc-chart.html',
      'deepbook-predict.html',
      'predict-club.html',
      'predict-club-next.html',
      'predict-surface-studio.html',
    ],
  },
  server: {
    proxy: {
      '/api/sui-testnet': {
        target: 'https://fullnode.testnet.sui.io',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/sui-testnet/, ''),
      },
      '/api/mexc': {
        target: 'https://contract.mexc.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/mexc/, ''),
      },
      '/api/okx': {
        target: 'https://www.okx.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/okx/, ''),
      },
      '/api/polymarket/auth': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/api/polymarket/book': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/api/polymarket/order': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/api/polymarket/orders': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/api/polymarket/positions': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/api/polymarket': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/polymarket/, ''),
      },
      '/sui-rpc/testnet': {
        target: 'https://fullnode.testnet.sui.io:443',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/sui-rpc\/testnet/, ''),
      },
      '/sui-rpc/mainnet': {
        target: 'https://fullnode.mainnet.sui.io:443',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/sui-rpc\/mainnet/, ''),
      },
      '/sui-rpc/devnet': {
        target: 'https://fullnode.devnet.sui.io:443',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/sui-rpc\/devnet/, ''),
      },
    },
  },
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        marketplace: resolve(__dirname, 'marketplace.html'),
        'plugin-demo': resolve(__dirname, 'plugin-demo.html'),
        'sui-plugin': resolve(__dirname, 'sui-plugin.html'),
        'sui-plugin-wasm': resolve(__dirname, 'sui-plugin-wasm.html'),
        'sui-deepbook-hedging-bot': resolve(__dirname, 'sui-deepbook-hedging-bot.html'),
        'sui-deepbook-predict': resolve(__dirname, 'sui-deepbook-predict.html'),
        deepbook: resolve(__dirname, 'deepbook.html'),
        'polymarket-dashboard': resolve(__dirname, 'polymarket-dashboard.html'),
        'btc-chart': resolve(__dirname, 'btc-chart.html'),
        'deepbook-predict': resolve(__dirname, 'deepbook-predict.html'),
        'predict-club': resolve(__dirname, 'predict-club.html'),
        'predict-club-next': resolve(__dirname, 'predict-club-next.html'),
        'predict-surface-studio': resolve(__dirname, 'predict-surface-studio.html'),
        'predict-club-lifecycle-prototype': resolve(
          __dirname,
          'predict-club-lifecycle-prototype.html',
        ),
        solana: resolve(__dirname, 'solana.html'),
        // Build plugins as separate entry points
        'plugins/hello-plugin': resolve(__dirname, 'plugins/hello-plugin/plugin.tsx'),
        'plugins/hello-world-sui': resolve(__dirname, 'plugins/hello-world-sui/plugin.tsx'),
        'plugins/sui-wallet': resolve(__dirname, 'plugins/sui-wallet/plugin.tsx'),
        'plugins/sui-link': resolve(__dirname, 'plugins/sui-link/plugin.tsx'),
        'plugins/sui-dual-wallet': resolve(__dirname, 'plugins/sui-dual-wallet/plugin.tsx'),
        'plugins/sui-lending': resolve(__dirname, 'plugins/sui-lending/plugin.tsx'),
        'plugins/sui-scallop': resolve(__dirname, 'plugins/sui-scallop/plugin.tsx'),
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
        'plugins/sui-wallet-profile': resolve(__dirname, 'plugins/sui-wallet-profile/plugin.tsx'),
        'plugins/sui-payment': resolve(__dirname, 'plugins/sui-payment/plugin.tsx'),
        'plugins/sui-walrus-upload': resolve(__dirname, 'plugins/sui-walrus-upload/plugin.tsx'),
        'plugins/sui-walrus-viewer': resolve(__dirname, 'plugins/sui-walrus-viewer/plugin.tsx'),
        'plugins/sui-deepbook-hedging-bot': resolve(
          __dirname,
          'plugins/sui-deepbook-hedging-bot/plugin.tsx',
        ),
        'plugins/sui-deepbook-analysis': resolve(
          __dirname,
          'plugins/sui-deepbook-analysis/plugin.tsx',
        ),
        'plugins/sui-deepbook-predict': resolve(
          __dirname,
          'plugins/sui-deepbook-predict/plugin.tsx',
        ),
        'plugins/sui-seal-encrypt': resolve(__dirname, 'plugins/sui-seal-encrypt/plugin.tsx'),
        'plugins/sui-seal-decrypt': resolve(__dirname, 'plugins/sui-seal-decrypt/plugin.tsx'),
        'plugins/sui-seal-vault': resolve(__dirname, 'plugins/sui-seal-vault/plugin.tsx'),
        'plugins/sui-seal-walrus': resolve(__dirname, 'plugins/sui-seal-walrus/plugin.tsx'),
        'plugins/sui-seal-private': resolve(__dirname, 'plugins/sui-seal-private/plugin.tsx'),
        'plugins/sui-seal-timelock': resolve(__dirname, 'plugins/sui-seal-timelock/plugin.tsx'),
        'plugins/sui-seal-allowlist': resolve(__dirname, 'plugins/sui-seal-allowlist/plugin.tsx'),
        'plugins/sui-seal-voting': resolve(__dirname, 'plugins/sui-seal-voting/plugin.tsx'),
        'plugins/sui-navi-dashboard': resolve(__dirname, 'plugins/sui-navi-dashboard/plugin.tsx'),
        'plugins/sui-navi-advisor': resolve(__dirname, 'plugins/sui-navi-advisor/plugin.tsx'),
        'plugins/sui-navi-chatbot': resolve(__dirname, 'plugins/sui-navi-chatbot/plugin.tsx'),
        'plugins/sui-navi-analysis': resolve(__dirname, 'plugins/sui-navi-analysis/plugin.tsx'),
        'plugins/sui-zk-login': resolve(__dirname, 'plugins/sui-zk-login/plugin.tsx'),
        'plugins/sui-zk-merkle': resolve(__dirname, 'plugins/sui-zk-merkle/plugin.tsx'),
        'plugins/sui-seal-walrus-upload': resolve(
          __dirname,
          'plugins/sui-seal-walrus-upload/plugin.tsx',
        ),
        'plugins/polymarket-weather': resolve(__dirname, 'plugins/polymarket-weather/plugin.tsx'),
        'plugins/polymarket-detail': resolve(__dirname, 'plugins/polymarket-detail/plugin.tsx'),
        'plugins/polymarket-wallet': resolve(__dirname, 'plugins/polymarket-wallet/plugin.tsx'),
        'plugins/polymarket': resolve(__dirname, 'plugins/polymarket/plugin.tsx'),
        'plugins/btc-chart': resolve(__dirname, 'plugins/btc-chart/plugin.tsx'),
        'plugins/predict-club': resolve(__dirname, 'plugins/predict-club/plugin.tsx'),
        'plugins/solana-wallet-profile': resolve(
          __dirname,
          'plugins/solana-wallet-profile/plugin.tsx',
        ),
        'plugins/solana-faucet': resolve(__dirname, 'plugins/solana-faucet/plugin.tsx'),
        'plugins/solana-create-wallet': resolve(
          __dirname,
          'plugins/solana-create-wallet/plugin.tsx',
        ),
      },
      external: ['gsap', 'motion'],
      checks: {
        pluginTimings: false,
      },
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
