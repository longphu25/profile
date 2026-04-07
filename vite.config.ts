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
  base: '/profile/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    copyPluginAssets(),
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        'plugin-demo': resolve(__dirname, 'plugin-demo.html'),
        // Build plugins as separate entry points
        'plugins/hello-plugin': resolve(__dirname, 'plugins/hello-plugin/plugin.tsx'),
        'plugins/hello-world-sui': resolve(__dirname, 'plugins/hello-world-sui/plugin.tsx'),
        'plugins/sui-wallet': resolve(__dirname, 'plugins/sui-wallet/plugin.tsx'),
      },
      external: ['gsap', 'motion'],
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
