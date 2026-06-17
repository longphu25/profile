// vite.config.solana-standalone.ts
// Builds a SINGLE self-contained HTML file with all Solana plugins inlined.
// No dynamic loading, no external assets. Works offline, deployable anywhere.
//
// Usage:  bunx vite build --config vite.config.solana-standalone.ts
// Output: dist-solana/solana-standalone.html (one file, ~300-500KB gzipped)

import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist-solana',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'solana-standalone.html'),
    },
  },
})
